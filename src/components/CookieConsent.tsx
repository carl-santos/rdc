import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Banner informativo de cookies (LGPD — transparência). A app usa apenas
// armazenamento essencial (autenticação); sem cookies de publicidade/rastreio.
// O consentimento fica registrado em localStorage e o banner some após o "Entendi".
const STORAGE_KEY = 'app_cookie_consent';

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
        } catch { /* localStorage indisponível — não mostra */ }
    }, []);

    const accept = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, at: new Date().toISOString() }));
        } catch { /* noop */ }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div role="dialog" aria-label="Aviso de cookies" className="fixed bottom-0 inset-x-0 z-[9600] p-3 sm:p-4 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mx-auto max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-black/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="material-symbols-outlined text-primary shrink-0">cookie</span>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        Usamos cookies e armazenamento local <strong className="text-slate-900 dark:text-white">essenciais</strong> para o login e o funcionamento da plataforma. Não utilizamos cookies de publicidade ou rastreio. Saiba mais na nossa{' '}
                        <Link to="/privacidade" className="text-primary font-bold underline underline-offset-2">Política de Privacidade</Link>.
                    </p>
                </div>
                <button
                    onClick={accept}
                    className="shrink-0 w-full sm:w-auto bg-primary text-white font-bold text-sm px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all min-h-touch"
                >
                    Entendi
                </button>
            </div>
        </div>
    );
}
