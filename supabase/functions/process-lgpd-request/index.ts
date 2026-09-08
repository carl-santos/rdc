import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

class PublicError extends Error {
    status: number;
    constructor(message: string, status = 400) { super(message); this.status = status; }
}

// ─── Schema de validação do body ──────────────────────────────────────────
const ConsentFlagsSchema = z.object({
    consent_ai:          z.boolean().optional(),
    consent_third_party: z.boolean().optional(),
    consent_marketing:   z.boolean().optional(),
}).optional();

const RequestSchema = z.object({
    ticket_id: z.string().uuid({ message: 'ticket_id deve ser um UUID válido' }),
    action: z.enum(['data_access', 'data_portability', 'revoke_consent', 'data_delete', 'grant_consent', 'manage_ticket']),
    payload: z.object({
        revoke:           ConsentFlagsSchema,
        grant:            ConsentFlagsSchema,
        resolution_notes: z.string().max(4000).optional(),
        new_status:       z.enum(['pending', 'in_progress', 'resolved', 'rejected']).optional(),
        reply_message:    z.string().max(4000).optional(),
    }).optional(),
});

// ============================================================
// process-lgpd-request — Edge Function que executa as 4 ações LGPD
// no admin: data_access, data_portability, revoke_consent, data_delete.
//
// Body esperado (POST):
//   {
//     ticket_id: uuid,
//     action:    'data_access' | 'data_portability' | 'revoke_consent' | 'data_delete',
//     payload?: {
//       revoke?: { consent_ai?, consent_third_party?, consent_marketing? },   // só p/ revoke_consent
//       resolution_notes?: string,
//     }
//   }
// ============================================================

const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173';
const IS_DEV = SITE_URL.startsWith('http://localhost') || SITE_URL.includes('127.0.0.1');
const ALLOWED_ORIGINS = IS_DEV
    ? [SITE_URL, 'http://localhost:5173', 'http://localhost:5174']
    : [SITE_URL];

