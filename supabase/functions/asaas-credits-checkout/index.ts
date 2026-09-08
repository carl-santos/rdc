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

const PRICE_PER_PACK = 10;      // R$ 10 per pack
const SIMS_PER_PACK = 20;       // 20 operations per pack
const MAX_PACKS = 10;           // max R$ 100 (10 packs)

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

        // Validate user JWT
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

        const { packs } = await req.json();
        const numPacks = parseInt(packs, 10);
        if (!numPacks || numPacks < 1 || numPacks > MAX_PACKS) {
            throw new PublicError(`Quantidade inválida. Selecione entre 1 e ${MAX_PACKS} pacotes.`);
        }

        // Get caller's profile and tenant
        const { data: profile } = await adminClient
            .from('profiles')
            .select('id, role, tenant_id, email')
            .eq('id', user.id)
            .single();

        if (!profile) throw new PublicError('Perfil não encontrado.');
        if (profile.role !== 'tenant_admin') throw new PublicError('Apenas administradores podem comprar créditos.');
        if (!profile.tenant_id) throw new PublicError('Tenant não associado ao perfil.');

        // Get tenant data
        const { data: tenant } = await (adminClient
            .from('tenants')
            .select('id, nome_fantasia, razao_social, cpf_cnpj, telefone, asaas_customer_id, status')
            .eq('id', profile.tenant_id)
            .single() as any);

        if (!tenant) throw new PublicError('Tenant não encontrado.');
        if (tenant.status !== 'active') throw new PublicError('Sua assinatura precisa estar ativa para comprar créditos extras.');

        const asaasHeaders = {
            'Content-Type': 'application/json',
            'access_token': asaasApiKey,
        };

        // Ensure ASAAS customer exists
        let asaasCustomerId: string = tenant.asaas_customer_id;
        if (!asaasCustomerId) {
            const customerBody: Record<string, string> = {
                name: tenant.nome_fantasia || tenant.razao_social || 'Cliente',
                email: profile.email || user.email || '',
                externalReference: tenant.id,
            };
            if (tenant.cpf_cnpj) customerBody.cpfCnpj = tenant.cpf_cnpj.replace(/\D/g, '');

            const customerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
                method: 'POST',
                headers: asaasHeaders,
                body: JSON.stringify(customerBody),
            });
            const customer = await customerRes.json();
            if (!customerRes.ok) {
                throw new PublicError(customer.errors?.map((e: any) => e.description).join(', ') || 'Falha ao criar cliente.');
            }
            asaasCustomerId = customer.id;
            await adminClient
                .from('tenants')
                .update({ asaas_customer_id: asaasCustomerId })
                .eq('id', tenant.id);
        }

        // Create one-time payment (not subscription)
        const totalValue = numPacks * PRICE_PER_PACK;
        const totalCredits = numPacks * SIMS_PER_PACK;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dueDate = tomorrow.toISOString().slice(0, 10);

        const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
            method: 'POST',
            headers: asaasHeaders,
            body: JSON.stringify({
                customer: asaasCustomerId,
                billingType: 'UNDEFINED',   // let customer choose payment method
                value: totalValue,
                dueDate,
                description: `SaaS Foundation — ${totalCredits} operações extras`,
                externalReference: `credits|${tenant.id}|${totalCredits}`,
            }),
        });

        const paymentData = await paymentRes.json();
        if (!paymentRes.ok) {
            const errMsg = paymentData.errors?.map((e: any) => e.description).join(', ')
                || 'Falha ao criar cobrança.';
            throw new PublicError(errMsg);
        }

        return new Response(JSON.stringify({
            success: true,
            paymentLink: paymentData.invoiceUrl,
            paymentId: paymentData.id,
            totalValue,
            totalCredits,
        }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

    } catch (err) {
        console.error('[asaas-credits-checkout] Erro:', err);
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
