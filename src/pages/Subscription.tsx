import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { Database } from '../types/database';
import { useTerminology } from '../hooks/useTerminology';

type Plan = Database['public']['Tables']['plans']['Row'];
type Usage = Database['public']['Tables']['usage_tracking']['Row'];

interface Invoice {
    id: string;
    asaas_payment_id: string;
    status: string;
    value: number;
    due_date: string;
    payment_date: string | null;
    billing_type: string | null;
    invoice_url: string | null;
    bank_slip_url: string | null;
    description: string | null;
    created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    PENDING:   { label: 'Pendente',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' },
    RECEIVED:  { label: 'Pago',      color: 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
    CONFIRMED: { label: 'Confirmado',color: 'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
    OVERDUE:   { label: 'Em atraso', color: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
    REFUNDED:  { label: 'Estornado', color: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
    CANCELED:  { label: 'Cancelado', color: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
};

const BILLING_TYPE_LABEL: Record<string, string> = {
    BOLETO:      'Boleto',
    CREDIT_CARD: 'Cartão de Crédito',
    PIX:         'PIX',
    UNDEFINED:   '—',
};

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
}

function formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const Subscription = () => {
    const { tenant, profile } = useAuth();
    const terminology = useTerminology();

    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [manageLoading, setManageLoading] = useState(false);

    // Extra credits state
    const [creditPacks, setCreditPacks] = useState(1);
    const [creditLoading, setCreditLoading] = useState(false);
    const [simRemaining, setSimRemaining] = useState<{ limite: number; utilizadas: number; creditos_extra: number; creditos_utilizados: number; restantes: number } | null>(null);

    const isTenantAdmin = profile?.role === 'tenant_admin';

    // Plan migration modal
    const [showMigrationModal, setShowMigrationModal] = useState(false);
    const prevPlanoIdRef = useRef<string | undefined>(undefined);

    // Cancel flow
    type CancelStep = 'idle' | 'reason' | 'retention' | 'thank-you' | 'canceled';
    const [cancelStep, setCancelStep] = useState<CancelStep>('idle');
    const [cancelReason, setCancelReason] = useState('');
    const [cancelReasonOther, setCancelReasonOther] = useState('');
    const [retentionChoice, setRetentionChoice] = useState<string | null>(null);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [confirmingCancel, setConfirmingCancel] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (tenant?.id) {
            fetchSubscriptionData();
        }
    }, [tenant?.id]);

    useEffect(() => {
        const newId = (tenant as any)?.plano_id;
        if (prevPlanoIdRef.current !== undefined && prevPlanoIdRef.current && newId && prevPlanoIdRef.current !== newId) {
            setShowMigrationModal(true);
        }
        prevPlanoIdRef.current = newId;
    }, [(tenant as any)?.plano_id]);

    const fetchSubscriptionData = async () => {
        setLoading(true);
        try {
            const mesRef = new Date().toISOString().slice(0, 7) + '-01';

            const [plansRes, usageRes, invoicesRes] = await Promise.all([
                (supabase.from('plans').select('*').order('preco_mensal', { ascending: true }) as any),
                (supabase
                    .from('usage_tracking')
                    .select('*')
                    .eq('tenant_id', tenant!.id as any)
                    .eq('mes_referencia', mesRef as any)
                    .maybeSingle() as any),
                ((supabase as any)
                    .from('billing_invoices')
                    .select('*')
                    .eq('tenant_id', tenant!.id)
                    .order('due_date', { ascending: false })
                    .limit(20)),
            ]);

            if (plansRes.data) setPlans(plansRes.data as Plan[]);
            if (usageRes.data) setUsage(usageRes.data as Usage);
            if (invoicesRes.data) setInvoices(invoicesRes.data as Invoice[]);

            // Cota restante: limite do plano + creditos extras - consumo registrado.
            const usageRow = usageRes.data as Usage | null;
            const planLimit = (plansRes.data as Plan[] || []).find(p => p.id === tenant?.plano_id)?.limite_operacoes_mes ?? 0;
            const cred = (usageRow as any)?.creditos_extra ?? 0;
            const credUtil = (usageRow as any)?.creditos_extra_utilizados ?? 0;
            const util = usageRow?.operacoes_utilizadas ?? 0;
            setSimRemaining({
                limite: planLimit,
                utilizadas: util,
                creditos_extra: cred,
                creditos_utilizados: credUtil,
                restantes: (planLimit + cred - credUtil) - util,
            });

            if (tenant?.plano_id) {
                const { data: planData } = await (supabase
                    .from('plans')
                    .select('*')
                    .eq('id', tenant.plano_id as any)
                    .single() as any);
                if (planData) setCurrentPlan(planData as Plan);
            }
        } catch (err) {
            console.error('[Subscription] fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Open latest pending invoice to allow payment management
    const handleManagePayment = async () => {
        setManageLoading(true);
        try {
            const pending = invoices.find(i => i.status === 'PENDING' || i.status === 'OVERDUE');
            if (pending?.invoice_url) {
                window.open(pending.invoice_url, '_blank');
            } else {
                const any = invoices[0];
                if (any?.invoice_url) window.open(any.invoice_url, '_blank');
                else setCheckoutError('Nenhuma fatura encontrada. Selecione um plano abaixo.');
            }
        } finally {
            setManageLoading(false);
        }
    };

    const handleBuyCredits = async () => {
        setCreditLoading(true);
        setCheckoutError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada. Faça login novamente.');

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-credits-checkout`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ packs: creditPacks }),
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao processar compra de créditos.');

            if (data.paymentLink) {
                window.open(data.paymentLink, '_blank');
                setTimeout(fetchSubscriptionData, 3000);
            }
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Erro interno.');
        } finally {
            setCreditLoading(false);
        }
    };

    const handleSubscribe = async (planId: string) => {
        setCheckoutError(null);
        setCheckoutLoading(planId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada. Faça login novamente.');

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-checkout`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ plan_id: planId }),
                }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao processar assinatura.');

            if (data.alreadySubscribed) {
                setCheckoutError('Você já está neste plano. Use "Gerenciar Pagamento" para ver faturas em aberto.');
            } else if (data.paymentLink) {
                window.open(data.paymentLink, '_blank');
                // Refresh after a short delay to pick up plan change
                setTimeout(fetchSubscriptionData, 2000);
            } else {
                setCheckoutError('Assinatura criada, mas o link de pagamento não foi gerado. Tente "Gerenciar Pagamento".');
                setTimeout(fetchSubscriptionData, 2000);
            }
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Erro interno.');
        } finally {
            setCheckoutLoading(null);
        }
    };

    const callManageFunction = async (action: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sessão expirada. Faça login novamente.');
        const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-subscription-manage`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ action }),
            }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao processar solicitação.');
        return data;
    };

    const handleKeepSubscription = async () => {
        if (!retentionChoice) return;
        setCancelLoading(true);
        try {
            if (retentionChoice === 'discount') {
                await callManageFunction('discount');
            } else if (retentionChoice === 'pause') {
                await callManageFunction('pause');
            }
            // 'downgrade' is handled by the user selecting a cheaper plan on this page
            setCancelStep('thank-you');
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Erro ao processar retenção.');
            setCancelStep('idle');
        } finally {
            setCancelLoading(false);
        }
    };

    const handleConfirmCancel = async () => {
        setConfirmingCancel(true);
        try {
            await callManageFunction('cancel');
            setCancelStep('canceled');
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Erro ao cancelar assinatura.');
            setCancelStep('idle');
        } finally {
            setConfirmingCancel(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout title="Carregando Assinatura...">
                <div className="p-12 flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
            </DashboardLayout>
        );
    }

    const clientUsagePercent = currentPlan
        ? Math.min(Math.round(((usage?.clientes_cadastrados || 0) / currentPlan.limite_clientes) * 100), 100)
        : 0;
    const simTotal = simRemaining
        ? simRemaining.limite + simRemaining.creditos_extra - simRemaining.creditos_utilizados
        : (currentPlan?.limite_operacoes_mes || 0);
    const simUsed = simRemaining ? simRemaining.utilizadas : (usage?.operacoes_utilizadas || 0);
    const operationUsagePercent = simTotal > 0
        ? Math.min(Math.round((simUsed / simTotal) * 100), 100)
        : 0;

    const hasActiveSubscription = !!(tenant as any)?.asaas_subscription_id;
    const latestOverdue = invoices.find(i => i.status === 'OVERDUE');

    return (
        <DashboardLayout title="Gestão de Assinatura">
            <div className="max-w-[1240px] mx-auto w-full px-4 py-6 space-y-12 text-left animate-in fade-in duration-500">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-5xl font-black leading-tight tracking-tighter uppercase italic">Gestão de Assinatura</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Gerencie o plano da sua empresa, monitore limites e faturas.</p>
                    </div>
                    {isTenantAdmin && (
                        <div className="flex flex-col gap-3 items-end">
                            <button
                                onClick={handleManagePayment}
                                disabled={manageLoading}
                                className="flex items-center justify-center rounded-2xl h-14 px-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-black uppercase tracking-[0.2em] border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all shadow-xl shadow-slate-200/20 dark:shadow-none group disabled:opacity-60"
                            >
                                {manageLoading
                                    ? <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary mr-3" />
                                    : <span className="material-symbols-outlined mr-3 text-xl transition-transform group-hover:scale-110">credit_card</span>
                                }
                                Gerenciar Pagamento
                            </button>
                            {hasActiveSubscription && (
                                <button
                                    onClick={() => setCancelStep('reason')}
                                    className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-base">cancel</span>
                                    Cancelar Assinatura
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Overdue alert */}
                {latestOverdue && (
                    <div className="flex items-center gap-4 p-5 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <span className="material-symbols-outlined text-red-500 text-2xl flex-shrink-0">warning</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-red-700 dark:text-red-400 text-sm uppercase tracking-wide">Fatura em atraso</p>
                            <p className="text-xs text-red-600 dark:text-red-500 font-medium mt-0.5">
                                Fatura de R$ {formatCurrency(latestOverdue.value)} vencida em {formatDate(latestOverdue.due_date)}.
                                Regularize para manter o acesso à plataforma.
                            </p>
                        </div>
                        {latestOverdue.invoice_url && (
                            <a href={latestOverdue.invoice_url} target="_blank" rel="noreferrer"
                                className="flex-shrink-0 px-5 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors">
                                Pagar Agora
                            </a>
                        )}
                    </div>
                )}

                {/* Checkout error */}
                {checkoutError && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <span className="material-symbols-outlined text-red-500 text-xl flex-shrink-0 mt-0.5">error</span>
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">{checkoutError}</p>
                        <button onClick={() => setCheckoutError(null)} className="ml-auto text-red-400 hover:text-red-600">
                            <span className="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>
                )}

                {/* Current plan + usage */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Current Plan Card */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between relative overflow-hidden group min-h-[300px]">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                            <span className="material-symbols-outlined text-[12rem]">verified</span>
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-8">
                                <span className="px-5 py-2 bg-primary/10 text-primary text-[10px] font-black rounded-full uppercase tracking-[0.2em] border border-primary/20">
                                    Plano Atual
                                </span>
                                <span className={`flex items-center text-xs font-black uppercase tracking-widest ${
                                    (tenant as any)?.status === 'active' ? 'text-primary' :
                                    (tenant as any)?.status === 'canceling' ? 'text-orange-500' :
                                    (tenant as any)?.status === 'suspended' ? 'text-red-500' : 'text-yellow-500'
                                }`}>
                                    <span className="material-symbols-outlined text-sm mr-2">
                                        {(tenant as any)?.status === 'active' ? 'check_circle' :
                                         (tenant as any)?.status === 'canceling' ? 'cancel' :
                                         (tenant as any)?.status === 'suspended' ? 'block' : 'schedule'}
                                    </span>
                                    {(tenant as any)?.status === 'active' ? 'Ativo' :
                                     (tenant as any)?.status === 'canceling' ? 'Em cancelamento' :
                                     (tenant as any)?.status === 'suspended' ? 'Suspenso' : 'Pendente'}
                                </span>
                            </div>
                            <h3 className="text-4xl font-black mb-2 uppercase tracking-tighter italic">
                                {currentPlan?.nome || 'Nenhum'}
                            </h3>
                            {invoices.length > 0 && (
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                    Última fatura:{' '}
                                    <span className="text-slate-900 dark:text-white">
                                        {formatDate(invoices[0].due_date)}
                                    </span>
                                </p>
                            )}
                        </div>
                        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 relative z-10">
                            <p className="text-4xl font-black">
                                R$ {formatCurrency(currentPlan?.preco_mensal || 0)}
                                <span className="text-sm font-bold text-slate-400 tracking-normal ml-1">/mês</span>
                            </p>
                        </div>
                    </div>

                    {/* Usage Tracker */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-10 relative overflow-hidden">
                        <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-3 text-xs uppercase tracking-[0.3em]">
                            <span className="material-symbols-outlined text-primary p-2 bg-primary/10 rounded-xl">analytics</span>
                            Consumo de Recursos
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-tight italic">{terminology.clients} Ativos</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                            {usage?.clientes_cadastrados || 0} de {currentPlan?.limite_clientes || 0} cadastrados
                                        </p>
                                    </div>
                                    <p className="text-lg font-black text-primary">{clientUsagePercent}%</p>
                                </div>
                                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-1">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(19,236,91,0.3)]"
                                        style={{ width: `${clientUsagePercent}%` }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-tight italic">Operações de Evolução</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                            {simUsed} de {simTotal} geradas
                                            {simRemaining && simRemaining.creditos_extra > 0 && (
                                                <span className="text-primary ml-1">(+{simRemaining.creditos_extra - simRemaining.creditos_utilizados} extras)</span>
                                            )}
                                        </p>
                                    </div>
                                    <p className={`text-lg font-black ${operationUsagePercent >= 90 ? 'text-red-500' : 'text-primary'}`}>{operationUsagePercent}%</p>
                                </div>
                                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-1">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${
                                            operationUsagePercent >= 90
                                                ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                                : operationUsagePercent >= 75
                                                    ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                                    : 'bg-primary shadow-[0_0_15px_rgba(19,236,91,0.3)]'
                                        }`}
                                        style={{ width: `${operationUsagePercent}%` }}
                                    />
                                </div>
                                {operationUsagePercent >= 90 && (
                                    <p className="text-xs text-red-500 font-bold flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">warning</span>
                                        {simUsed >= simTotal
                                            ? 'Limite atingido! Adquira créditos extras abaixo para continuar processando.'
                                            : 'Você está próximo do limite de operações deste mês.'
                                        }
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plans Selection */}
                <section className="space-y-10 pt-10">
                    <div className="text-center space-y-3">
                        <h2 className="text-4xl font-black uppercase tracking-tighter italic">Evolua sua Prática</h2>
                        <p className="text-slate-500 max-w-lg mx-auto font-medium text-lg leading-relaxed">
                            Escolha o plano que melhor se adapta ao volume de atendimentos da sua empresa.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {plans.map((p) => {
                            const isCurrent = (tenant as any)?.plano_id === p.id;
                            const isLoading = checkoutLoading === p.id;
                            return (
                                <div
                                    key={p.id}
                                    className={`bg-white dark:bg-slate-900 p-10 rounded-[3rem] border transition-all relative flex flex-col group ${isCurrent
                                        ? 'border-primary ring-[12px] ring-primary/5 scale-105 shadow-2xl z-10'
                                        : 'border-slate-100 dark:border-slate-800 hover:border-primary/40 hover:shadow-xl hover:-translate-y-2 duration-300'
                                        }`}
                                >
                                    {isCurrent && (
                                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-slate-950 text-[10px] font-black uppercase tracking-[0.3em] px-8 py-2.5 rounded-full shadow-lg z-20">
                                            Seu Plano
                                        </div>
                                    )}
                                    <h4 className="text-2xl font-black mb-6 uppercase tracking-tighter italic group-hover:text-primary transition-colors">{p.nome}</h4>
                                    <div className="mb-8 flex items-baseline gap-2">
                                        <span className="text-5xl font-black tracking-tighter italic">
                                            R$ {p.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                        </span>
                                        <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">/mês</span>
                                    </div>
                                    <div className="mb-8 flex-1 flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                        <span className="material-symbols-outlined text-primary text-lg">monitoring</span>
                                        <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                                            {p.limite_operacoes_mes > 1000 ? 'Operações Ilimitadas' : `${p.limite_operacoes_mes} Operações/mês`}
                                        </span>
                                    </div>
                                    <button
                                        disabled={isCurrent || isLoading || !isTenantAdmin}
                                        onClick={() => handleSubscribe(p.id)}
                                        className={`w-full py-5 px-4 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-2 ${isCurrent || !isTenantAdmin
                                            ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-100 dark:border-slate-700'
                                            : 'bg-primary text-slate-950 shadow-2xl shadow-primary/30 hover:brightness-110 hover:-translate-y-1'
                                            }`}
                                    >
                                        {isLoading && <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-950" />}
                                        {isCurrent
                                            ? 'Seleção Atual'
                                            : isLoading
                                                ? 'Aguarde...'
                                                : hasActiveSubscription
                                                    ? `Migrar para ${p.nome}`
                                                    : `Assinar Plano ${p.nome}`}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {!isTenantAdmin && (
                        <p className="text-center text-xs text-slate-400 font-medium">
                            Apenas o administrador da conta pode alterar o plano.
                        </p>
                    )}
                </section>

                {/* Extra Credits Purchase */}
                {isTenantAdmin && (tenant as any)?.status === 'active' && (
                    <section className="space-y-8 pt-10">
                        <div className="text-center space-y-3">
                            <h2 className="text-4xl font-black uppercase tracking-tighter italic">Créditos Extras</h2>
                            <p className="text-slate-500 max-w-lg mx-auto font-medium text-lg leading-relaxed">
                                Precisa de mais operações? Adicione pacotes avulsos ao mês corrente.
                            </p>
                        </div>

                        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                            <div className="flex items-center gap-4 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                                <span className="material-symbols-outlined text-primary text-3xl">bolt</span>
                                <div>
                                    <p className="font-black text-sm text-slate-900 dark:text-white">R$ 10,00 = 20 operações</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Válido para o mês corrente</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block">
                                    Quantidade de pacotes
                                </label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setCreditPacks(p => Math.max(1, p - 1))}
                                        disabled={creditPacks <= 1}
                                        className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-30"
                                    >
                                        -
                                    </button>
                                    <div className="flex-1 text-center">
                                        <p className="text-5xl font-black tracking-tighter italic text-slate-900 dark:text-white">{creditPacks}</p>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">
                                            {creditPacks === 1 ? 'pacote' : 'pacotes'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setCreditPacks(p => Math.min(10, p + 1))}
                                        disabled={creditPacks >= 10}
                                        className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-30"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                <div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">{creditPacks * 20} operações</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Adicionadas ao seu saldo</p>
                                </div>
                                <p className="text-3xl font-black tracking-tighter italic text-slate-900 dark:text-white">
                                    R$ {(creditPacks * 10).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            <button
                                onClick={handleBuyCredits}
                                disabled={creditLoading}
                                className="w-full py-5 px-4 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-2 bg-primary text-slate-950 shadow-2xl shadow-primary/30 hover:brightness-110 hover:-translate-y-1 disabled:opacity-50"
                            >
                                {creditLoading && <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-950" />}
                                {creditLoading ? 'Processando...' : 'Comprar Créditos'}
                            </button>

                            <p className="text-center text-[10px] text-slate-400 font-medium">
                                O pagamento é processado via ASAAS. Os créditos serão ativados após confirmação do pagamento.
                            </p>
                        </div>
                    </section>
                )}

                {/* Billing History */}
                <section className="space-y-8 pt-10 pb-20">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <h2 className="text-3xl font-black uppercase tracking-tighter italic">Histórico de Faturas</h2>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                            Atualizado automaticamente via ASAAS
                        </span>
                    </div>

                    {invoices.length === 0 ? (
                        <div className="py-20 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-4">
                            <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 font-thin">receipt_long</span>
                            <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">Nenhuma fatura registrada ainda.</p>
                            <p className="text-slate-400 text-xs font-medium">As faturas aparecerão aqui após a primeira assinatura.</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-[3rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/20 dark:shadow-none">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Vencimento</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hidden md:table-cell">Descrição</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hidden sm:table-cell">Forma</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Valor</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Status</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Link</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {invoices.map((inv) => {
                                        const statusInfo = STATUS_LABEL[inv.status] || { label: inv.status, color: 'bg-slate-100 text-slate-500 border-slate-200' };
                                        return (
                                            <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                                                <td className="px-8 py-5 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight whitespace-nowrap">
                                                    {formatDate(inv.due_date)}
                                                    {inv.payment_date && (
                                                        <p className="text-[10px] text-slate-400 font-medium normal-case tracking-normal">
                                                            Pago em {formatDate(inv.payment_date)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 text-sm font-medium text-slate-500 hidden md:table-cell">
                                                    {inv.description || '—'}
                                                </td>
                                                <td className="px-8 py-5 text-xs font-bold text-slate-500 hidden sm:table-cell uppercase tracking-wide">
                                                    {BILLING_TYPE_LABEL[inv.billing_type || ''] || inv.billing_type || '—'}
                                                </td>
                                                <td className="px-8 py-5 text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter italic whitespace-nowrap">
                                                    R$ {formatCurrency(inv.value)}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusInfo.color}`}>
                                                        {(inv.status === 'RECEIVED' || inv.status === 'CONFIRMED') && (
                                                            <span className="size-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                                                        )}
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    {inv.invoice_url ? (
                                                        <a
                                                            href={inv.invoice_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-primary transition-all hover:scale-110 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-primary/10"
                                                            title="Abrir fatura"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">open_in_new</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-700 text-lg px-2">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {/* Plan Migration Success Modal */}
            {showMigrationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl text-center">
                        <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-primary text-5xl">check_circle</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-3">
                            Migração de Plano realizada com sucesso!
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
                            Seu novo plano <span className="font-black text-slate-900 dark:text-white">{currentPlan?.nome}</span> já está ativo. Aproveite!
                        </p>
                        <button
                            onClick={() => setShowMigrationModal(false)}
                            className="w-full py-4 rounded-[1.5rem] bg-primary text-slate-950 font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            )}

            {/* Cancel Flow — Modal 1: Reason */}
            {cancelStep === 'reason' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Por que você está cancelando?</h2>
                        <p className="text-xs text-slate-400 font-medium mb-8 uppercase tracking-widest">Sua resposta nos ajuda a melhorar.</p>
                        <div className="space-y-3 mb-8">
                            {['Caro', 'Não usei o suficiente', 'Não gostei dos resultados', 'Outro'].map((reason) => (
                                <label key={reason} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${cancelReason === reason ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                                    <input
                                        type="radio"
                                        name="cancelReason"
                                        value={reason}
                                        checked={cancelReason === reason}
                                        onChange={() => setCancelReason(reason)}
                                        className="accent-primary"
                                    />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{reason}</span>
                                </label>
                            ))}
                            {cancelReason === 'Outro' && (
                                <textarea
                                    value={cancelReasonOther}
                                    onChange={e => setCancelReasonOther(e.target.value)}
                                    placeholder="Descreva o motivo..."
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary resize-none"
                                />
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { if (cancelReason) setCancelStep('retention'); }}
                                disabled={!cancelReason}
                                className="flex-1 py-4 rounded-[1.5rem] bg-slate-900 dark:bg-slate-700 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all disabled:opacity-40"
                            >
                                Continuar
                            </button>
                            <button
                                onClick={() => setCancelStep('idle')}
                                className="flex-1 py-4 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] hover:border-slate-300 transition-all"
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Flow — Modal 2: Retention offers */}
            {cancelStep === 'retention' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl my-8">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Podemos te ajudar com uma das opções abaixo à sua escolha.</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Você teria interesse em manter a assinatura?</p>
                        <div className="space-y-3 mb-8">
                            {[
                                { id: 'discount', icon: 'local_offer', label: '50% off por 1 mês', desc: 'Metade do valor na próxima cobrança.' },
                                { id: 'pause', icon: 'pause_circle', label: 'Pausar por 30 dias', desc: 'Após o decurso do seu prazo atual de uso.' },
                                { id: 'downgrade', icon: 'arrow_downward', label: 'Migrar para um plano mais barato', desc: 'Mantenha o acesso com um custo menor.' },
                            ].map(opt => (
                                <label key={opt.id} className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${retentionChoice === opt.id ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                                    <input
                                        type="radio"
                                        name="retention"
                                        value={opt.id}
                                        checked={retentionChoice === opt.id}
                                        onChange={() => setRetentionChoice(opt.id)}
                                        className="accent-primary mt-0.5"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-primary text-base">{opt.icon}</span>
                                            <span className="text-sm font-black text-slate-900 dark:text-white">{opt.label}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium">{opt.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500 text-center mb-6 font-medium leading-relaxed">
                            Se quiser manter sua assinatura escolha uma das opções acima e clique no botão <span className="font-black text-slate-700 dark:text-slate-300">Continuar com a Assinatura</span>
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleKeepSubscription}
                                disabled={!retentionChoice || cancelLoading}
                                className="flex-1 py-4 rounded-[1.5rem] bg-primary text-slate-950 font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {cancelLoading && retentionChoice && <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-slate-900" />}
                                Continuar com a Assinatura
                            </button>
                            <button
                                onClick={handleConfirmCancel}
                                disabled={confirmingCancel || cancelLoading}
                                className="flex-1 py-4 rounded-[1.5rem] border border-red-200 dark:border-red-900 text-red-500 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {confirmingCancel && <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-red-500" />}
                                Cancelar a Assinatura
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Flow — Thank you (kept subscription) */}
            {cancelStep === 'thank-you' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl text-center">
                        <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-primary text-5xl">favorite</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-3">
                            Obrigado por continuar com a assinatura!!
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">
                            {retentionChoice === 'discount' && 'O desconto de 50% foi aplicado na sua próxima fatura. Aproveite!'}
                            {retentionChoice === 'pause' && 'Sua próxima cobrança foi cancelada. Aproveite mais 30 dias sem custo!'}
                            {retentionChoice === 'downgrade' && 'Selecione um plano mais barato na página de assinatura para concluir a migração.'}
                        </p>
                        <button
                            onClick={() => {
                                setCancelStep('idle');
                                if (retentionChoice === 'downgrade') {
                                    // Close modal and let user pick a cheaper plan on this same page
                                } else {
                                    navigate('/dashboard');
                                }
                            }}
                            className="w-full py-4 rounded-[1.5rem] bg-primary text-slate-950 font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                        >
                            {retentionChoice === 'downgrade' ? 'Escolher Plano' : 'Ir para o Dashboard'}
                        </button>
                    </div>
                </div>
            )}

            {/* Cancel Flow — Confirmed cancellation */}
            {cancelStep === 'canceled' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl text-center">
                        <div className="size-20 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-orange-500 text-5xl">info</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-3">
                            Cancelamento Registrado
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                            Sua assinatura será cancelada ao final do período atual e você pode usufruir das funcionalidades normalmente. Não serão realizadas cobranças adicionais.
                        </p>
                        <button
                            onClick={() => { setCancelStep('idle'); navigate('/dashboard'); }}
                            className="w-full py-4 rounded-[1.5rem] bg-slate-900 dark:bg-slate-700 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-110 transition-all"
                        >
                            Ir para o Dashboard
                        </button>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default Subscription;