function getCors(origin: string | null) {
    const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL;
    return {
        'Access-Control-Allow-Origin': o,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

// Tipos derivados do schema Zod (RequestSchema acima)
type RequestBody = z.infer<typeof RequestSchema>;
type LgpdAction  = RequestBody['action'];

// CSV simples (sem dependências) — campos com vírgula/aspas viram quoted
function csvEscape(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function buildCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
        headers.join(','),
        ...rows.map(r => headers.map(h => csvEscape(r[h])).join(',')),
    ];
    return lines.join('\n');
}

// Extrai { bucket, path } de um valor gravado (referência "bucket/caminho" ou URL
// pública/assinada do Supabase) para os buckets de imagem sensível. Retorna null
// para URLs externas — não são nossas e não podem ser apagadas.
// Espelha src/utils/storageUrl.ts no frontend.
function parseLgpdStorageRef(stored: unknown): { bucket: string; path: string } | null {
    if (typeof stored !== 'string' || !stored) return null;
    const SIGNED = ['avatars', 'tenant-logos', 'ticket-attachments'];
    const m = stored.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
    if (m) return SIGNED.includes(m[1]) ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
    if (/^https?:\/\//i.test(stored)) return null; // URL externa — não nossa
    const slash = stored.indexOf('/');
    if (slash > 0) {
        const b = stored.slice(0, slash);
        if (SIGNED.includes(b)) return { bucket: b, path: stored.slice(slash + 1) };
    }
    return null;
}

// Senha aleatória "de banimento" para a conta anonimizada. Precisa satisfazer a
// política de senha do Supabase Auth (S-06: minúscula + maiúscula + dígito + símbolo),
// senão updateUserById falha (weak_password) e a conta NÃO é de fato bloqueada.
function randomCompliantPassword(): string {
    const sets = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', '!@#$%^&*()_+-='];
    const all = sets.join('');
    const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    const guaranteed = sets.map((s) => s[rnd(1)[0] % s.length]);        // 1 de cada classe
    const filler = Array.from(rnd(20), (byte) => all[byte % all.length]); // + 20 aleatórios
    return [...guaranteed, ...filler].join('');
}

serve(async (req) => {
    const cors = getCors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
        const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // 1. Auth do chamador
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
                status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: { user: caller }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !caller) {
            return new Response(JSON.stringify({ error: 'Token inválido.' }), {
                status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: callerProfile } = await adminClient
            .from('profiles')
            .select('id, role, tenant_id, nome, email')
            .eq('id', caller.id)
            .single();

        if (!callerProfile) {
            return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), {
                status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        const role = (callerProfile as any).role;
        const isPlatformAdmin = role === 'platform_admin';
        const isTenantAdmin   = role === 'tenant_admin';
        const isClient       = role === 'client';

        // 2. Lê e valida body via Zod
        let rawBody: unknown;
        try {
            rawBody = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: 'JSON inválido.' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const parsed = RequestSchema.safeParse(rawBody);
        if (!parsed.success) {
            console.error('[process-lgpd-request] validation failed:', parsed.error.issues.map(i => i.path.join('.')));
            return new Response(JSON.stringify({ error: 'Entrada inválida.' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const { ticket_id, action, payload } = parsed.data;

        // 3. Carrega ticket + valida
        const { data: ticket, error: tErr } = await adminClient
            .from('support_tickets')
            .select('*')
            .eq('id', ticket_id)
            .single();

        if (tErr || !ticket) {
            return new Response(JSON.stringify({ error: 'Ticket não encontrado.' }), {
                status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        const t = ticket as any;
        if (t.category !== 'lgpd') {
            return new Response(JSON.stringify({ error: 'Ticket não é de categoria LGPD.' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // manage_ticket é meta-ação (não executa ação técnica LGPD) — não exige match com lgpd_type
        if (action !== 'manage_ticket' && t.lgpd_type && t.lgpd_type !== action) {
            return new Response(JSON.stringify({ error: `Action ${action} não combina com lgpd_type ${t.lgpd_type}.` }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // Permissões:
        //  - platform_admin: todas as ações
        //  - tenant_admin: exceto data_delete; e só nos próprios tenants
        //  - client: APENAS revoke_consent no próprio ticket (Art. 18 §3º — revogação facilitada)
        // Client pode revogar OU reativar os próprios consentimentos (Art. 18 §3º)
        const isSelfConsentAction = isClient
            && (action === 'revoke_consent' || action === 'grant_consent')
            && t.user_id === (callerProfile as any).id;
        // Compatibilidade — variável legada para self-revoke especificamente
        const isSelfRevoke = isSelfConsentAction && action === 'revoke_consent';
        const isSelfGrant  = isSelfConsentAction && action === 'grant_consent';

        if (!isPlatformAdmin && !isTenantAdmin && !isSelfConsentAction) {
            return new Response(JSON.stringify({ error: 'Sem permissão para processar esta solicitação LGPD.' }), {
                status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // Decisão 1-C: data_delete só platform_admin
        if (action === 'data_delete' && !isPlatformAdmin) {
            return new Response(JSON.stringify({ error: 'Exclusão de conta requer platform_admin.' }), {
                status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // tenant_admin: só atua nos próprios tenants
        if (isTenantAdmin && t.tenant_id !== (callerProfile as any).tenant_id) {
            return new Response(JSON.stringify({ error: 'Você só pode processar solicitações do seu tenant.' }), {
                status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // 4. Carrega user-alvo (dono do ticket)
        const targetUserId = t.user_id as string;
        const { data: targetProfile } = await adminClient
            .from('profiles')
            .select('id, nome, email, role, tenant_id, client_id, cargo, created_at, consents_revoked')
            .eq('id', targetUserId)
            .single();

        if (!targetProfile) {
            return new Response(JSON.stringify({ error: 'Usuário-alvo não encontrado.' }), {
                status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        const target = targetProfile as any;
        const targetEmail = target.email; // captura antes de qualquer anonimização
        const targetNome  = target.nome;

        // ─────────────────────────────────────────────────────────────
        // 5. Executa ação
        // ─────────────────────────────────────────────────────────────
        let exportPath: string | null = null;
        let resolutionMessage = ''; // curto, vai para notification.message
        let resolutionDetail  = ''; // completo (com links), vai para ticket_messages
        let auditMetadata: Record<string, unknown> = {};

        if (action === 'data_access' || action === 'data_portability') {
            // Agrega dados do usuário
            const [clientRes, ticketsRes, authUserRes] = await Promise.all([
                target.client_id
                    ? adminClient.from('clients').select('*').eq('id', target.client_id).maybeSingle()
                    : Promise.resolve({ data: null }),
                adminClient.from('support_tickets').select('id, ticket_number, subject, category, status, created_at').eq('user_id', targetUserId),
                adminClient.auth.admin.getUserById(targetUserId),
            ]);

            // LGPD-1: gera Signed URLs (30d) das imagens do cliente para o export ser utilizável
            // (após SEC-01 os campos guardam referências de bucket privado, não URLs abríveis).
            const THIRTY_DAYS = 30 * 24 * 60 * 60;
            const imagens: { tipo: string; url: string }[] = [];
            const clientPhoto = (clientRes as any)?.data?.foto_url;
            const photoRef = parseLgpdStorageRef(clientPhoto);
            if (photoRef) {
                const { data: signedPhoto } = await adminClient.storage
                    .from(photoRef.bucket).createSignedUrl(photoRef.path, THIRTY_DAYS);
                if (signedPhoto?.signedUrl) imagens.push({ tipo: 'foto', url: signedPhoto.signedUrl });
            } else if (typeof clientPhoto === 'string' && /^https?:\/\//i.test(clientPhoto)) {
                imagens.push({ tipo: 'foto', url: clientPhoto });
            }

            const reportData = {
                _meta: {
                    generated_at: new Date().toISOString(),
                    generated_by: callerProfile.id,
                    request_type: action,
                    ticket_number: t.ticket_number,
                    lgpd_article: action === 'data_access' ? 'Art. 18, II' : 'Art. 18, V',
                },
                user: {
                    id: target.id,
                    nome: target.nome,
                    email: target.email,
                    role: target.role,
                    cargo: target.cargo,
                    tenant_id: target.tenant_id,
                    client_id: target.client_id,
                    created_at: target.created_at,
                },
                consents: {
                    raw_user_meta_data: (authUserRes as any)?.data?.user?.user_metadata ?? null,
                    consents_revoked: target.consents_revoked ?? {},
                },
                client: (clientRes as any)?.data ?? null,
                imagens, // links (30d) das imagens do titular
                support_tickets: (ticketsRes as any)?.data ?? [],
            };

            const folder = `${targetUserId}/${t.ticket_number}`;
            const jsonPath = `${folder}/dados.json`;

            // Upload JSON principal
            const { error: upErr } = await adminClient.storage.from('lgpd-exports').upload(
                jsonPath,
                new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' }),
                { upsert: true, contentType: 'application/json' },
            );
            if (upErr) { console.error(`[process-lgpd-request] Falha ao gravar JSON:`, upErr.message); throw new Error('storage upload failed'); }

            // Portabilidade: gera também um CSV dos chamados (formato tabular)
            if (action === 'data_portability' && reportData.support_tickets.length > 0) {
                const csvText = buildCsv(reportData.support_tickets as any[]);
                const csvPath = `${folder}/chamados.csv`;
                const { error: csvErr } = await adminClient.storage.from('lgpd-exports').upload(
                    csvPath,
                    new Blob([csvText], { type: 'text/csv' }),
                    { upsert: true, contentType: 'text/csv' },
                );
                if (csvErr) { console.error(`[process-lgpd-request] Falha ao gravar CSV:`, csvErr.message); throw new Error('storage upload failed'); }
            }

            exportPath = folder;

            // Gera signed URLs de 30 dias para o cliente baixar diretamente do ticket
            // (THIRTY_DAYS já declarado acima para os links de imagem)
            const filesToSign = action === 'data_portability' && reportData.support_tickets.length > 0
                ? ['dados.json', 'chamados.csv']
                : ['dados.json'];

            const downloadLinks: string[] = [];
            for (const f of filesToSign) {
                const { data: signed } = await adminClient.storage
                    .from('lgpd-exports')
                    .createSignedUrl(`${folder}/${f}`, THIRTY_DAYS);
                if (signed?.signedUrl) downloadLinks.push(`${f}: ${signed.signedUrl}`);
            }

            const downloadBlock = downloadLinks.length > 0
                ? `\n\n📥 Links de download (válidos por 30 dias):\n${downloadLinks.join('\n\n')}`
                : '';

            resolutionMessage = action === 'data_access'
                ? `Relatório dos seus dados gerado. Abra esta solicitação no portal de Chamados para baixar.`
                : `Pacote de portabilidade gerado (JSON${reportData.support_tickets.length > 0 ? ' + CSV' : ''}). Abra esta solicitação no portal de Chamados para baixar.`;

            resolutionDetail = resolutionMessage + downloadBlock;

            auditMetadata = {
                target_user_id: targetUserId,
                target_email: targetEmail,
                tickets_count: reportData.support_tickets.length,
                export_path: folder,
                download_files: filesToSign,
            };
        }

        else if (action === 'revoke_consent') {
            const revoke = payload?.revoke ?? {};
            const flags: Record<string, true> = {};
            if (revoke.consent_ai)          flags.consent_ai = true;
            if (revoke.consent_third_party) flags.consent_third_party = true;
            if (revoke.consent_marketing)   flags.consent_marketing = true;

            if (Object.keys(flags).length === 0) {
                return new Response(JSON.stringify({ error: 'Informe ao menos um consentimento a revogar.' }), {
                    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
                });
            }

            const merged = { ...(target.consents_revoked || {}), ...flags };

            const { error: upErr } = await adminClient.from('profiles').update({
                consents_revoked: merged,
                consents_revoked_at: new Date().toISOString(),
                consents_revoked_by: callerProfile.id,
            } as any).eq('id', targetUserId);
            if (upErr) { console.error(`[process-lgpd-request] Falha ao atualizar consentimentos:`, upErr.message); throw new Error('consent update failed'); }

            const revokedList = Object.keys(flags).map(k => k.replace('consent_', '')).join(', ');
            resolutionMessage = `Consentimentos revogados: ${revokedList}.`;
            resolutionDetail  = resolutionMessage;
            auditMetadata = { target_user_id: targetUserId, revoked: Object.keys(flags), merged_state: merged };

            // Feedback amplo: se afetou consent_ai/third_party E o user é client, notifica o tenant_admin
            if ((flags.consent_ai || flags.consent_third_party) && target.role === 'client' && target.tenant_id) {
                const { data: tenantAdmins } = await adminClient
                    .from('profiles')
                    .select('id')
                    .eq('tenant_id' as any, target.tenant_id as any)
                    .eq('role' as any, 'tenant_admin' as any);

                for (const admin of (tenantAdmins as any[] || [])) {
                    await adminClient.from('notifications').insert({
                        user_id: admin.id,
                        tenant_id: target.tenant_id,
                        type: 'lgpd_consent_revoked',
                        title: 'Cliente revogou consentimento',
                        message: `${targetNome} revogou consentimento para IA/processamento por terceiros. Novas operações para esse cliente estão bloqueadas.`,
                        link: `/admin/lgpd`,
                        reference_id: t.id,
                    } as any);
                }
            }
        }

        else if (action === 'grant_consent') {
            const grant = payload?.grant ?? {};
            const toGrant: string[] = [];
            if (grant.consent_ai)          toGrant.push('consent_ai');
            if (grant.consent_third_party) toGrant.push('consent_third_party');
            if (grant.consent_marketing)   toGrant.push('consent_marketing');

            if (toGrant.length === 0) {
                return new Response(JSON.stringify({ error: 'Informe ao menos um consentimento a reativar.' }), {
                    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
                });
            }

            // Remove os flags reativados do objeto consents_revoked
            const merged: Record<string, unknown> = { ...(target.consents_revoked || {}) };
            for (const key of toGrant) {
                delete merged[key];
            }

            const allReactivated = Object.keys(merged).length === 0;

            const { error: upErr } = await adminClient.from('profiles').update({
                consents_revoked: merged,
                // Se todos foram reativados, limpa o timestamp; senão atualiza pra refletir a última mudança
                consents_revoked_at: allReactivated ? null : new Date().toISOString(),
                consents_revoked_by: allReactivated ? null : callerProfile.id,
            } as any).eq('id', targetUserId);
            if (upErr) { console.error(`[process-lgpd-request] Falha ao reativar consentimentos:`, upErr.message); throw new Error('consent grant failed'); }

            const grantedList = toGrant.map(k => k.replace('consent_', '')).join(', ');
            resolutionMessage = `Consentimentos reativados: ${grantedList}.`;
            resolutionDetail  = resolutionMessage;
            auditMetadata = { target_user_id: targetUserId, granted: toGrant, merged_state: merged, self_grant: isSelfGrant };

            // Feedback amplo: se afetou IA/terceiros, notifica o tenant_admin (operações liberadas)
            if ((grant.consent_ai || grant.consent_third_party) && target.role === 'client' && target.tenant_id) {
                const { data: tenantAdmins } = await adminClient
                    .from('profiles')
                    .select('id')
                    .eq('tenant_id' as any, target.tenant_id as any)
                    .eq('role' as any, 'tenant_admin' as any);

                for (const admin of (tenantAdmins as any[] || [])) {
                    await adminClient.from('notifications').insert({
                        user_id: admin.id,
                        tenant_id: target.tenant_id,
                        type: 'lgpd_consent_granted',
                        title: 'Cliente reativou consentimento',
                        message: `${targetNome} reativou consentimento para IA/processamento por terceiros. Novas operações para esse cliente estão liberadas.`,
                        link: `/admin/lgpd`,
                        reference_id: t.id,
                    } as any);
                }
            }
        }

        else if (action === 'manage_ticket') {
            // Meta-ação: admin gerencia ciclo de vida do ticket sem executar ação técnica LGPD.
            // Útil para: marcar em análise, rejeitar, reabrir, ou apenas responder.
            const p = payload || {};
            const newStatus = p.new_status;
            const reply     = p.reply_message?.trim();

            if (!newStatus && !reply) {
                return new Response(JSON.stringify({ error: 'Informe new_status e/ou reply_message.' }), {
                    status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
                });
            }
            // Validação de newStatus já feita pelo Zod (enum)

            const updates: Record<string, unknown> = {};
            if (newStatus) {
                updates.lgpd_status = newStatus;
                // Espelha no campo status genérico (open/closed) que é usado em outros lugares do app
                updates.status = (newStatus === 'resolved' || newStatus === 'rejected') ? 'closed' : 'open';
                if (newStatus === 'resolved' || newStatus === 'rejected') {
                    updates.lgpd_resolved_at  = new Date().toISOString();
                    updates.lgpd_processed_by = callerProfile.id;
                } else {
                    // Voltando ao estado ativo — limpa resolved_at
                    updates.lgpd_resolved_at  = null;
                    updates.lgpd_processed_by = null;
                }
            }
            if (p.resolution_notes) updates.lgpd_resolution_notes = p.resolution_notes;

            if (Object.keys(updates).length > 0) {
                const { error: upErr } = await adminClient.from('support_tickets').update(updates as any).eq('id', ticket_id);
                if (upErr) { console.error(`[process-lgpd-request] Falha ao atualizar ticket:`, upErr.message); throw new Error('ticket update failed'); }
            }

            if (reply) {
                const { error: msgErr } = await adminClient.from('ticket_messages').insert({
                    ticket_id,
                    sender_type: 'admin',
                    sender_id: callerProfile.id,
                    message: reply,
                } as any);
                if (msgErr) { console.error(`[process-lgpd-request] Falha ao enviar resposta:`, msgErr.message); throw new Error('message insert failed'); }
            }

            // Notifica o titular quando admin muda status (não em todas as transições — só nas relevantes)
            if (newStatus && newStatus !== 'pending') {
                const titleMap: Record<string, string> = {
                    in_progress: 'Sua solicitação LGPD está em análise',
                    resolved:    'Sua solicitação LGPD foi atendida',
                    rejected:    'Sua solicitação LGPD foi rejeitada',
                };
                const chamadosLink = target.role === 'client' ? '/cliente/chamados' : '/meus-chamados';
                await adminClient.from('notifications').insert({
                    user_id: targetUserId,
                    tenant_id: target.tenant_id,
                    type: `lgpd_status_${newStatus}`,
                    title: titleMap[newStatus],
                    message: reply || `Status atualizado para "${newStatus}". Acesse seus chamados para detalhes.`,
                    link: chamadosLink,
                    reference_id: t.id,
                } as any);
            }

            await adminClient.from('audit_logs').insert({
                user_id: callerProfile.id,
                tenant_id: (callerProfile as any).tenant_id ?? target.tenant_id,
                role,
                event_type: 'lgpd_manage_ticket',
                action: `Atualizou ticket LGPD ${t.ticket_number}${newStatus ? ` → ${newStatus}` : ''}${reply ? ' (com resposta)' : ''}`,
                category: 'data_access',
                resource_type: 'support_ticket',
                resource_id: ticket_id,
                severity: newStatus === 'rejected' ? 'warning' : 'info',
                status: 'success',
                metadata: { ticket_id, new_status: newStatus, has_reply: !!reply, resolution_notes: p.resolution_notes },
            } as any);

            return new Response(JSON.stringify({ success: true, new_status: newStatus, message: 'Ticket atualizado.' }), {
                status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        else if (action === 'data_delete') {
            // Decisão 2-C: anonimização (hard delete em tudo menos audit_logs e billing_invoices,
            // que são preservados com referência apenas; campos PII são apagados/substituídos).

            // (a0) Apaga os ARQUIVOS do titular (Art. 18 VI — eliminação).
            // Coleta a referência em clients.foto_url e remove o objeto do storage.
            let deletedImages = 0;
            let authAnonFailed = false;
            if (target.client_id) {
                const imageRefs: unknown[] = [];
                const { data: clientRow } = await adminClient
                    .from('clients').select('foto_url').eq('id', target.client_id).maybeSingle();
                if ((clientRow as any)?.foto_url) imageRefs.push((clientRow as any).foto_url);

                const byBucket: Record<string, string[]> = {};
                for (const ref of imageRefs) {
                    const parsedRef = parseLgpdStorageRef(ref);
                    if (parsedRef) (byBucket[parsedRef.bucket] ??= []).push(parsedRef.path);
                }
                for (const [bucket, paths] of Object.entries(byBucket)) {
                    const { error: rmErr } = await adminClient.storage.from(bucket).remove(paths);
                    if (rmErr) console.error(`[process-lgpd-request] Falha ao remover imagens (${bucket}):`, rmErr.message);
                    else deletedImages += paths.length;
                }

            }

            // (a) Anonimiza client (se houver)
            if (target.client_id) {
                const { error: paErr } = await adminClient.from('clients').update({
                    nome: '[REMOVIDO]',
                    email: null,
                    telefone: null,
                    foto_url: null,
                    anonymized_at: new Date().toISOString(),
                    anonymized_by: callerProfile.id,
                } as any).eq('id', target.client_id);
                if (paErr) { console.error(`[process-lgpd-request] Falha ao anonimizar client:`, paErr.message); throw new Error('client anonymize failed'); }
            }

            // (b) Anonimiza profile (FKs preservadas para billing_invoices/audit_logs)
            const anonEmail = `anon_${targetUserId.slice(0, 8)}@deleted.local`;
            const { error: prErr } = await adminClient.from('profiles').update({
                nome: '[REMOVIDO]',
                email: anonEmail,
                cargo: null,
                anonymized_at: new Date().toISOString(),
                anonymized_by: callerProfile.id,
            } as any).eq('id', targetUserId);
            if (prErr) { console.error(`[process-lgpd-request] Falha ao anonimizar profile:`, prErr.message); throw new Error('profile anonymize failed'); }

            // (c) Banimento + anonimização do auth.user (sem deletar — manteria CASCADE no profile)
            const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(); // ~100 anos
            const { error: authUpdErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
                email: anonEmail,
                password: randomCompliantPassword(), // senha forte aleatória (satisfaz a política de Auth do S-06)
                ban_duration: '876000h', // 100 anos
                user_metadata: { anonymized: true, anonymized_at: new Date().toISOString() },
                app_metadata: {},
            } as any);
            if (authUpdErr) {
                // Se isto falha, a conta de LOGIN não é bloqueada (o profile foi anonimizado,
                // mas o auth.user mantém e-mail/senha). Registramos para não ficar silencioso —
                // o operador deve então tratar a conta manualmente no Auth.
                console.error('[process-lgpd-request] Falha ao anonimizar auth.user:', authUpdErr);
                authAnonFailed = true;
            }

            // LGPD-2: remove as notificações do titular (mensagens/links com seus dados).
            // (Notificações sobre o titular enviadas a admins, com o nome embutido, são um
            //  resíduo interno menor — ver LGPD-2 nas pendências.)
            await adminClient.from('notifications').delete().eq('user_id', targetUserId);

            resolutionMessage = `Conta anonimizada permanentemente. PII removida de profile e client (${deletedImages} arquivo(s) apagado(s) do storage). Registros financeiros e logs de auditoria mantidos com IDs, sem PII, para conformidade fiscal.`;
            resolutionDetail  = resolutionMessage;
            auditMetadata = {
                target_user_id: targetUserId,
                original_email: targetEmail,
                anonymized_email: anonEmail,
                had_client: !!target.client_id,
                deleted_images: deletedImages,
                auth_anonymize_failed: authAnonFailed,
            };
        }

        else {
            return new Response(JSON.stringify({ error: `Action desconhecida: ${action}` }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // ─────────────────────────────────────────────────────────────
        // 6. Atualiza ticket + cria mensagem
        // ─────────────────────────────────────────────────────────────
        const ticketUpdate: Record<string, unknown> = {
            lgpd_status: 'resolved',
            lgpd_resolved_at: new Date().toISOString(),
            lgpd_processed_by: callerProfile.id,
            status: 'closed',
        };
        if (payload?.resolution_notes) ticketUpdate.lgpd_resolution_notes = payload.resolution_notes;
        if (exportPath)                ticketUpdate.lgpd_export_path = exportPath;

        await adminClient.from('support_tickets').update(ticketUpdate as any).eq('id', ticket_id);

        // Mensagem no ticket — texto diferente quando o titular age automaticamente
        const selfActionLabel = isSelfRevoke ? 'Revogação' : isSelfGrant ? 'Reativação' : null;
        await adminClient.from('ticket_messages').insert({
            ticket_id,
            sender_type: isSelfConsentAction ? 'user' : 'admin',
            sender_id: callerProfile.id,
            message: selfActionLabel
                ? `[${selfActionLabel} automática realizada pelo titular]\n\n${resolutionDetail}`
                : `[Solicitação LGPD atendida]\n\n${resolutionDetail}${payload?.resolution_notes ? `\n\nObservações: ${payload.resolution_notes}` : ''}`,
        } as any);

        // Notificação ao titular só faz sentido quando admin processa.
        // Para self-action (revoke/grant), o titular acabou de executar; já recebe feedback na UI.
        if (action !== 'data_delete' && !isSelfConsentAction) {
            const chamadosLink = target.role === 'client' ? '/cliente/chamados' : '/meus-chamados';
            await adminClient.from('notifications').insert({
                user_id: targetUserId,
                tenant_id: target.tenant_id,
                type: `lgpd_${action}_resolved`,
                title: 'Sua solicitação LGPD foi atendida',
                message: resolutionMessage,
                link: chamadosLink,
                reference_id: t.id,
            } as any);
        }

        await adminClient.from('audit_logs').insert({
            user_id: callerProfile.id,
            tenant_id: (callerProfile as any).tenant_id ?? target.tenant_id,
            role,
            event_type: `lgpd_${action}${isSelfConsentAction ? '_self' : ''}`,
            action: isSelfRevoke
                ? `Titular revogou próprios consentimentos`
                : isSelfGrant
                    ? `Titular reativou próprios consentimentos`
                    : `Executou ${action} sobre user ${targetUserId}`,
            category: 'data_access',
            resource_type: 'profile',
            resource_id: targetUserId,
            severity: action === 'data_delete' ? 'critical' : 'warning',
            status: 'success',
            metadata: { ticket_id, ...auditMetadata },
        } as any);

        return new Response(JSON.stringify({
            success: true,
            export_path: exportPath,
            message: resolutionMessage,
        }), {
            status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('[process-lgpd-request] Erro:', err);
        if (err instanceof PublicError) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: err.status, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({
            error: 'Erro interno na execução da ação LGPD.',
        }), {
            status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
        });
    }
});
