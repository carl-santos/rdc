import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

class PublicError extends Error {
    status: number;
    constructor(message: string, status = 400) { super(message); this.status = status; }
}

const ASAAS_BASE_URL = Deno.env.get('ASAAS_SANDBOX') === 'false'
    ? 'https://api.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';

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

/**
 * Actions:
 *  - cancel   → cancel the ASAAS subscription immediately (sets tenant.status = 'canceling')
 *  - discount → apply 50% discount on the subscription for the next cycle (via PUT /subscriptions)
 *  - pause    → postpone next due date by 30 days (via PUT /subscriptions)
 */
serve(async (req) => {
    const cors = getCors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const asaasApiKey = Deno.env.get('ASAAS_API_KEY')!;

        if (!asaasApiKey) throw new PublicError('ASAAS_API_KEY não configurado.');

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new PublicError('Não autorizado.');

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) throw new PublicError('Não autorizado.');

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        let body: { action?: string } = {};
        try {
            body = await req.json();
        } catch {
            throw new PublicError('Corpo da requisição inválido ou ausente.');
        }
        const { action } = body;
        if (!action) throw new PublicError('action é obrigatório (cancel | discount | pause).');

        const { data: profile } = await adminClient
            .from('profiles')
            .select('id, role, tenant_id')
            .eq('id', user.id)
            .single();

        if (!profile) throw new PublicError('Perfil não encontrado.');
        if (profile.role !== 'tenant_admin') throw new PublicError('Apenas administradores podem gerenciar assinaturas.');
        if (!profile.tenant_id) throw new PublicError('Tenant não associado ao perfil. Contate o suporte.');

        const { data: tenant } = await (adminClient
            .from('tenants')
            .select('id, asaas_subscription_id, plano_id')
            .eq('id', profile.tenant_id)
            .single() as any);

        if (!tenant) throw new PublicError('Tenant não encontrado.');
        if (!tenant.asaas_subscription_id) throw new PublicError('Nenhuma assinatura ativa encontrada.');

        const asaasHeaders = {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey,
        };

        const subId: string = tenant.asaas_subscription_id;

        // ── CANCEL ────────────────────────────────────────────────────────────
        if (action === 'cancel') {
            const cancelRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
                method: 'DELETE',
                headers: asaasHeaders,
            });

            if (!cancelRes.ok) {
                const errText = await cancelRes.text();
                const err = errText ? JSON.parse(errText) : {};
                const msg = err.errors?.map((e: any) => e.description).join(', ') || `Falha ao cancelar no ASAAS (status ${cancelRes.status}).`;
                throw new PublicError(msg);
            }

            await adminClient
                .from('tenants')
                .update({ status: 'canceling', asaas_subscription_id: null })
                .eq('id', tenant.id);

            // Notify the tenant admin immediately
            await adminClient.from('notifications').insert({
                user_id: profile.id,
                tenant_id: tenant.id,
                type: 'subscription_cancelled',
                title: 'Assinatura cancelada',
                message: 'Sua assinatura foi cancelada com sucesso. O acesso à plataforma estará disponível até o final do período contratado.',
                link: '/assinatura',
            });

            return new Response(
                JSON.stringify({ success: true, message: 'Assinatura cancelada.' }),
                { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }

        // ── DISCOUNT (50% off next cycle via subscription update) ────────────
        if (action === 'discount') {
            // First fetch the subscription to know the current value
            const subRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
                headers: asaasHeaders,
            });

            if (!subRes.ok) {
                const errText = await subRes.text();
                const err = errText ? JSON.parse(errText) : {};
                const msg = err.errors?.map((e: any) => e.description).join(', ') || 'Falha ao buscar assinatura.';
                throw new PublicError(msg);
            }

            const subData = await subRes.json();
            const originalValue: number = subData.value;
            const discountedValue = Number((originalValue * 0.5).toFixed(2));

            // Apply a fixed discount so that next generated payment gets 50% off
            const updateRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
                method: 'PUT',
                headers: asaasHeaders,
                body: JSON.stringify({
                    discount: {
                        value: discountedValue,
                        dueDateLimitDays: 0,
                        type: 'FIXED',
                    },
                }),
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                const err = errText ? JSON.parse(errText) : {};
                const msg = err.errors?.map((e: any) => e.description).join(', ') || 'Falha ao aplicar desconto.';
                throw new PublicError(msg);
            }

            return new Response(
                JSON.stringify({ success: true, message: 'Desconto de 50% aplicado na próxima fatura.', newValue: discountedValue }),
                { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }

        // ── PAUSE (postpone next due date by 30 days) ────────────────────────
        if (action === 'pause') {
            // Fetch current subscription to get nextDueDate
            const subRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
                headers: asaasHeaders,
            });

            if (!subRes.ok) {
                const errText = await subRes.text();
                const err = errText ? JSON.parse(errText) : {};
                const msg = err.errors?.map((e: any) => e.description).join(', ') || 'Falha ao buscar assinatura.';
                throw new PublicError(msg);
            }

            const subData = await subRes.json();
            const currentNextDue: string = subData.nextDueDate; // format: YYYY-MM-DD

            // Add 30 days
            const nextDueDateMs = new Date(currentNextDue + 'T00:00:00Z').getTime() + 30 * 24 * 60 * 60 * 1000;
            const newNextDueDate = new Date(nextDueDateMs).toISOString().slice(0, 10);

            const updateRes = await fetch(`${ASAAS_BASE_URL}/subscriptions/${subId}`, {
                method: 'PUT',
                headers: asaasHeaders,
                body: JSON.stringify({ nextDueDate: newNextDueDate }),
            });

            if (!updateRes.ok) {
                const errText = await updateRes.text();
                const err = errText ? JSON.parse(errText) : {};
                const msg = err.errors?.map((e: any) => e.description).join(', ') || 'Falha ao pausar assinatura.';
                throw new PublicError(msg);
            }

            return new Response(
                JSON.stringify({ success: true, message: 'Assinatura pausada por 30 dias. Próxima cobrança em ' + newNextDueDate + '.' }),
                { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }

        throw new PublicError(`Ação desconhecida: ${action}`);

    } catch (err) {
        console.error('[asaas-subscription-manage] Erro:', err);
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
