import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

class PublicError extends Error {
    status: number;
    constructor(message: string, status = 400) { super(message); this.status = status; }
}

// Sandbox: https://sandbox.asaas.com/api/v3
// Production: https://api.asaas.com/api/v3
const ASAAS_BASE_URL = Deno.env.get('ASAAS_SANDBOX') === 'false'
    ? 'https://api.asaas.com/api/v3'
    : 'https://sandbox.asaas.com/api/v3';

const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173';
const IS_DEV = SITE_URL.startsWith('http://localhost') || SITE_URL.includes('127.0.0.1');
const ALLOWED_ORIGINS = IS_DEV
    ? [SITE_URL, 'http://localhost:5173', 'http://localhost:5174']
    : [SITE_URL];

// ── Validação de CPF/CNPJ (P2 4.9) ──────────────────────────────────
// Algoritmo dos dígitos verificadores brasileiros. Rejeita strings com tamanho
// errado, todas iguais, ou check digits inválidos antes de chamar o ASAAS.
function isValidCPF(cpf: string): boolean {
    const d = cpf.replace(/\D/g, '');
    if (d.length !== 11) return false;
    if (/^(\d)\1+$/.test(d)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
    let check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== parseInt(d[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
    check = (sum * 10) % 11;
    if (check === 10) check = 0;
    return check === parseInt(d[10]);
}

function isValidCNPJ(cnpj: string): boolean {
    const d = cnpj.replace(/\D/g, '');
    if (d.length !== 14) return false;
    if (/^(\d)\1+$/.test(d)) return false;

    const calc = (length: number): number => {
        const weights = length === 12
            ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        let sum = 0;
        for (let i = 0; i < length; i++) sum += parseInt(d[i]) * weights[i];
        const rem = sum % 11;
        return rem < 2 ? 0 : 11 - rem;
    };

    return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
}

function isValidCpfCnpj(s: string): boolean {
    const d = s.replace(/\D/g, '');
    if (d.length === 11) return isValidCPF(d);
    if (d.length === 14) return isValidCNPJ(d);
    return false;
}

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
        const asaasApiKey = Deno.env.get('ASAAS_API_KEY')!;

        if (!asaasApiKey) throw new PublicError('ASAAS_API_KEY não configurado.');

        // Validate the user JWT
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

        const { plan_id, cpf_cnpj: cpfCnpjFromBody } = await req.json();
        if (!plan_id) throw new PublicError('plan_id é obrigatório.');

        // Get caller's profile and tenant
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('id, role, tenant_id, email')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) throw new PublicError('Perfil não encontrado.');
        if (profile.role !== 'tenant_admin') throw new PublicError('Apenas administradores podem gerenciar assinaturas.');
        if (!profile.tenant_id) throw new PublicError('Tenant não associado ao perfil.');

        // Get tenant data
        const { data: tenant, error: tenantError } = await (adminClient
            .from('tenants')
            .select('id, nome_fantasia, razao_social, cpf_cnpj, telefone, asaas_customer_id, asaas_subscription_id, plano_id')
            .eq('id', profile.tenant_id)
            .single() as any);

        if (tenantError || !tenant) throw new PublicError('Tenant não encontrado.');

        // If CPF/CNPJ was provided in the request, persist it to the tenant record
        const resolvedCpfCnpj = (cpfCnpjFromBody || tenant.cpf_cnpj || '').replace(/\D/g, '');
        if (resolvedCpfCnpj && !isValidCpfCnpj(resolvedCpfCnpj)) {
            throw new PublicError('CPF/CNPJ inválido. Verifique os dígitos e tente novamente.');
        }
        if (cpfCnpjFromBody && cpfCnpjFromBody !== tenant.cpf_cnpj) {
            await adminClient
                .from('tenants')
                .update({ cpf_cnpj: cpfCnpjFromBody })
                .eq('id', tenant.id);
        }

        // Get the requested plan
        const { data: plan, error: planError } = await (adminClient
            .from('plans')
            .select('id, nome, preco_mensal')
            .eq('id', plan_id)
            .single() as any);

        if (planError || !plan) throw new PublicError('Plano não encontrado.');

        const asaasHeaders = {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey,
        };

        // ── STEP 1: Create or update ASAAS customer ─────────────────────────
        let asaasCustomerId: string = tenant.asaas_customer_id;

        const customerName = tenant.nome_fantasia || tenant.razao_social || 'Cliente';
        const customerBody: Record<string, string> = {
            name: customerName,
            email: profile.email || user.email || '',
            externalReference: tenant.id,
        };
        if (resolvedCpfCnpj) customerBody.cpfCnpj = resolvedCpfCnpj;
        if (tenant.telefone) customerBody.phone = tenant.telefone.replace(/\D/g, '');

        if (!asaasCustomerId) {
            // Create new customer
            const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
                method: 'POST',
                headers: asaasHeaders,
                body: JSON.stringify(customerBody),
            });

            const customer = await customerRes.json();
            if (!customerRes.ok) {
                const errMsg = customer.errors?.map((e: any) => e.description).join(', ')
                    || 'Falha ao criar cliente no ASAAS.';
                throw new PublicError(errMsg);
            }

            asaasCustomerId = customer.id;
            await adminClient
                .from('tenants')
                .update({ asaas_customer_id: asaasCustomerId })
                .eq('id', tenant.id);
        } else if (resolvedCpfCnpj) {
            // Customer already exists — update CPF/CNPJ in ASAAS (may have been missing before)
            await fetch(`${ASAAS_BASE_URL}/customers/${asaasCustomerId}`, {
                method: 'PUT',
                headers: asaasHeaders,
                body: JSON.stringify(customerBody),
            });
        }

        // ── STEP 2: Cancel existing subscription if changing plan ─────────
        if (tenant.asaas_subscription_id && tenant.plano_id !== plan_id) {
            const cancelRes = await fetch(
                `${ASAAS_BASE_URL}/subscriptions/${tenant.asaas_subscription_id}/cancel`,
                { method: 'DELETE', headers: asaasHeaders }
            );
            if (!cancelRes.ok) {
                console.warn('[asaas-checkout] Could not cancel old subscription:', tenant.asaas_subscription_id);
            }
        }

        // If same plan and already has subscription, just return existing payment link
        if (tenant.asaas_subscription_id && tenant.plano_id === plan_id) {
            const paymentsRes = await fetch(
                `${ASAAS_BASE_URL}/payments?subscription=${tenant.asaas_subscription_id}&status=PENDING`,
                { headers: asaasHeaders }
            );
            const payments = await paymentsRes.json();
            const pending = payments.data?.[0];
            return new Response(
                JSON.stringify({
                    success: true,
                    subscriptionId: tenant.asaas_subscription_id,
                    paymentLink: pending?.invoiceUrl || null,
                    alreadySubscribed: true,
                }),
                { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
            );
        }

        // ── STEP 3: Create new subscription ──────────────────────────────
        // nextDueDate: tomorrow (gives 1 day grace period)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextDueDate = tomorrow.toISOString().slice(0, 10);

        const subRes = await fetch(`${ASAAS_BASE_URL}/subscriptions`, {
            method: 'POST',
            headers: asaasHeaders,
            body: JSON.stringify({
                customer: asaasCustomerId,
                billingType: 'BOLETO',      // BOLETO is universally supported; customer can also request PIX
                value: plan.preco_mensal,
                nextDueDate,
                cycle: 'MONTHLY',
                description: `Assinatura SaaS Foundation — Plano ${plan.nome}`,
                externalReference: `${tenant.id}|${plan.id}`,
                maxPayments: 0,             // indefinite
            }),
        });

        const subscription = await subRes.json();
        if (!subRes.ok) {
            const errMsg = subscription.errors?.map((e: any) => e.description).join(', ')
                || 'Falha ao criar assinatura no ASAAS.';
            throw new PublicError(errMsg);
        }

        // ── STEP 4: Persist subscription ID only — plano_id is set by webhook on payment confirmation
        await adminClient
            .from('tenants')
            .update({ asaas_subscription_id: subscription.id })
            .eq('id', tenant.id);

        // ── STEP 5: Fetch first payment link ─────────────────────────────
        let paymentLink: string | null = null;
        const paymentsRes = await fetch(
            `${ASAAS_BASE_URL}/payments?subscription=${subscription.id}`,
            { headers: asaasHeaders }
        );
        const payments = await paymentsRes.json();
        const firstPayment = payments.data?.[0];
        paymentLink = firstPayment?.invoiceUrl || null;

        return new Response(
            JSON.stringify({
                success: true,
                subscriptionId: subscription.id,
                paymentLink,
                paymentId: firstPayment?.id || null,
            }),
            { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('[asaas-checkout] Erro:', err);
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
