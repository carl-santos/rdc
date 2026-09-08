import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

// VAL-02: schema do body. `role` é validado por whitelist mais abaixo (mantém
// o hardening do CVE de privilege escalation), então aqui é apenas opcional.
const TeamInviteSchema = z.object({
    email:      z.string().trim().email().max(200),
    nome:       z.string().trim().min(1).max(120),
    cargo:      z.string().trim().max(120).optional().nullable(),
    role:       z.string().max(40).optional().nullable(),
    redirectTo: z.string().url().max(500).optional().nullable(),
});

const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173';
const IS_DEV = SITE_URL.startsWith('http://localhost') || SITE_URL.includes('127.0.0.1');
const ALLOWED_ORIGINS = IS_DEV
    ? [SITE_URL, 'http://localhost:5173', 'http://localhost:5174']
    : [SITE_URL];

// Origens normalizadas (sem barra final/path) para validar o redirectTo com robustez.
const ALLOWED_ORIGIN_SET = new Set(
    ALLOWED_ORIGINS.map((o) => { try { return new URL(o).origin; } catch { return o; } }),
);

function getCors(origin: string | null) {
    const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL;
    return {
        'Access-Control-Allow-Origin': o,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

serve(async (req) => {
    const cors = getCors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: cors });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Cliente admin (service role) para operações privilegiadas
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Verifica o JWT do usuário chamador
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
                status: 401,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);

        if (authError || !caller) {
            return new Response(JSON.stringify({ error: 'Token inválido.' }), {
                status: 401,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // Busca o perfil do chamador para verificar permissão e tenant_id
        const { data: callerProfile, error: profileError } = await adminClient
            .from('profiles')
            .select('role, tenant_id')
            .eq('id', caller.id)
            .single();

        if (profileError || !callerProfile) {
            return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), {
                status: 403,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        if (callerProfile.role !== 'tenant_admin') {
            return new Response(JSON.stringify({ error: 'Apenas administradores podem convidar membros.' }), {
                status: 403,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        if (!callerProfile.tenant_id) {
            return new Response(JSON.stringify({ error: 'Administrador sem tenant associado.' }), {
                status: 400,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // Lê o body do convite
        let rawBody: unknown;
        try {
            rawBody = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Corpo da requisição inválido.' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const parsed = TeamInviteSchema.safeParse(rawBody);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: 'Email e nome são obrigatórios e devem ser válidos.' }), {
                status: 400,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const { email, nome, cargo, role, redirectTo: bodyRedirectTo } = parsed.data;

        const validRoles = ['collaborator', 'tenant_admin'];
        const inviteRole = validRoles.includes(role) ? role : 'collaborator';

        // SEC-F5: o redirectTo vem do frontend, mas só é aceito se sua ORIGEM estiver na
        // allowlist (ALLOWED_ORIGINS = SITE_URL). Impede open redirect no e-mail de convite.
        // Fora da allowlist, cai para SITE_URL — o convite continua apontando para o domínio correto.
        const fallbackUrl = Deno.env.get('SITE_URL') || Deno.env.get('PUBLIC_SITE_URL') || supabaseUrl;
        let siteUrl = fallbackUrl;
        if (bodyRedirectTo) {
            try {
                const u = new URL(bodyRedirectTo);
                if (ALLOWED_ORIGIN_SET.has(u.origin)) {
                    siteUrl = bodyRedirectTo;
                } else {
                    console.warn('[invite-team-member] redirectTo fora da allowlist — usando fallback:', u.origin);
                }
            } catch {
                console.warn('[invite-team-member] redirectTo inválido — usando fallback.');
            }
        }
        console.log('[invite-team-member] Using redirect URL:', siteUrl);

        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: {
                tenant_id: callerProfile.tenant_id,
                nome: nome,
                cargo: cargo || null,
                role: inviteRole,
            },
            redirectTo: siteUrl,
        });

        if (inviteError) {
            // Anti-enumeração (P2 4.7): para "já registrado", responde sucesso
            // genérico em vez de revelar que o e-mail existe na plataforma. O
            // caso real fica registrado nos logs para o admin investigar pelo
            // painel.
            if (inviteError.message.includes('already been registered')) {
                console.log('[invite-team-member] E-mail já registrado — reenviando/atualizando convite.');
                return new Response(
                    JSON.stringify({ success: true, message: 'Convite enviado se o e-mail estiver disponível.' }),
                    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
                );
            }
            throw inviteError;
        }

        // Define o tenant_id no app_metadata para que as RLS policies do banco funcionem
        // O app_metadata é incluído no JWT e verificado pelas políticas de isolamento de tenant
        await adminClient.auth.admin.updateUserById(inviteData.user.id, {
            app_metadata: { tenant_id: callerProfile.tenant_id },
        });

        return new Response(
            JSON.stringify({ success: true, user_id: inviteData.user.id }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        console.error('[invite-team-member] Erro:', err);
        return new Response(
            JSON.stringify({ error: 'Erro interno.' }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
    }
});
