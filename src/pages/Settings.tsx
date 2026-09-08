import React, { useState, useEffect } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

const Settings = () => {
    const { tenant, refreshAuth } = useAuth();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [formData, setFormData] = useState({
        nome_fantasia: '',
        cpf_cnpj: '',
        segmento: '',
        cep: '',
        logradouro: '',
        cidade: '',
        estado: '',
        telefone: '',
        whatsapp_atendimento: '',
        logo_url: ''
    });

    useEffect(() => {
        if (tenant) {
            setFormData({
                nome_fantasia: tenant.nome_fantasia || '',
                cpf_cnpj: tenant.cpf_cnpj || '',
                segmento: tenant.segmento || '',
                cep: tenant.cep || '',
                logradouro: tenant.logradouro || '',
                cidade: tenant.cidade || '',
                estado: tenant.estado || '',
                telefone: tenant.telefone || '',
                whatsapp_atendimento: tenant.whatsapp_atendimento || '',
                logo_url: tenant.logo_url || ''
            });
            setInitialLoading(false);
        }
    }, [tenant]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); // Assuming 'setSaving' should be 'setLoading' based on existing state
        setMessage(null); // Clear previous messages

        try {
            if (!tenant?.id) throw new Error('Tenant ID não encontrado.');

            const { error } = await supabase
                .from('tenants')
                .update(formData as any)
                .eq('id' as any, tenant.id as any);

            if (error) throw error;

            await refreshAuth(); // Refresh auth context to get updated tenant data
            setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
        } catch (err: any) {
            console.error('Error updating tenant:', err);
            setMessage({ type: 'error', text: err.message || 'Erro ao salvar configurações' });
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <DashboardLayout title="Configurações">
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Configurações do Negócio">
            <div className="max-w-4xl">
                <header className="mb-8">
                    <p className="text-slate-500 dark:text-slate-400">Gerencie as informações básicas, identidade visual e contatos do seu negócio.</p>
                </header>

                {message && (
                    <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                        : 'bg-red-50 border border-red-200 text-red-600'
                        }`}>
                        <span className="material-symbols-outlined">
                            {message.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <p className="text-sm font-medium">{message.text}</p>
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-8">
                    {/* Perfil do Negócio */}
                    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/20">
                            <span className="material-symbols-outlined text-primary">business</span>
                            <h3 className="text-lg font-bold">Perfil do Negócio</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome do Negócio</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.nome_fantasia}
                                    onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                                    placeholder="Ex: Acme Ltda"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">CNPJ / CPF</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.cpf_cnpj}
                                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                                    placeholder="00.000.000/0000-00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Segmento</label>
                                <select
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    value={formData.segmento}
                                    onChange={(e) => setFormData({ ...formData, segmento: e.target.value })}
                                >
                                    {/* Os valores abaixo alimentam useTerminology: definem como a
                                        interface chama o cliente final deste tenant. */}
                                    <option value="">Selecione um segmento</option>
                                    <option value="geral">Geral</option>
                                    <option value="educacao">Educação</option>
                                    <option value="saude">Saúde</option>
                                    <option value="associacao">Associação</option>
                                    <option value="juridico">Jurídico</option>
                                    <option value="imobiliario">Imobiliário</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Branding */}
                    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/20">
                            <span className="material-symbols-outlined text-primary">palette</span>
                            <h3 className="text-lg font-bold">Branding</h3>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Logotipo da empresa</label>
                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="w-32 h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden group hover:border-primary transition-colors">
                                    {formData.logo_url ? (
                                        <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="material-symbols-outlined text-slate-400 text-4xl">add_photo_alternate</span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-3">
                                        <input
                                            type="text"
                                            placeholder="URL da imagem (logo)"
                                            className="flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5 text-xs text-slate-900 dark:text-white"
                                            value={formData.logo_url}
                                            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Por enquanto, forneça a URL de uma imagem. <br />
                                        <strong className="text-slate-700 dark:text-slate-300">Este logotipo aparecerá nos relatórios gerados.</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Endereço e Contato */}
                    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/20">
                            <span className="material-symbols-outlined text-primary">location_on</span>
                            <h3 className="text-lg font-bold">Endereço e Contato</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-6 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">CEP</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.cep}
                                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                                    placeholder="00000-000"
                                />
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Logradouro</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.logradouro}
                                    onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })}
                                    placeholder="Ex: Av. Paulista, 1000"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cidade</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.cidade}
                                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                                    placeholder="Cidade"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Estado</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.estado}
                                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                    placeholder="Ex: SP"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Telefone Comercial</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.telefone}
                                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                                    placeholder="(11) 9999-9999"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">WhatsApp de Atendimento</label>
                                <input
                                    className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:border-primary focus:ring focus:ring-primary/20 transition-all p-3 text-sm text-slate-900 dark:text-white"
                                    type="text"
                                    value={formData.whatsapp_atendimento}
                                    onChange={(e) => setFormData({ ...formData, whatsapp_atendimento: e.target.value })}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                        </div>
                    </section>

                    <div className="flex items-center justify-end gap-3 pt-6">
                        <button
                            type="button"
                            className="px-6 py-2.5 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary text-slate-900 px-10 py-3 rounded-lg font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-70"
                        >
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
};

export default Settings;
