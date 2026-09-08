import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const POLL_INTERVAL_MS = 8000;
const STORAGE_KEY = 'app_pending_payment';

export interface PendingPaymentData {
    paymentLink: string | null;
    planNome: string;
    planPreco: number;
}

export function savePendingPayment(data: PendingPaymentData) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearPendingPayment() {
    sessionStorage.removeItem(STORAGE_KEY);
}

function loadPendingPayment(): PendingPaymentData | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Full-screen blocking screen shown while awaiting ASAAS payment confirmation.
 * Polls refreshAuth() every 8 s. Disappears automatically when tenant.plano_id
 * is set (webhook has confirmed the payment).
 */
const PaymentPendingScreen = () => {
    const { tenant, refreshAuth } = useAuth();
    const [checking, setChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const pending = loadPendingPayment();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkPayment = async () => {
        setChecking(true);
        await refreshAuth();
        setLastChecked(new Date());
        setChecking(false);
    };

    useEffect(() => {
        // Auto-poll
        intervalRef.current = setInterval(checkPayment, POLL_INTERVAL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // When payment is confirmed, tenant.plano_id will be set — clear storage
    useEffect(() => {
        if ((tenant as any)?.plano_id) {
            clearPendingPayment();
        }
    }, [(tenant as any)?.plano_id]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 p-12 shadow-2xl text-center">

                {/* Animated icon */}
                <div className="relative size-24 mx-auto mb-8">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                    <div className="absolute inset-0 rounded-full border-4 border-primary/40 animate-pulse" />
                    <div className="relative size-24 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-4xl">payments</span>
                    </div>
                </div>

                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-3">
                    Aguardando Pagamento
                </h2>

                {pending ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-2">
                        Plano <span className="font-black text-slate-900 dark:text-white">{pending.planNome}</span> —{' '}
                        <span className="font-black text-primary">
                            R$ {pending.planPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        /mês
                    </p>
                ) : null}

                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-10">
                    Conclua o pagamento na aba do ASAAS. O acesso será liberado automaticamente
                    assim que a confirmação for recebida. Não é necessário fazer nada aqui.
                </p>

                {/* Status indicator */}
                <div className="flex items-center justify-center gap-2 mb-8 text-xs text-slate-400 font-medium">
                    {checking ? (
                        <>
                            <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-primary flex-shrink-0" />
                            Verificando status...
                        </>
                    ) : (
                        <>
                            <span className="size-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0" />
                            Verificação automática a cada {POLL_INTERVAL_MS / 1000}s
                            {lastChecked && (
                                <span className="text-slate-300 dark:text-slate-600">
                                    · Última: {lastChecked.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            )}
                        </>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Reopen payment link */}
                    {pending?.paymentLink && (
                        <a
                            href={pending.paymentLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-4 rounded-[2rem] bg-primary text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-base">open_in_new</span>
                            Abrir Página de Pagamento
                        </a>
                    )}

                    {/* Manual check */}
                    <button
                        onClick={checkPayment}
                        disabled={checking}
                        className="flex-1 py-4 rounded-[2rem] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase tracking-[0.2em] text-[10px] hover:border-primary/50 hover:text-primary transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">refresh</span>
                        Já Paguei
                    </button>
                </div>

                <p className="mt-8 text-[10px] text-slate-300 dark:text-slate-700 font-medium">
                    SaaS Foundation · Pagamento processado pelo ASAAS
                </p>
            </div>
        </div>
    );
};

export default PaymentPendingScreen;
