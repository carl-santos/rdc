import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

// VAL-02: schema do body
const InviteSchema = z.object({
    client_id: z.string().uuid(),
    email:      z.string().trim().email().max(200),
    nome:       z.string().trim().min(1).max(120),
});

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

serve(async (req) => {
    const cors = getCors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: cors });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Verifica JWT do profissional chamador
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

        // Verifica perfil e permissão do chamador
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

        const isPlatformAdmin = callerProfile.role === 'platform_admin';

        if (!['tenant_admin', 'collaborator', 'platform_admin'].includes(callerProfile.role)) {
            return new Response(JSON.stringify({ error: 'Sem permissão para convidar clientes.' }), {
                status: 403,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        if (!isPlatformAdmin && !callerProfile.tenant_id) {
            return new Response(JSON.stringify({ error: 'Profissional sem tenant associado.' }), {
                status: 400,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        let rawBody: unknown;
        try {
            rawBody = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Corpo da requisição inválido.' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const parsed = InviteSchema.safeParse(rawBody);
        if (!parsed.success) {
            return new Response(JSON.stringify({ error: 'client_id, email e nome inválidos.' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const { client_id, email, nome } = parsed.data;

        // Busca o cliente — platform_admin pode acessar qualquer tenant
        const clientQuery = adminClient
            .from('clients')
            .select('id, tenant_id')
            .eq('id', client_id);

        if (!isPlatformAdmin) {
            clientQuery.eq('tenant_id', callerProfile.tenant_id);
        }

        const { data: client, error: clientError } = await clientQuery.single();

        if (clientError || !client) {
            return new Response(JSON.stringify({ error: 'Cliente não encontrado.' }), {
                status: 404,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        // Para platform_admin usa o tenant_id do próprio cliente
        const effectiveTenantId = isPlatformAdmin ? (client as any).tenant_id : callerProfile.tenant_id;

        // Envia convite com metadados do cliente
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: {
                role: 'client',
                client_id: client_id,
                tenant_id: effectiveTenantId,
                nome: nome,
            },
            redirectTo: `${Deno.env.get('SITE_URL') ?? supabaseUrl}/aceitar-convite`,
        });

        if (inviteError) {
            // Anti-enumeração (P2 4.7): para "já registrado", responde sucesso
            // genérico em vez de revelar que o e-mail existe.
            if (inviteError.message.includes('already been registered')) {
                console.log('[invite-client] E-mail já registrado — prosseguindo com vínculo do cliente.');
                return new Response(
                    JSON.stringify({ success: true, message: 'Convite enviado se o e-mail estiver disponível.' }),
                    { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
                );
            }
            throw inviteError;
        }

        // Define app_metadata para que as RLS policies funcionem via JWT
        const { error: metaErr } = await adminClient.auth.admin.updateUserById(inviteData.user.id, {
            app_metadata: {
                role: 'client',
                client_id: client_id,
                tenant_id: effectiveTenantId,
            },
        });
        if (metaErr) {
            console.error('[invite-client] Falha ao definir app_metadata:', metaErr);
            throw new Error(`Falha ao configurar metadata: ${metaErr.message}`);
        }

        // Configura o perfil via service_role. handle_new_user já cria o profile
        // com role/tenant correto (a partir de raw_user_meta_data); o upsert aqui
        // é redundância defensiva caso o trigger falhe.
        const { error: profileErr } = await adminClient.from('profiles').upsert({
            id: inviteData.user.id,
            email: email,
            nome: nome,
            role: 'client',
            client_id: client_id,
            tenant_id: effectiveTenantId,
        });
        if (profileErr) {
            console.error('[invite-client] Falha no upsert do profile:', profileErr);
            throw new Error(`Falha ao configurar perfil: ${profileErr.message}`);
        }

        // Vincula o auth user ao registro do cliente imediatamente
        const { error: linkErr } = await adminClient.from('clients')
            .update({ client_user_id: inviteData.user.id })
            .eq('id', client_id);
        if (linkErr) {
            console.error('[invite-client] Falha ao vincular cliente:', linkErr);
            throw new Error(`Falha ao vincular cliente: ${linkErr.message}`);
        }

        return new Response(
            JSON.stringify({ success: true, user_id: inviteData.user.id }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        console.error('[invite-client] Erro:', err);
        return new Response(
            JSON.stringify({ error: 'Erro interno.' }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
    }
});
