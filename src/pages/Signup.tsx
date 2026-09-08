import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import PasswordInput from '../components/PasswordInput';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
    name?: string;
    email?: string;
    segment?: string;
    confirmPassword?: string;
};

type TouchedFields = {
    name?: boolean;
    email?: boolean;
    segment?: boolean;
    confirmPassword?: boolean;
};

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        segment: '',
        orgName: '',
        password: '',
        confirmPassword: '',
        consentTerms: false,
        consentPrivacy: false,
        consentAI: false,
        consentThirdParty: false,
        consentMarketing: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showVerify, setShowVerify] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [resendMsg, setResendMsg] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState<TouchedFields>({});
    const navigate = useNavigate();

    const validate = (data: typeof formData): FieldErrors => {
        const errs: FieldErrors = {};
        if (!data.name.trim()) errs.name = 'Nome é obrigatório';
        if (!data.email) errs.email = 'E-mail é obrigatório';
        else if (!EMAIL_REGEX.test(data.email)) errs.email = 'Informe um e-mail válido';
        if (!data.segment) errs.segment = 'Selecione um segmento';
        if (data.confirmPassword && data.password !== data.confirmPassword)
            errs.confirmPassword = 'As senhas não coincidem';
        return errs;
    };

    const handleBlur = (field: keyof TouchedFields) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        setFieldErrors(validate(formData));
    };

    const handleChange = (field: keyof typeof formData, value: string | boolean) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);
        setError(null);
        // Re-validate touched fields on change
        const errs = validate(updated);
        setFieldErrors(prev => {
            const next: FieldErrors = { ...prev };
            (Object.keys(touched) as (keyof TouchedFields)[]).forEach(k => {
                next[k] = errs[k];
            });
            return next;
        });
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        // Mark all validatable fields as touched
        const allTouched: TouchedFields = { name: true, email: true, segment: true, confirmPassword: true };
        setTouched(allTouched);
        const errs = validate(formData);
        setFieldErrors(errs);
        if (Object.keys(errs).length > 0) return;

        if (!formData.consentTerms || !formData.consentPrivacy || !formData.consentAI || !formData.consentThirdParty) {
            setError('Você deve aceitar todos os termos obrigatórios para continuar.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setFieldErrors(prev => ({ ...prev, confirmPassword: 'As senhas não coincidem' }));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/dashboard`,
                    data: {
                        full_name: formData.name,
                        org_name: formData.orgName || `${formData.name} - Empresa`,
                        segment: formData.segment,
                        consent_terms: true,
                        consent_privacy: true,
                        consent_ai: true,
                        consent_third_party: true,
                        consent_marketing: formData.consentMarketing,
                        consent_date: new Date().toISOString(),
                    }
                }
            });

            if (authError) throw authError;

            if (!authData.session) {
                // Confirmação de e-mail ligada → verificação por código (OTP), imune ao
                // pré-scan de links do Outlook/Hotmail. Requer o template "Confirm signup"
                // do Supabase exibindo {{ .Token }}.
                setShowVerify(true);
                return;
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = otpCode.trim();
        if (code.length < 6) {
            setVerifyError('Digite o código de 6 dígitos enviado ao seu e-mail.');
            return;
        }
        setVerifyLoading(true);
        setVerifyError(null);
        try {
            const { error: otpError } = await supabase.auth.verifyOtp({
                email: formData.email,
                token: code,
                type: 'signup',
            });
            if (otpError) throw otpError;
            navigate('/dashboard');
        } catch {
            setVerifyError('Código inválido ou expirado. Confira e tente de novo, ou reenvie um novo código.');
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleResend = async () => {
        setResendMsg(null);
        setVerifyError(null);
        try {
            const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: formData.email });
            if (resendError) throw resendError;
            setResendMsg('Enviamos um novo código para o seu e-mail.');
        } catch {
            setVerifyError('Não foi possível reenviar agora. Aguarde alguns instantes e tente novamente.');
        }
    };

    if (showVerify) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl p-10 md:p-12 max-w-md w-full text-center">
                    <div className="size-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-primary text-4xl">mark_email_read</span>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white mb-3">
                        Confirme seu e-mail
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-6">
                        Enviamos um código de 6 dígitos para <strong className="text-slate-700 dark:text-slate-200">{formData.email}</strong>. Digite-o abaixo para ativar sua conta.
                    </p>

                    {verifyError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
                            {verifyError}
                        </div>
                    )}
                    {resendMsg && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">
                            {resendMsg}
                        </div>
                    )}

                    <form onSubmit={handleVerify}>
                        <input
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            autoFocus
                            value={otpCode}
                            onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError(null); }}
                            placeholder="000000"
                            className="w-full text-center tracking-[0.5em] text-3xl font-black py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-primary focus:border-primary mb-4"
                        />
                        <button
                            type="submit"
                            disabled={verifyLoading || otpCode.length < 6}
                            className="w-full py-4 rounded-[2rem] bg-primary text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {verifyLoading ? 'Confirmando...' : 'Confirmar e entrar'}
                        </button>
                    </form>

                    <button
                        onClick={handleResend}
                        className="mt-5 text-xs font-bold text-slate-400 hover:text-primary transition-colors"
                    >
                        Não recebeu? Reenviar código
                    </button>
                </div>
            </div>
        );
    }

    const inputBase = 'block w-full px-4 py-3 border rounded-lg bg-slate-50 dark:bg-slate-800 text-base focus:ring-primary focus:border-primary placeholder-slate-400 transition-all';
    const hasError = (f: keyof FieldErrors) => touched[f] && fieldErrors[f];
    const inputClass = (f: keyof FieldErrors) =>
        `${inputBase} ${hasError(f) ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-slate-700'}`;

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen font-display flex flex-col">
            <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Link to="/" className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined text-3xl">deployed_code</span>
                            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">SaaS Foundation</h1>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-lg">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Crie sua conta profissional</h2>
                                <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">Comece a transformar jornadas hoje mesmo.</p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base shrink-0">error</span>
                                    {error}
                                </div>
                            )}

                            <form className="space-y-5" onSubmit={handleSignup} noValidate>
                                {/* Nome */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="name">
                                        Nome Completo <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                            <span className="material-symbols-outlined text-xl">person</span>
                                        </span>
                                        <input
                                            className={`${inputClass('name')} pl-10`}
                                            id="name"
                                            placeholder="Seu nome completo"
                                            type="text"
                                            autoComplete="name"
                                            value={formData.name}
                                            onChange={(e) => handleChange('name', e.target.value)}
                                            onBlur={() => handleBlur('name')}
                                            aria-invalid={!!hasError('name')}
                                            aria-describedby={hasError('name') ? 'name-error' : undefined}
                                        />
                                    </div>
                                    {hasError('name') && (
                                        <p id="name-error" className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">warning</span>
                                            {fieldErrors.name}
                                        </p>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="email">
                                        E-mail Profissional <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                            <span className="material-symbols-outlined text-xl">mail</span>
                                        </span>
                                        <input
                                            className={`${inputClass('email')} pl-10`}
                                            id="email"
                                            placeholder="seu@email.com"
                                            type="email"
                                            autoComplete="email"
                                            value={formData.email}
                                            onChange={(e) => handleChange('email', e.target.value)}
                                            onBlur={() => handleBlur('email')}
                                            aria-invalid={!!hasError('email')}
                                            aria-describedby={hasError('email') ? 'email-error' : undefined}
                                        />
                                    </div>
                                    {hasError('email') && (
                                        <p id="email-error" className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">warning</span>
                                            {fieldErrors.email}
                                        </p>
                                    )}
                                </div>

                                {/* Organização + segmento */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="orgName">Nome da empresa</label>
                                        <input
                                            className={inputBase + ' border-slate-200 dark:border-slate-700'}
                                            id="orgName"
                                            placeholder="Ex: Acme Ltda"
                                            type="text"
                                            value={formData.orgName}
                                            onChange={(e) => handleChange('orgName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5" htmlFor="segment">
                                            Segmento <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            className={inputClass('segment')}
                                            id="segment"
                                            value={formData.segment}
                                            onChange={(e) => handleChange('segment', e.target.value)}
                                            onBlur={() => handleBlur('segment')}
                                            aria-invalid={!!hasError('segment')}
                                            aria-describedby={hasError('segment') ? 'segment-error' : undefined}
                                        >
                                            {/* Os valores alimentam useTerminology: definem como a
                                                interface chama o cliente final deste tenant. */}
                                            <option disabled value="">Selecione...</option>
                                            <option value="geral">Geral</option>
                                            <option value="educacao">Educação</option>
                                            <option value="saude">Saúde</option>
                                            <option value="associacao">Associação</option>
                                            <option value="juridico">Jurídico</option>
                                            <option value="imobiliario">Imobiliário</option>
                                        </select>
                                        {hasError('segment') && (
                                            <p id="segment-error" className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">warning</span>
                                                {fieldErrors.segment}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <PasswordInput
                                    id="password"
                                    label="Senha"
                                    value={formData.password}
                                    onChange={(v) => handleChange('password', v)}
                                    showStrength
                                    autoComplete="new-password"
                                />

                                <div>
                                    <PasswordInput
                                        id="confirm-password"
                                        label="Confirmar Senha"
                                        value={formData.confirmPassword}
                                        onChange={(v) => handleChange('confirmPassword', v)}
                                        icon="lock_reset"
                                        autoComplete="new-password"
                                        onBlur={() => handleBlur('confirmPassword')}
                                    />
                                    {hasError('confirmPassword') && (
                                        <p className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">warning</span>
                                            {fieldErrors.confirmPassword}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-4 mb-2 space-y-3">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Consentimentos <span className="text-red-500">*</span></p>

                                    {/* Termos + Privacidade — obrigatório (registra consent_terms e consent_privacy) */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                            <input
                                                id="consentTermsPrivacy"
                                                type="checkbox"
                                                required
                                                checked={formData.consentTerms && formData.consentPrivacy}
                                                onChange={(e) => { const v = e.target.checked; setFormData(prev => ({ ...prev, consentTerms: v, consentPrivacy: v })); setError(null); }}
                                                className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-800 cursor-pointer"
                                            />
                                        </div>
                                        <label htmlFor="consentTermsPrivacy" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                            Li e aceito os <Link to="/termos" target="_blank" className="text-primary hover:underline">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link> (tratamento de dados conforme a LGPD). <span className="text-red-500 text-xs">Obrigatório</span>
                                        </label>
                                    </div>

                                    {/* IA + terceiros/exterior — obrigatório (registra consent_ai e consent_third_party) */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                            <input
                                                id="consentAIThirdParty"
                                                type="checkbox"
                                                required
                                                checked={formData.consentAI && formData.consentThirdParty}
                                                onChange={(e) => { const v = e.target.checked; setFormData(prev => ({ ...prev, consentAI: v, consentThirdParty: v })); setError(null); }}
                                                className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-800 cursor-pointer"
                                            />
                                        </div>
                                        <label htmlFor="consentAIThirdParty" className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                            Autorizo o processamento dos meus dados por inteligência artificial nas funcionalidades que dependem dela, incluindo o envio a provedores no exterior exclusivamente para esse fim, conforme a <Link to="/privacidade" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link>. <span className="text-red-500 text-xs">Obrigatório</span>
                                        </label>
                                    </div>

                                    {/* Comunicações de marketing — opcional */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
                                            <input
                                                id="consentMarketing"
                                                name="consentMarketing"
                                                type="checkbox"
                                                checked={formData.consentMarketing}
                                                onChange={(e) => handleChange('consentMarketing', e.target.checked)}
                                                className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary dark:bg-slate-800 cursor-pointer"
                                            />
                                        </div>
                                        <label htmlFor="consentMarketing" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                            Desejo receber novidades, atualizações e ofertas da SaaS Foundation por e-mail. <span className="text-slate-400 dark:text-slate-500 text-xs">Opcional</span>
                                        </label>
                                    </div>
                                </div>

                                <button
                                    className="w-full py-3 px-4 bg-primary text-white rounded-lg font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>
                                            Criando conta...
                                        </>
                                    ) : 'Criar Conta'}
                                </button>
                            </form>

                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Já possui uma conta? <Link className="text-primary font-bold hover:underline" to="/login">Faça Login</Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Signup;
