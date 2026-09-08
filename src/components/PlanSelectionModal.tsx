import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { savePendingPayment } from './PaymentPendingScreen';

interface Plan {
    id: string;
    nome: string;
    preco_mensal: number;
    limite_clientes: number;
    limite_operacoes_mes: number;
}

function formatCpfCnpj(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
        // CPF: 000.000.000-00
        return digits
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    // CNPJ: 00.000.000/0001-00
    return digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function validateCpfCnpj(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 14;
}

/**
 * Blocking modal shown when the tenant has no plan assigned.
 * Step 1: Plan selection cards.
 * Step 2: CPF/CNPJ confirmation before checkout.
 */
const PlanSelectionModal = () => {
    const { profile, refreshAuth } = useAuth();
    const isTenantAdmin = profile?.role === 'tenant_admin';

    const [plans, setPlans] = useState<Plan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    // Step 1 → 2
    const [step, setStep] = useState<'plans' | 'confirm'>('plans');
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    // Step 2 form
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [cpfCnpjError, setCpfCnpjError] = useState<string | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!isTenantAdmin) return;
        (supabase
            .from('plans')
            .select('id, nome, preco_mensal, limite_clientes, limite_operacoes_mes')
            .order('preco_mensal', { ascending: true }) as any)
            .then(({ data }: any) => {
                if (data) setPlans(data as Plan[]);
            })
            .finally(() => setPlansLoading(false));
    }, [isTenantAdmin]);

    const handleChoosePlan = (plan: Plan) => {
        setSelectedPlan(plan);
        setCpfCnpj('');
        setCpfCnpjError(null);
        setCheckoutError(null);
        setStep('confirm');
    };

    const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCpfCnpj(formatCpfCnpj(e.target.value));
        setCpfCnpjError(null);
    };

    const handleConfirmCheckout = async () => {
        if (!selectedPlan) return;

        if (!validateCpfCnpj(cpfCnpj)) {
            setCpfCnpjError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
            return;
        }

        setCheckoutError(null);
        setCheckoutLoading(true);
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
                    body: JSON.stringify({
                        plan_id: selectedPlan.id,
                        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
                    }),
                }
            );

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao processar assinatura.');

            setSuccess(true);

            // Persist payment info for the pending screen (survives page refresh)
            savePendingPayment({
                paymentLink: data.paymentLink || null,
                planNome: selectedPlan.nome,
                planPreco: selectedPlan.preco_mensal,
            });

            if (data.paymentLink) {
                window.open(data.paymentLink, '_blank');
            }

            // Refresh auth — tenant now has asaas_subscription_id but no plano_id yet.
            // DashboardLayout will switch to PaymentPendingScreen.
            await refreshAuth();

        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Erro interno. Tente novamente.');
        } finally {
            setCheckoutLoading(false);
        }
    };

    // ── Waiting screen for collaborators ────────────────────────────────────
    if (!isTenantAdmin) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-12 max-w-md w-full text-center shadow-2xl">
                    <div className="size-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                        <span className="material-symbols-outlined text-primary text-4xl">schedule</span>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-3 text-slate-900 dark:text-white">
                        Assinatura Pendente
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                        Sua conta está aguardando a ativação da assinatura pelo administrador da empresa.
                        Entre em contato com o responsável para liberar o acesso.
                    </p>
                    <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        SaaS Foundation · Plataforma B2B
                    </p>
                </div>
            </div>
        );
    }

    // ── STEP 2: Confirm plan + CPF/CNPJ ─────────────────────────────────────
    if (step === 'confirm' && selectedPlan) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-10 shadow-2xl">
                    {/* Back */}
                    <button
                        onClick={() => { setStep('plans'); setCheckoutError(null); }}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs font-black uppercase tracking-widest mb-8 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Voltar aos planos
                    </button>

                    {/* Selected plan summary */}
                    <div className="mb-8 p-6 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Plano Selecionado</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">{selectedPlan.nome}</p>
                        </div>
                        <p className="text-3xl font-black text-primary italic">
                            R$ {selectedPlan.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            <span className="text-xs font-bold text-slate-400 tracking-normal block text-right">/mês</span>
                        </p>
                    </div>

                    {/* CPF/CNPJ input */}
                    <div className="mb-6">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 mb-3">
                            CPF / CNPJ da empresa
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="000.000.000-00  ou  00.000.000/0001-00"
                            value={cpfCnpj}
                            onChange={handleCpfCnpjChange}
                            className={`w-full px-5 py-4 rounded-2xl border text-sm font-bold tracking-wider bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none transition-all focus:ring-2 focus:ring-primary/30 ${
                                cpfCnpjError
                                    ? 'border-red-400 dark:border-red-500'
                                    : 'border-slate-200 dark:border-slate-700 focus:border-primary'
                            }`}
                        />
                        {cpfCnpjError && (
                            <p className="mt-2 text-xs text-red-500 font-medium">{cpfCnpjError}</p>
                        )}
                        <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-xs mt-0.5 flex-shrink-0">lock</span>
                            Este dado é utilizado exclusivamente para o processamento do pagamento via ASAAS e para emissão de documentos fiscais. Não é compartilhado com terceiros.
                        </p>
                    </div>

                    {/* Checkout error */}
                    {checkoutError && (
                        <div className="mb-6 flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <span className="material-symbols-outlined text-red-500 text-lg flex-shrink-0 mt-0.5">error</span>
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{checkoutError}</p>
                        </div>
                    )}

                    {/* Confirm button */}
                    <button
                        onClick={handleConfirmCheckout}
                        disabled={checkoutLoading || success}
                        className="w-full py-5 rounded-[2rem] bg-primary text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-primary/30 hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {checkoutLoading && (
                            <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-950" />
                        )}
                        {success
                            ? 'Redirecionando para pagamento...'
                            : checkoutLoading
                                ? 'Processando...'
                                : 'Confirmar e Pagar'}
                    </button>

                    <p className="mt-5 text-center text-[10px] text-slate-400 font-medium">
                        Você será redirecionado para a página de pagamento do ASAAS.
                        O acesso é liberado após a confirmação do pagamento.
                    </p>
                </div>
            </div>
        );
    }

    // ── STEP 1: Plan selection ───────────────────────────────────────────────
    const firstName = (profile as any)?.nome?.split(' ')[0] || (profile as any)?.full_name?.split(' ')[0] || 'usuário';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-md">
            <div className="flex min-h-full items-start justify-center p-4 py-10">
            <div className="w-full max-w-3xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-5 bg-white/5 border border-white/10 rounded-full px-5 py-2">
                        <div className="bg-primary size-6 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-sm text-slate-950">vital_signs</span>
                        </div>
                        <span className="text-white font-black text-sm tracking-tight">SaaS Foundation</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic mb-2">
                        Bem-vindo, {firstName}!
                    </h1>
                    <p className="text-primary font-bold text-sm mb-4">
                        É muito bom ter você conosco!!!
                    </p>
                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-2">
                        Para começar a usar a plataforma, selecione o plano que melhor se adapta ao volume de operações do seu negócio.
                    </p>
                    <p className="text-slate-300 font-black text-xs uppercase tracking-widest">
                        Escolha o seu plano:
                    </p>
                </div>

                {/* Plans grid */}
                {plansLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {plans.map((plan, idx) => {
                            const isHighlighted = idx === 1;
                            return (
                                <div
                                    key={plan.id}
                                    className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 ${
                                        isHighlighted
                                            ? 'bg-white dark:bg-slate-900 border-primary ring-4 ring-primary/10 shadow-2xl shadow-primary/20 z-10'
                                            : 'bg-white/5 border-white/10 hover:border-primary/40 hover:bg-white/10'
                                    }`}
                                >
                                    {isHighlighted && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-slate-950 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full shadow-lg z-20">
                                            Mais Popular
                                        </div>
                                    )}

                                    <h3 className={`text-xl font-black uppercase tracking-tighter italic mb-4 ${isHighlighted ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                                        {plan.nome}
                                    </h3>

                                    <div className="mb-4 flex items-baseline gap-1">
                                        <span className={`text-3xl font-black tracking-tighter italic ${isHighlighted ? 'text-primary' : 'text-white'}`}>
                                            R$ {plan.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                        </span>
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">/mês</span>
                                    </div>

                                    <div className={`flex items-center gap-2 mb-6 text-xs font-bold ${isHighlighted ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                                        <span className="material-symbols-outlined text-primary text-base flex-shrink-0">monitoring</span>
                                        {plan.limite_operacoes_mes > 1000
                                            ? 'Operações ilimitadas'
                                            : `${plan.limite_operacoes_mes} operações/mês`}
                                    </div>

                                    <button
                                        onClick={() => handleChoosePlan(plan)}
                                        className={`w-full py-3 rounded-xl font-black uppercase tracking-[0.15em] text-[10px] transition-all ${
                                            isHighlighted
                                                ? 'bg-primary text-slate-950 shadow-lg shadow-primary/30 hover:brightness-110'
                                                : 'bg-white/10 text-white border border-white/20 hover:bg-primary hover:text-slate-950 hover:border-primary'
                                        }`}
                                    >
                                        Escolher {plan.nome}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                <p className="mt-8 text-center text-slate-600 text-xs font-medium">
                    Pagamento processado com segurança pelo ASAAS. PIX, Boleto e Cartão disponíveis.
                </p>
            </div>
            </div>
        </div>
    );
};

export default PlanSelectionModal;
