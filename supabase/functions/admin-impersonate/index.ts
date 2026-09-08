import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// PublicError: erros cuja mensagem pode ser exposta ao cliente.
// Qualquer outro erro é tratado como interno e retorna mensagem genérica.
class PublicError extends Error {
    status: number;
    constructor(message: string, status = 400) { super(message); this.status = status; }
}

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
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173';

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new PublicError('Não autorizado.', 401);

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) throw new PublicError('Não autorizado.', 401);

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Verify the caller is a platform_admin
        const { data: callerProfile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (callerProfile?.role !== 'platform_admin') throw new PublicError('Acesso restrito a administradores da plataforma.', 403);

        // Rate limiting: max 3 impersonations per platform_admin per hour
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { count: recentCount } = await adminClient
                .from('audit_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('action', 'impersonate')
                .gte('created_at', oneHourAgo);

            if ((recentCount || 0) >= 3) {
                return new Response(
                    JSON.stringify({ error: 'Limite de impersonações atingido. Tente novamente em uma hora.' }),
                    { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
                );
            }
        } catch {
            // audit_logs table not yet available — rate limiting enforced after migration
        }

        const { target_user_id } = await req.json();
        if (!target_user_id) throw new PublicError('target_user_id é obrigatório.', 400);

        // Get target user's email
        const { data: targetProfile } = await adminClient
            .from('profiles')
            .select('id, email, role, nome')
            .eq('id', target_user_id)
            .single();

        if (!targetProfile) throw new PublicError('Usuário alvo não encontrado.', 404);
        if (targetProfile.role === 'platform_admin') throw new PublicError('Não é possível impersonar outro administrador da plataforma.', 403);

        // Generate a magic link for the target user
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: 'magiclink',
            email: targetProfile.email,
            options: { redirectTo: `${siteUrl}/dashboard` },
        });

        if (linkError) {
            console.error('[admin-impersonate] generateLink failed:', linkError.message);
            throw new Error('generateLink failed');
        }

        // Audit log for the impersonation
        try {
            await adminClient.from('audit_logs').insert({
                user_id: user.id,
                action: 'impersonate',
                resource_type: 'user',
                resource_id: target_user_id,
                ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
                metadata: { target_email: targetProfile.email, target_name: targetProfile.nome },
            });
        } catch {
            // audit_logs table not yet available — will be recorded after migration
        }

        return new Response(
            JSON.stringify({
                success: true,
                actionLink: linkData.properties.action_link,
                targetName: targetProfile.nome,
                targetEmail: targetProfile.email,
            }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('[admin-impersonate] Erro:', err);
        if (err instanceof PublicError) {
            return new Response(
                JSON.stringify({ error: err.message }),
                { status: err.status, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }
        return new Response(
            JSON.stringify({ error: 'Erro interno.' }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
    }
});
