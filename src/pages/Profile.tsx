import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import ImagePicker from '../components/ImagePicker';

const Profile = () => {
    const { user, profile, tenant, refreshAuth } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [formData, setFormData] = useState({
        nome: '',
        cargo: '',
        email: '',
        avatar_url: '',
        logo_url: ''
    });

    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                nome: profile.nome || '',
                cargo: profile.cargo || '',
                email: profile.email || '',
                avatar_url: user?.user_metadata?.avatar_url || '',
                logo_url: tenant?.logo_url || ''
            });
        }
    }, [profile, user, tenant]);

    const handleFileUpload = async (file: File) => {
        setUploading(true);
        setMessage(null);

        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${user?.id}/avatar-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await (supabase.storage
                .from('avatars')
                .upload(filePath, file) as any);

            if (uploadError) {
                if (uploadError.message?.includes('Bucket not found')) {
                    throw new Error('Bucket "avatars" não encontrado em seu projeto Supabase. Por favor, crie um bucket público chamado "avatars" para habilitar o upload de fotos.');
                }
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
            setMessage({ type: 'success', text: 'Foto carregada! Clique em Salvar para vincular ao seu perfil.' });
        } catch (err: any) {
            console.error('Error uploading file:', err);
            setMessage({ type: 'error', text: err.message || 'Erro ao carregar imagem' });

            // Helpful hint for user if bucket is missing
            if (err.message?.includes('Bucket "avatars"')) {
                console.warn('Help: Create a bucket named "avatars" in Supabase Storage with public access enabled.');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleLogoUpload = async (file: File) => {
        setUploading(true);
        setMessage(null);

        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${user?.id}/logo-${tenant?.id || user?.id}-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await (supabase.storage
                .from('avatars')
                .upload(filePath, file) as any);

            if (uploadError) {
                if (uploadError.message?.includes('Bucket not found')) {
                    throw new Error('Bucket "avatars" não encontrado em seu projeto Supabase. Por favor, crie o bucket primeiro.');
                }
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, logo_url: publicUrl }));
            setMessage({ type: 'success', text: 'Logo carregada! Clique em Salvar para vincular ao seu perfil.' });
        } catch (err: any) {
            console.error('Error uploading logo:', err);
            setMessage({ type: 'error', text: err.message || 'Erro ao carregar formato de logo' });
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // 1. Update Profile Table
            const { error: profileError } = await (supabase
                .from('profiles')
                .update({
                    nome: formData.nome,
                    cargo: formData.cargo
                } as any)
                .eq('id', user!.id as any) as any);

            if (profileError) throw profileError;

            // 2. Update Auth Metadata (for avatar)
            const { error: authError } = await supabase.auth.updateUser({
                data: { avatar_url: formData.avatar_url }
            });

            if (authError) throw authError;

            // 3. Update Tenant Logo if it changed
            if (tenant?.id && formData.logo_url !== tenant.logo_url) {
                const { error: tenantError } = await (supabase
                    .from('tenants')
                    .update({ logo_url: formData.logo_url } as any)
                    .eq('id', tenant.id as any) as any);
                if (tenantError) throw tenantError;
            }

            await refreshAuth();
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err: any) {
            console.error('Error updating profile:', err);
            setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil' });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres' });
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem' });
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (error) throw error;

            setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setPasswordData({ newPassword: '', confirmPassword: '' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao alterar senha' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout title="Meu Perfil">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter">Configurações de Perfil</h1>
                        <p className="text-slate-500 font-medium">Gerencie sua identidade, foto e segurança da conta.</p>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all self-start md:self-center"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Voltar
                    </button>
                </header>

                {message && (
                    <div className={`p-5 rounded-[2rem] flex items-center gap-4 border-2 animate-in slide-in-from-top-4 duration-500 shadow-lg ${message.type === 'success'
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
                        : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400'
                        }`}>
                        <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                            <span className="material-symbols-outlined text-xl">{message.type === 'success' ? 'check' : 'close'}</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold uppercase tracking-tight">{message.text}</p>
                            {message.text.includes('Bucket "avatars"') && (
                                <p className="text-[10px] mt-1 font-medium opacity-80 leading-tight">
                                    No Painel Supabase: Storage &rarr; New Bucket &rarr; Name: <b>avatars</b> &rarr; Public Bucket: <b>Enabled</b>
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sidebar / Avatar Display */}
                    <div className="lg:col-span-1 space-y-6">
                        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center relative overflow-hidden group">
                            <div className="relative inline-block mb-6">
                                <div className="size-36 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center mx-auto transition-transform group-hover:scale-105 duration-500">
                                    {formData.avatar_url ? (
                                        <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-slate-300 text-6xl">person</span>
                                    )}
                                    {uploading && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                                            <div className="size-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                                <ImagePicker
                                    accept="image/jpeg,image/png,image/webp"
                                    onFileSelected={handleFileUpload}
                                    cameraFacingMode="user"
                                    disabled={uploading}
                                >
                                    {(open) => (
                                        <button
                                            onClick={open}
                                            className="absolute bottom-0 right-0 size-10 rounded-full bg-primary text-slate-950 flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all border-4 border-white dark:border-slate-900"
                                            type="button"
                                            title="Alterar Foto"
                                        >
                                            <span className="material-symbols-outlined text-xl font-black">photo_camera</span>
                                        </button>
                                    )}
                                </ImagePicker>
                            </div>
                            <h3 className="font-black text-xl uppercase tracking-tight">{formData.nome || 'Seu Nome'}</h3>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mt-1">{formData.cargo || 'Profissional'}</p>
                            <p className="text-slate-400 text-xs mt-4 truncate px-2">{formData.email}</p>
                        </section>

                        <section className="bg-primary/5 rounded-[2.5rem] p-6 border border-primary/10">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3">Dica Profissional</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">Sua foto e logotipo são fundamentais para transmitir credibilidade nos relatórios gerados para seus clientes.</p>
                        </section>
                    </div>

                    {/* Main Settings Form */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Personal Info */}
                        <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-10 border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary text-2xl">person_edit</span>
                                Dados Pessoais
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Nome Completo</label>
                                    <input
                                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                        type="text"
                                        value={formData.nome}
                                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Cargo / Especialidade</label>
                                    <input
                                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                        type="text"
                                        value={formData.cargo}
                                        onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                                        placeholder="Ex: Nutricionista, Médico"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">E-mail (Login)</label>
                                    <input
                                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-50 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 text-slate-400 font-bold text-sm cursor-not-allowed"
                                        type="email"
                                        value={formData.email}
                                        disabled
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Opção Alternativa (URL da Foto de Perfil)</label>
                                    <input
                                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                        type="text"
                                        value={formData.avatar_url}
                                        onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                                        placeholder="https://exemplo.com/foto.jpg"
                                    />
                                </div>
                                <div className="md:col-span-2 pt-4">
                                    <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Logotipo do Negócio (Exibido nos Relatórios)</label>
                                        <div className="flex flex-col sm:flex-row gap-6 items-center">
                                            <ImagePicker
                                                accept="image/jpeg,image/png,image/webp"
                                                onFileSelected={handleLogoUpload}
                                                cameraFacingMode="environment"
                                                disabled={uploading}
                                            >
                                                {(open) => (
                                                    <button
                                                        type="button"
                                                        className="size-20 shrink-0 rounded-2xl bg-white overflow-hidden border-2 border-slate-200 flex items-center justify-center p-2 shadow-sm cursor-pointer relative group"
                                                        onClick={open}
                                                        title="Alterar Logo"
                                                    >
                                                        {formData.logo_url ? (
                                                            <img src={formData.logo_url} alt="Logo Preview" className="w-full h-full object-contain" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-slate-200 text-3xl">store</span>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-white text-sm">upload</span>
                                                        </div>
                                                    </button>
                                                )}
                                            </ImagePicker>
                                            <div className="flex-1 w-full">
                                                <input
                                                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                                    type="url"
                                                    value={formData.logo_url}
                                                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                                                    placeholder="URL da logo (PNG transparente recomendado)"
                                                />
                                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Insira a URL direta da imagem (ex: https://site.com/logo.png)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading || uploading}
                                    className="flex-1 px-10 py-5 bg-primary text-slate-950 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-70"
                                >
                                    {loading ? 'Salvando Alterações...' : 'Salvar Alterações'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/dashboard')}
                                    className="px-8 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>

                        {/* Security / Password */}
                        <form onSubmit={handleChangePassword} className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-10 border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary text-2xl">lock_reset</span>
                                Segurança e Senha
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Nova Senha</label>
                                    <input
                                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        minLength={6}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Confirmar Nova Senha</label>
                                    <input
                                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full md:w-auto px-10 py-4 bg-slate-950 text-white dark:bg-slate-800 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-125 transition-all disabled:opacity-70 shadow-lg"
                                >
                                    {loading ? 'Processando...' : 'Atualizar Senha'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Profile;
