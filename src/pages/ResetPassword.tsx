import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import PasswordInput from '../components/PasswordInput';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // Pequeno delay para garantir processamento do token
                setTimeout(async () => {
                    const { data: { session: retry } } = await supabase.auth.getSession();
                    if (!retry) setError('Link inválido ou expirado.');
                }, 500);
            }
        };
        checkSession();
    }, []);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setSuccess(true);

            // Força um signOut para garantir que a próxima entrada seja limpa
            await supabase.auth.signOut();

            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            console.error('Erro na redefinição:', err);
            setError(err.message || 'Erro ao redefinir senha');
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
                            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">SaaS Foundation</h1>
                        </Link>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 md:p-10">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nova senha</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Defina sua nova senha de acesso</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="flex flex-col items-center py-4 text-center">
                                <span className="material-symbols-outlined text-6xl text-emerald-500 mb-4 animate-bounce">check_circle</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Senha redefinida!</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6">Sua senha foi atualizada com sucesso. Você será redirecionado para a página de login em instantes.</p>
                                <Link
                                    to="/login"
                                    className="w-full py-3 px-4 bg-primary text-white rounded-lg font-bold hover:bg-blue-700 transition-all text-center"
                                >
                                    Ir para Login agora
                                </Link>
                            </div>
                        )}

                        {!success && (
                            <form className="space-y-6" onSubmit={handleResetPassword}>
                                <PasswordInput
                                    id="password"
                                    label="Nova Senha"
                                    value={password}
                                    onChange={setPassword}
                                    showStrength
                                    autoComplete="new-password"
                                />

                                <PasswordInput
                                    id="confirmPassword"
                                    label="Confirmar Nova Senha"
                                    value={confirmPassword}
                                    onChange={setConfirmPassword}
                                    icon="lock_reset"
                                    autoComplete="new-password"
                                />

                                <button
                                    className="w-full py-3.5 px-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/25 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Redefinindo...' : 'Atualizar senha'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ResetPassword;
