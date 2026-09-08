import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import PasswordInput from '../components/PasswordInput';

const MAX_WAIT_MS = 10000; // Espera até 10s pela sessão do Supabase

const AcceptInvite = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [consentTerms, setConsentTerms] = useState(false);
    const [consentPrivacy, setConsentPrivacy] = useState(false);
    const [consentAI, setConsentAI] = useState(false);
    const [consentThirdParty, setConsentThirdParty] = useState(false);
    const [consentMarketing, setConsentMarketing] = useState(false);
    // Confidencialidade/responsabilidade do operador — obrigatório só p/ membro de equipe.
    const [consentDataResponsibility, setConsentDataResponsibility] = useState(false);
    // Declaração de maioridade — obrigatório só p/ cliente (titular).
    const [consentAge, setConsentAge] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isClientInvite, setIsClientInvite] = useState(false);
    // Convite por CÓDIGO (OTP) — quando não há link/sessão (imune ao scanner do Outlook).
    const [needsOtp, setNeedsOtp] = useState(false);
    const [otpEmail, setOtpEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '');
    const [otpCode, setOtpCode] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const navigate = useNavigate();
    const { user: authUser, loading: authLoading, refreshAuth } = useAuth();

    // Aguarda o AuthContext resolver a sessão. Se o Supabase não detectar o hash
    // automaticamente (timing issue com React Router), tenta recuperação manual
    // a partir dos tokens capturados sincronamente no supabase.ts.
    useEffect(() => {
        if (authLoading) return;

        let cancelled = false;
        const start = Date.now();

        // Aplica a sessão do CONVIDADO a partir dos tokens do convite, sobrepondo qualquer
        // sessão existente (ex.: o tenant logado na mesma máquina). Sem isto, o fluxo atuava
        // sobre a conta errada — trocava a senha do tenant e redirecionava para o painel dele.
        const tryManualSession = async (): Promise<boolean> => {
            const storedTokens = sessionStorage.getItem('app_invite_tokens');
            if (!storedTokens) return false;

            try {
                const params = new URLSearchParams(storedTokens.replace(/^#/, ''));
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (!accessToken || !refreshToken) return false;

                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (error) {
                    return false;
                }
                if (data.session?.user) {
                    sessionStorage.removeItem('app_invite_tokens');
                    return true;
                }
            } catch {
                // session recovery failed
            }
            return false;
        };

        const resolve = async () => {
            // 1) Tokens do convite têm PRIORIDADE — o convite manda sobre a sessão existente.
            const applied = await tryManualSession();
            if (cancelled) return;
            if (applied) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.user_metadata?.role === 'client') setIsClientInvite(true);
                setSessionLoading(false);
                return;
            }

            const hasInviteLink = !!sessionStorage.getItem('app_invite_tokens') || window.location.hash.includes('access_token');

            // 2) Sem link de convite pendente → fluxo por CÓDIGO (OTP): PEDE o código.
            //    Só reutiliza uma sessão existente se for do PRÓPRIO convidado (mesmo e-mail do ?email=).
            //    Senão atuaria sobre a conta errada (ex.: o profissional logado no mesmo navegador).
            if (!hasInviteLink) {
                const otpEmailParam = (new URLSearchParams(window.location.search).get('email') || '').trim().toLowerCase();
                if (authUser && otpEmailParam && (authUser.email || '').toLowerCase() === otpEmailParam) {
                    if (authUser.user_metadata?.role === 'client') setIsClientInvite(true);
                    setSessionLoading(false);
                    return;
                }
                setNeedsOtp(true);
                setSessionLoading(false);
                return;
            }

            // 3) Link pendente + sessão já resolvida (fluxo legado por link).
            if (authUser) {
                if (authUser.user_metadata?.role === 'client') setIsClientInvite(true);
                setSessionLoading(false);
                return;
            }

            // 4) Link presente mas ainda não aplicado: aguarda o Supabase detectar o hash.
            while (!cancelled && Date.now() - start < MAX_WAIT_MS) {
                await new Promise(r => setTimeout(r, 1500));
                if (cancelled) return;
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    if (session.user.user_metadata?.role === 'client') setIsClientInvite(true);
                    setSessionLoading(false);
                    return;
                }
            }
            // Link expirou/consumido (ex.: scanner do Outlook) → cai para o código.
            if (!cancelled) {
                setNeedsOtp(true);
                setSessionLoading(false);
            }
        };

        resolve();
        return () => { cancelled = true; };
    }, [authLoading, authUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        if (!consentTerms || !consentPrivacy) {
            setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.');
            return;
        }
        if (isClientInvite && (!consentAI || !consentThirdParty || !consentAge)) {
            setError('Você precisa aceitar todos os consentimentos obrigatórios para continuar.');
            return;
        }
        if (!isClientInvite && !consentDataResponsibility) {
            setError('Você precisa aceitar o termo de confidencialidade e tratamento de dados para continuar.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password,
                data: {
                    consent_terms: true,
                    consent_privacy: true,
                    consent_ai: isClientInvite ? true : null,
                    consent_third_party: isClientInvite ? true : null,
                    consent_age: isClientInvite ? true : null,
                    consent_data_responsibility: !isClientInvite ? true : null,
                    consent_marketing: consentMarketing,
                    consent_date: new Date().toISOString(),
                },
            });
            if (updateError) throw updateError;

            // Sincroniza o perfil com os metadados do convite
            const { data: { user } } = await supabase.auth.getUser();
            const meta = user?.user_metadata;
            const isClient = meta?.role === 'client';

            if (meta?.tenant_id) {
                const profileUpdate: Record<string, any> = { tenant_id: meta.tenant_id };
                if (meta.nome) profileUpdate.nome = meta.nome;
                if (meta.cargo) profileUpdate.cargo = meta.cargo;
                if (meta.role) profileUpdate.role = meta.role;
                if (isClient && meta.client_id) profileUpdate.client_id = meta.client_id;

                await supabase.from('profiles').update(profileUpdate as any).eq('id', user!.id as any);

                // Para clientes: vincula o usuário ao registro de cliente
                // e marca portal_activated_at — sinal de "Portal ativo" no painel do tenant.
                if (isClient && meta.client_id) {
                    await supabase.from('clients').update({
                        client_user_id: user!.id,
                        portal_activated_at: new Date().toISOString(),
                    } as any).eq('id', meta.client_id as any);
                }
            }

            // Limpa o flag de convite pendente
            sessionStorage.removeItem('app_auth_link_type');

            await refreshAuth();

            setSuccess(true);
            const redirectTo = isClient ? '/cliente/dashboard' : '/dashboard';
            setTimeout(() => navigate(redirectTo, { replace: true }), 2500);
        } catch (err: any) {
            setError(err.message || 'Erro ao configurar sua conta. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const email = otpEmail.trim();
        const code = otpCode.trim();
        if (!email || code.length < 6) {
            setError('Informe o e-mail e o código de 6 dígitos enviado a você.');
            return;
        }
        setOtpLoading(true);
        setError(null);
        try {
            const { data, error: otpError } = await supabase.auth.verifyOtp({ email, token: code, type: 'invite' });
            if (otpError) throw otpError;
            if (data.user?.user_metadata?.role === 'client') setIsClientInvite(true);
            setNeedsOtp(false);
        } catch {
            setError('Código inválido ou expirado. Confira e tente de novo, ou peça um novo convite ao administrador.');
        } finally {
            setOtpLoading(false);
        }
    };

    if (sessionLoading) {
        return (
            <div className="login-bg dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    <p className="text-sm text-slate-500 font-medium">Validando convite...</p>
                </div>
            </div>
        );
    }

    if (needsOtp) {
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
                            <div className="mb-6 text-center">
                                <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl text-primary">mark_email_read</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Confirme seu convite</h2>
                                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                                    Enviamos um código de 6 dígitos para o seu e-mail. Digite-o abaixo para ativar sua conta.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">{error}</div>
                            )}

                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">E-mail</label>
                                    <input
                                        type="email"
                                        value={otpEmail}
                                        onChange={(e) => { setOtpEmail(e.target.value); setError(null); }}
                                        placeholder="seu@email.com"
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base focus:ring-primary focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Código de 6 dígitos</label>
                                    <input
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        autoFocus
                                        value={otpCode}
                                        onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                                        placeholder="000000"
                                        className="w-full text-center tracking-[0.4em] text-2xl font-black py-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-primary focus:border-primary"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={otpLoading || otpCode.length < 6 || !otpEmail.trim()}
                                    className="w-full py-3.5 px-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {otpLoading ? 'Confirmando...' : 'Confirmar'}
                                </button>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

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
                        {success ? (
                            <div className="flex flex-col items-center py-4 text-center">
                                <span className="material-symbols-outlined text-6xl text-emerald-500 mb-4 animate-bounce">check_circle</span>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Conta ativada!</h3>
                                <p className="text-slate-500 dark:text-slate-400">
                                    {isClientInvite
                                        ? 'Sua conta foi configurada. Redirecionando para o seu portal...'
                                        : 'Sua conta foi configurada com sucesso. Redirecionando para o painel...'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-8 text-center">
                                    <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-3xl text-primary">
                                            {isClientInvite ? 'person_celebrate' : 'waving_hand'}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                        {isClientInvite ? 'Bem-vindo ao seu portal!' : 'Bem-vindo à equipe!'}
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                                        {isClientInvite
                                            ? 'Crie sua senha para acessar suas operações e acompanhar sua evolução.'
                                            : 'Crie sua senha e aceite os termos para ativar sua conta.'}
                                    </p>
                                </div>

                                {error && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium">
                                        {error}
                                        {error.includes('inválido') && (
                                            <div className="mt-3">
                                                <Link to="/login" className="font-bold underline">
                                                    Ir para o login
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!error?.includes('inválido') && (
                                    <form className="space-y-5" onSubmit={handleSubmit}>
                                        <PasswordInput
                                            id="invite-password"
                                            label="Nova Senha"
                                            value={password}
                                            onChange={setPassword}
                                            showStrength
                                            autoComplete="new-password"
                                        />

                                        <PasswordInput
                                            id="invite-confirm-password"
                                            label="Confirmar Senha"
                                            value={confirmPassword}
                                            onChange={setConfirmPassword}
                                            icon="lock_reset"
                                            autoComplete="new-password"
                                        />

                                        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Consentimentos <span className="text-red-500">*</span>
                                            </p>

                                            {/* Termos + Privacidade — obrigatório (registra consent_terms e consent_privacy) */}
                                            <div className="flex items-start gap-3">
                                                <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                                    <input
                                                        type="checkbox"
                                                        id="consentTermsPrivacy"
                                                        checked={consentTerms && consentPrivacy}
                                                        onChange={(e) => { const v = e.target.checked; setConsentTerms(v); setConsentPrivacy(v); }}
                                                        className="h-5 w-5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer"
                                                        disabled={loading}
                                                    />
                                                </div>
                                                <label htmlFor="consentTermsPrivacy" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                                                    Li e aceito os{' '}
                                                    <Link to="/termos" target="_blank" className="font-bold text-primary hover:underline">Termos de Uso</Link>{' '}
                                                    e a{' '}
                                                    <Link to="/privacidade" target="_blank" className="font-bold text-primary hover:underline">Política de Privacidade</Link>{' '}
                                                    (tratamento de dados conforme a LGPD).
                                                    <span className="text-red-500 text-xs ml-1">Obrigatório</span>
                                                </label>
                                            </div>

                                            {/* IA + terceiros/exterior — obrigatório p/ cliente (registra consent_ai e consent_third_party) */}
                                            {isClientInvite && (
                                                <div className="flex items-start gap-3">
                                                    <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                                        <input
                                                            type="checkbox"
                                                            id="consentAIThirdParty"
                                                            checked={consentAI && consentThirdParty}
                                                            onChange={(e) => { const v = e.target.checked; setConsentAI(v); setConsentThirdParty(v); }}
                                                            className="h-5 w-5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer"
                                                            disabled={loading}
                                                        />
                                                    </div>
                                                    <label htmlFor="consentAIThirdParty" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                                                        Autorizo o processamento das minhas imagens por inteligência artificial para gerar as operações, incluindo o envio a operador terceiro no exterior (provedores de IA) exclusivamente para esse processamento, conforme a{' '}
                                                        <Link to="/privacidade" target="_blank" className="font-bold text-primary hover:underline">Política de Privacidade</Link>.
                                                        <span className="text-red-500 text-xs ml-1">Obrigatório</span>
                                                    </label>
                                                </div>
                                            )}

                                            {/* Maioridade — obrigatório p/ cliente (titular) */}
                                            {isClientInvite && (
                                                <div className="flex items-start gap-3">
                                                    <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                                        <input
                                                            type="checkbox"
                                                            id="consentAge"
                                                            checked={consentAge}
                                                            onChange={(e) => setConsentAge(e.target.checked)}
                                                            className="h-5 w-5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer"
                                                            disabled={loading}
                                                        />
                                                    </div>
                                                    <label htmlFor="consentAge" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                                                        Declaro ser <strong>maior de 18 anos</strong>.
                                                        <span className="text-red-500 text-xs ml-1">Obrigatório</span>
                                                    </label>
                                                </div>
                                            )}

                                            {/* Confidencialidade / responsabilidade — só para membro de equipe (operador) */}
                                            {!isClientInvite && (
                                                <div className="flex items-start gap-3">
                                                    <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                                        <input
                                                            type="checkbox"
                                                            id="consentDataResponsibility"
                                                            checked={consentDataResponsibility}
                                                            onChange={(e) => setConsentDataResponsibility(e.target.checked)}
                                                            className="h-5 w-5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer"
                                                            disabled={loading}
                                                        />
                                                    </div>
                                                    <label htmlFor="consentDataResponsibility" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed">
                                                        Comprometo-me a tratar os dados e imagens dos clientes com confidencialidade, usá-los apenas para as finalidades da empresa e conforme a LGPD, e estou ciente de que o processamento das operações utiliza inteligência artificial e serviços terceiros no exterior (provedores de IA).
                                                        <span className="text-red-500 text-xs ml-1">Obrigatório</span>
                                                    </label>
                                                </div>
                                            )}

                                            {/* Marketing — opcional */}
                                            <div className="flex items-start gap-3">
                                                <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                                    <input
                                                        type="checkbox"
                                                        id="consentMarketing"
                                                        checked={consentMarketing}
                                                        onChange={(e) => setConsentMarketing(e.target.checked)}
                                                        className="h-5 w-5 text-primary focus:ring-primary border-slate-300 rounded cursor-pointer"
                                                        disabled={loading}
                                                    />
                                                </div>
                                                <label htmlFor="consentMarketing" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer leading-relaxed">
                                                    Desejo receber novidades, atualizações e ofertas da SaaS Foundation por e-mail.
                                                    <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">Opcional</span>
                                                </label>
                                            </div>
                                        </div>

                                        <button
                                            className="w-full py-3.5 px-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/25 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                            type="submit"
                                            disabled={loading}
                                        >
                                            {loading ? 'Ativando conta...' : 'Ativar Minha Conta'}
                                        </button>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
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

export default AcceptInvite;
