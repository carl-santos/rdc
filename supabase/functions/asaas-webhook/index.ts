import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * ASAAS Webhook Receiver
 *
 * Configure the webhook URL in ASAAS Dashboard → Configurações → Webhooks:
 *   URL: https://<project>.supabase.co/functions/v1/asaas-webhook
 *   Events: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE,
 *           PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_REFUNDED,
 *           SUBSCRIPTION_CREATED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_DELETED
 *
 * REQUIRES: ASAAS_WEBHOOK_TOKEN env var (Supabase Secrets) configured to
 * match the "Token de Acesso" defined in ASAAS Dashboard → Webhooks. The
 * function refuses requests if the secret is missing or doesn't match.
 */

// Constantes do produto de créditos (espelham asaas-credits-checkout/index.ts)
const PRICE_PER_PACK = 10;
const SIMS_PER_PACK = 20;

// S-05: comparação de tempo constante para o token do webhook.
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return mismatch === 0;
}

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // Token de webhook é OBRIGATÓRIO. Sem ele, qualquer um pode bater
        // no endpoint e ativar planos / inflar créditos (Cenário D do
        // pentest). Recusa de operação até que esteja configurado.
        const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');
        if (!webhookToken) {
            console.error('[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado — recusando todas as requisições.');
            return new Response('Server misconfigured', { status: 500 });
        }
        const receivedToken = req.headers.get('asaas-access-token') || '';
        if (!timingSafeEqual(receivedToken, webhookToken)) {
            return new Response('Unauthorized', { status: 401 });
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // ASAAS may send either JSON or URL-encoded form data
        const contentType = req.headers.get('content-type') || '';
        let body: any;
        if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = await req.text();
            const params = new URLSearchParams(text);
            const dataParam = params.get('data');
            body = dataParam ? JSON.parse(dataParam) : JSON.parse(decodeURIComponent(text));
        } else {
            body = await req.json();
        }
        const { event, payment } = body;

        console.log('[asaas-webhook] Event:', event, '| Payment ID:', payment?.id, '| Status:', payment?.status);

        // Convert DD/MM/YYYY → YYYY-MM-DD for PostgreSQL
        const toIsoDate = (d: string | null): string | null => {
            if (!d) return null;
            const parts = d.split('/');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return d; // already ISO or null
        };

        // ── Handle payment events ────────────────────────────────────────
        if (payment && payment.id) {
            const externalRef: string = payment.externalReference || '';
            const isCreditsPayment = externalRef.startsWith('credits|');
            const refParts = externalRef.split('|');
            const tenantId = isCreditsPayment ? refParts[1] : (refParts[0] || null);

            if (tenantId) {
                // Anti-replay: capturar status anterior da invoice ANTES do upsert.
                // Se já estava RECEIVED/CONFIRMED, este evento é uma reentrega e
                // não deve disparar de novo a ativação ou o crédito de operações
                // (que somam e não são idempotentes).
                const { data: priorInvoice } = await adminClient
                    .from('billing_invoices')
                    .select('status')
                    .eq('asaas_payment_id', payment.id)
                    .maybeSingle();
                const wasAlreadyConfirmed = !!priorInvoice
                    && ['RECEIVED', 'CONFIRMED'].includes(priorInvoice.status as string);

                // Upsert invoice record
                const invoiceData: Record<string, any> = {
                    tenant_id: tenantId,
                    asaas_payment_id: payment.id,
                    asaas_subscription_id: payment.subscription || null,
                    status: payment.status,
                    value: payment.value,
                    due_date: toIsoDate(payment.dueDate),
                    payment_date: toIsoDate(payment.paymentDate) || null,
                    billing_type: payment.billingType || null,
                    invoice_url: payment.invoiceUrl || null,
                    bank_slip_url: payment.bankSlipUrl || null,
                    description: payment.description || null,
                    updated_at: new Date().toISOString(),
                };

                const { error: upsertError } = await adminClient
                    .from('billing_invoices')
                    .upsert(invoiceData, { onConflict: 'asaas_payment_id' });

                if (upsertError) {
                    console.error('[asaas-webhook] Upsert error:', upsertError);
                }

                // Update tenant status based on event
                if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && !wasAlreadyConfirmed) {

                    if (isCreditsPayment) {
                        // ── Credit purchase confirmed ─────────────────────────
                        const numCredits = parseInt(refParts[2] || '0', 10);

                        // Validar valor pago vs créditos pedidos. Atacante poderia
                        // forjar `externalReference: credits|<tenant>|999999` com
                        // `value: 0.01`. Recomputamos o que o pagamento de fato
                        // cobre e aceitamos no máximo isso.
                        const paidValue = Number(payment.value) || 0;
                        const expectedPacks = Math.floor(paidValue / PRICE_PER_PACK);
                        const expectedCredits = expectedPacks * SIMS_PER_PACK;

                        if (numCredits <= 0 || numCredits > expectedCredits) {
                            console.error(
                                `[asaas-webhook] Créditos rejeitados: tenant=${tenantId} payment=${payment.id} ` +
                                `pedidos=${numCredits} máximo_pelo_valor=${expectedCredits} value=${paidValue}`
                            );
                        } else {
                            await adminClient.rpc('add_operation_credits', {
                                p_tenant_id: tenantId,
                                p_credits: numCredits,
                            });
                            console.log(`[asaas-webhook] Added ${numCredits} operation credits to tenant ${tenantId}`);
                        }

                        // Notify tenant admin
                        const { data: admins } = await adminClient
                            .from('profiles')
                            .select('id')
                            .eq('tenant_id', tenantId)
                            .eq('role', 'tenant_admin');

                        if (admins && admins.length > 0) {
                            for (const admin of admins) {
                                const { data: existing } = await adminClient
                                    .from('notifications')
                                    .select('id')
                                    .eq('user_id', admin.id)
                                    .eq('type', 'credits_purchased')
                                    .eq('reference_id', payment.id)
                                    .limit(1);
                                if (existing && existing.length > 0) continue;
                                await adminClient.from('notifications').insert({
                                    user_id: admin.id,
                                    tenant_id: tenantId,
                                    type: 'credits_purchased',
                                    title: 'Créditos adicionados',
                                    message: `${numCredits} operações extras foram adicionadas à sua conta.`,
                                    link: '/assinatura',
                                    reference_id: payment.id,
                                });
                            }
                        }

                    } else {
                        // ── Subscription payment confirmed ────────────────────
                        const planId = refParts[1] || null;

                        // Validar valor pago vs preço do plano. Atacante poderia
                        // forjar `externalReference: <tenant>|<plano-premium>` com
                        // `value: 0.01` para ativar plano caro pagando ~nada.
                        let planPriceOk = true;
                        if (planId) {
                            const { data: planRow } = await adminClient
                                .from('plans')
                                .select('preco_mensal')
                                .eq('id', planId)
                                .maybeSingle();
                            if (!planRow) {
                                planPriceOk = false;
                                console.error(`[asaas-webhook] Plano não encontrado: planId=${planId} payment=${payment.id}`);
                            } else if (Number(payment.value) < Number(planRow.preco_mensal)) {
                                planPriceOk = false;
                                console.error(
                                    `[asaas-webhook] Valor insuficiente para plano: ` +
                                    `pago=${payment.value} exigido=${planRow.preco_mensal} ` +
                                    `tenant=${tenantId} payment=${payment.id}`
                                );
                            }
                        }

                        if (!planPriceOk) {
                            // Não ativa o tenant nem notifica. Retorna 200 normalmente
                            // no final para evitar replays automáticos do ASAAS.
                            return new Response('OK', { status: 200 });
                        }

                        const updatePayload: Record<string, any> = { status: 'active' };
                        if (planId) updatePayload.plano_id = planId;

                        await adminClient
                            .from('tenants')
                            .update(updatePayload)
                            .eq('id', tenantId);

                        // Notify tenant admins that payment was confirmed / plan is active
                        const { data: admins } = await adminClient
                            .from('profiles')
                            .select('id')
                            .eq('tenant_id', tenantId)
                            .eq('role', 'tenant_admin');

                        if (admins && admins.length > 0) {
                            const amountFmt = `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`;
                            for (const admin of admins) {
                                const { data: existing } = await adminClient
                                    .from('notifications')
                                    .select('id')
                                    .eq('user_id', admin.id)
                                    .eq('type', 'payment_confirmed')
                                    .eq('reference_id', payment.id)
                                    .limit(1);
                                if (existing && existing.length > 0) continue;
                                await adminClient.from('notifications').insert({
                                    user_id: admin.id,
                                    tenant_id: tenantId,
                                    type: 'payment_confirmed',
                                    title: 'Pagamento confirmado',
                                    message: `Seu pagamento de ${amountFmt} foi confirmado. Assinatura ativa!`,
                                    link: '/assinatura',
                                    reference_id: payment.id,
                                });
                            }
                        }
                    }

                } else if (event === 'PAYMENT_OVERDUE') {
                    // Count consecutive overdue invoices for this tenant
                    const { data: overdueInvoices } = await adminClient
                        .from('billing_invoices')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('status', 'OVERDUE')
                        .order('due_date', { ascending: false });

                    const overdueCount = overdueInvoices?.length || 0;

                    // Auto-suspend tenant after 2+ consecutive overdue invoices
                    if (overdueCount >= 2) {
                        await adminClient
                            .from('tenants')
                            .update({ status: 'suspended' })
                            .eq('id', tenantId);

                        console.log(`[asaas-webhook] Tenant ${tenantId} auto-suspended after ${overdueCount} overdue invoices.`);
                    }

                    // Notify tenant admins about overdue payment
                    const { data: admins } = await adminClient
                        .from('profiles')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('role', 'tenant_admin');

                    if (admins && admins.length > 0) {
                        const amountFmt = `R$ ${Number(payment.value).toFixed(2).replace('.', ',')}`;
                        const suspendedMsg = overdueCount >= 2
                            ? ` Sua conta foi suspensa por ter ${overdueCount} faturas em atraso.`
                            : '';
                        for (const admin of admins) {
                            const { data: existing } = await adminClient
                                .from('notifications')
                                .select('id')
                                .eq('user_id', admin.id)
                                .eq('type', 'payment_overdue')
                                .eq('reference_id', payment.id)
                                .limit(1);
                            if (existing && existing.length > 0) continue;
                            await adminClient.from('notifications').insert({
                                user_id: admin.id,
                                tenant_id: tenantId,
                                type: overdueCount >= 2 ? 'account_suspended' : 'payment_overdue',
                                title: overdueCount >= 2 ? 'Conta suspensa' : 'Fatura em atraso',
                                message: `Sua fatura de ${amountFmt} está em atraso.${suspendedMsg} Regularize para manter o acesso à plataforma.`,
                                link: '/assinatura',
                                reference_id: payment.id,
                            });
                        }
                    }

                } else if (event === 'PAYMENT_REFUNDED') {
                    // No action needed; invoice status already updated above

                } else if (event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') {
                    await adminClient
                        .from('tenants')
                        .update({ status: 'suspended', asaas_subscription_id: null })
                        .eq('id', tenantId);

                    // Notify tenant admins that subscription was cancelled
                    const { data: admins } = await adminClient
                        .from('profiles')
                        .select('id')
                        .eq('tenant_id', tenantId)
                        .eq('role', 'tenant_admin');

                    if (admins && admins.length > 0) {
                        const notifs = admins.map((a: any) => ({
                            user_id: a.id,
                            tenant_id: tenantId,
                            type: 'subscription_cancelled',
                            title: 'Assinatura cancelada',
                            message: 'Sua assinatura foi cancelada. O acesso à plataforma será encerrado em breve.',
                            link: '/assinatura',
                        }));
                        await adminClient.from('notifications').insert(notifs);
                    }
                }
            }
        }

        return new Response('OK', { status: 200 });

    } catch (err) {
        console.error('[asaas-webhook] Uncaught error:', err);
        // Return 200 to prevent ASAAS from retrying on our own processing errors
        return new Response('OK', { status: 200 });
    }
});
