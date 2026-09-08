import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import PasswordInput from '../components/PasswordInput';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [emailTouched, setEmailTouched] = useState(false);
    const navigate = useNavigate();
    const { user, profile, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && user) {
            const role = user.user_metadata?.role || (profile as any)?.role;
            navigate(role === 'client' ? '/cliente/dashboard' : '/dashboard');
        }
    }, [user, authLoading, profile, navigate]);

    const validateEmail = (value: string) => {
        if (!value) return 'E-mail é obrigatório';
        if (!EMAIL_REGEX.test(value)) return 'Informe um e-mail válido';
        return null;
    };

    const handleEmailChange = (value: string) => {
        setEmail(value);
        setError(null);
        if (emailTouched) setEmailError(validateEmail(value));
    };

    const handleEmailBlur = () => {
        setEmailTouched(true);
        setEmailError(validateEmail(email));
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailTouched(true);
        const emailErr = validateEmail(email);
        setEmailError(emailErr);
        if (emailErr) return;

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const role = authUser?.user_metadata?.role;
            navigate(role === 'client' ? '/cliente/dashboard' : '/dashboard');
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer login');
        } finally {
            setLoading(false);
        }
    };

    const inputBase = 'block w-full pl-10 pr-3 py-3 border rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all';
    const inputError = 'border-red-400 dark:border-red-500 focus:border-red-400 focus:ring-red-200';
    const inputNormal = 'border-slate-200 dark:border-slate-700';

    return (
        <div className="login-bg dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display flex flex-col">
            <main className="flex-grow flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md">
                    <div className="flex flex-col items-center mb-8">
                        <Link to="/" className="flex items-center gap-2 text-primary mb-2">
                            <span className="material-symbols-outlined text-4xl">deployed_code</span>
                            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">SaaS Foundation</h1>
                        </Link>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Uma estimativa de evolução</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 md:p-10">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bem-vindo de volta</h2>
                            <p className="text-slate-500 dark:text-slate-400 mt-1">Acesse sua conta profissional</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-base shrink-0">error</span>
                                {error}
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleLogin} noValidate>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2" htmlFor="email">E-mail</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                        <span className="material-symbols-outlined text-xl">mail</span>
                                    </span>
                                    <input
                                        className={`${inputBase} ${emailTouched && emailError ? inputError : inputNormal}`}
                                        id="email"
                                        name="email"
                                        placeholder="exemplo@email.com"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        onBlur={handleEmailBlur}
                                        aria-describedby={emailError ? 'email-error' : undefined}
                                        aria-invalid={!!(emailTouched && emailError)}
                                    />
                                </div>
                                {emailTouched && emailError && (
                                    <p id="email-error" className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">warning</span>
                                        {emailError}
                                    </p>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-0">
                                    <span></span>
                                    <Link className="text-sm font-bold text-primary hover:text-blue-700 transition-colors" to="/recuperar-senha">Esqueci minha senha</Link>
                                </div>
                                <PasswordInput
                                    id="password"
                                    label="Senha"
                                    value={password}
                                    onChange={(v) => { setPassword(v); setError(null); }}
                                    autoComplete="current-password"
                                />
                            </div>

                            <label htmlFor="remember-me" className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                                <input className="h-5 w-5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer" id="remember-me" name="remember-me" type="checkbox" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">Lembrar de mim</span>
                            </label>

                            <button
                                className="w-full py-3.5 px-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/25 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                                        Entrando...
                                    </span>
                                ) : 'Entrar'}
                            </button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
                            <p className="text-slate-600 dark:text-slate-400 text-sm">
                                Não tem uma conta?
                                <Link className="font-bold text-primary hover:text-blue-700 transition-colors ml-1" to="/cadastro">Cadastre-se</Link>
                            </p>
                        </div>
                    </div>
                    <p className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
                        Precisa de ajuda? <a className="font-medium hover:underline" href="#">Entre em contato com o suporte</a>
                    </p>
                </div>
            </main>

            <footer className="py-8 bg-transparent">
                <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-xl">deployed_code</span>
                        <span className="text-sm font-medium">© 2026 SaaS Foundation SaaS.</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link className="text-xs text-slate-500 hover:text-primary transition-colors uppercase tracking-wider font-bold" to="/termos">Termos</Link>
                        <Link className="text-xs text-slate-500 hover:text-primary transition-colors uppercase tracking-wider font-bold" to="/privacidade">Privacidade</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Login;
