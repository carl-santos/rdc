import React, { useState, useEffect } from 'react';
import ClientLayout from '../../layouts/ClientLayout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import ImagePicker from '../../components/ImagePicker';
import StorageImage from '../../components/StorageImage';
import { isValidImageContent } from '../../utils/imageValidation';

interface ClientData {
    id: string;
    tenant_id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    foto_url: string | null;
}

const ClientSettings = () => {
    const { user, refreshAuth } = useAuth();
    const [client, setClient] = useState<ClientData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [form, setForm] = useState({
        nome: '',
        telefone: '',
        foto_url: '',
    });

    useEffect(() => {
        if (user) fetchClient();
    }, [user?.id]);

    const fetchClient = async () => {
        try {
            const { data } = await supabase
                .from('clients')
                .select('id, tenant_id, nome, email, telefone, foto_url')
                .eq('client_user_id', user!.id as any)
                .maybeSingle();

            if (data) {
                const p = data as any;
                setClient(p);
                setForm({
                    nome: p.nome || '',
                    telefone: p.telefone || '',
                    foto_url: p.foto_url || '',
                });
            }
        } catch (err) {
            console.error('Error fetching client:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (file: File) => {
        if (!client) return;

        // VAL-07: valida MIME, tamanho e conteúdo (magic bytes) antes do upload.
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
        if (!ALLOWED_TYPES.includes(file.type)) {
            setMessage({ type: 'error', text: 'Formato inválido. Use JPEG, PNG ou WebP.' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Arquivo muito grande. O tamanho máximo é 5MB.' });
            return;
        }
        if (!(await isValidImageContent(file))) {
            setMessage({ type: 'error', text: 'Arquivo de imagem inválido ou corrompido.' });
            return;
        }

        setUploadingPhoto(true);
        setMessage(null);
        try {
            const ext = file.name.split('.').pop();
            const fileName = `${client.tenant_id}/client_${client.id}_${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Grava a referência "bucket/caminho"; a URL é assinada na leitura.
            const newUrl = `avatars/${fileName}`;
            await supabase.from('clients').update({ foto_url: newUrl } as any).eq('id', client.id as any);

            setForm((prev) => ({ ...prev, foto_url: newUrl }));
            setClient((prev) => prev ? { ...prev, foto_url: newUrl } : prev);
            setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao fazer upload da foto.' });
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!client || !user) return;

        setSaving(true);
        setMessage(null);
        try {
            const updates: Record<string, any> = {
                nome: form.nome,
                telefone: form.telefone || null,
            };

            const { error: clientErr } = await supabase
                .from('clients')
                .update(updates as any)
                .eq('id', client.id as any);

            if (clientErr) throw clientErr;

            // Also update profile nome
            const { error: profileErr } = await supabase
                .from('profiles')
                .update({ nome: form.nome } as any)
                .eq('id', user.id as any);

            if (profileErr) throw profileErr;

            await refreshAuth();
            setMessage({ type: 'success', text: 'Dados salvos com sucesso!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao salvar dados.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ClientLayout title="Configurações">
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
                </div>
            </ClientLayout>
        );
    }

    return (
        <ClientLayout title="Configurações">
            <div className="max-w-2xl space-y-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Meus Dados</h2>
                    <p className="text-slate-500 text-sm mt-1">Atualize suas informações pessoais e medidas.</p>
                </div>

                {/* Photo */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">photo_camera</span>
                        Foto de Perfil
                    </h3>
                    <div className="flex items-center gap-5">
                        <div className="size-20 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
                            {form.foto_url ? (
                                <StorageImage path={form.foto_url} alt="Foto" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-slate-400 text-4xl">person</span>
                            )}
                        </div>
                        <div>
                            <ImagePicker
                                accept="image/jpeg,image/png,image/webp"
                                onFileSelected={handlePhotoUpload}
                                cameraFacingMode="user"
                                disabled={uploadingPhoto}
                            >
                                {(open) => (
                                    <button
                                        type="button"
                                        onClick={open}
                                        disabled={uploadingPhoto}
                                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-base">upload</span>
                                        {uploadingPhoto ? 'Enviando...' : 'Alterar foto'}
                                    </button>
                                )}
                            </ImagePicker>
                            <p className="text-xs text-slate-400 mt-1.5">JPG ou PNG, máx. 5MB</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">person</span>
                        Informações Pessoais
                    </h3>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                            <span className="material-symbols-outlined text-lg">{message.type === 'success' ? 'check_circle' : 'error'}</span>
                            {message.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome Completo</label>
                            <input
                                type="text"
                                value={form.nome}
                                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                                placeholder="Seu nome"
                                required
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail</label>
                            <input
                                type="email"
                                value={client?.email || user?.email || ''}
                                disabled
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-100 dark:bg-slate-900 text-slate-400 outline-none text-sm cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-1">O e-mail não pode ser alterado por aqui.</p>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telefone</label>
                            <input
                                type="tel"
                                value={form.telefone}
                                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                Salvando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-base">save</span>
                                Salvar Alterações
                            </>
                        )}
                    </button>
                </form>
            </div>
        </ClientLayout>
    );
};

export default ClientSettings;
