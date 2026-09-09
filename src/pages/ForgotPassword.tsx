import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/redefinir-senha`,
            });

            if (error) throw error;
            setMessage('Se as informações estiverem corretas, você receberá um link de recuperação em seu e-mail.');
        } catch (err: any) {
            setError(err.message || 'Erro ao processar solicitação');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-bg dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display flex flex-col">
            <main className="flex-grow flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md">
                    <div className="flex flex-col items-center mb-8">
                        <Link to="/" className="flex items-center gap-2 text-primary mb-2">
                            <span className="material-symbols-outlined text-4xl">deployed_code</span>
                            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">RDC</h1>
                        </Link>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Uma estimativa de evolução</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 md:p-10">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Recuperar senha</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Insira seu e-mail para receber as instruções</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {message && (
                            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg text-sm font-medium">
                                {message}
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleResetRequest}>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="email">E-mail</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                        <span className="material-symbols-outlined text-xl">mail</span>
                                    </span>
                                    <input
                                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        id="email"
                                        name="email"
                                        placeholder="exemplo@email.com"
                                        required
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                className="w-full py-3.5 px-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/25 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                            </button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-sm">
                                Lembrou sua senha?
                                <Link className="font-bold text-primary hover:text-blue-700 transition-colors ml-1" to="/login">Voltar ao login</Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-8 bg-transparent">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-xl">deployed_code</span>
                        <span className="text-sm font-medium">© 2026 RDC SaaS.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default ForgotPassword;
