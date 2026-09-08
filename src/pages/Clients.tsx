import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { useTerminology } from '../hooks/useTerminology';
import { useTenantGate } from '../hooks/useTenantGate';
import { Database } from '../types/database';

type Client = Database['public']['Tables']['clients']['Row'];

const emptyForm = { nome: '', email: '', telefone: '' };

const Clients = () => {
    const { tenant } = useAuth();
    const showToast = useToast();
    const t = useTerminology();
    const { isBlocked, message: blockedMessage } = useTenantGate();

    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const [invitingId, setInvitingId] = useState<string | null>(null);

    const fetchClients = async (tenantId: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('tenant_id' as any, tenantId as any)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            showToast('Nao foi possivel carregar a lista.', 'error');
        } else {
            setClients((data ?? []) as Client[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (tenant?.id) fetchClients(tenant.id);
    }, [tenant?.id]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return clients;
        return clients.filter(c =>
            c.nome.toLowerCase().includes(term) ||
            (c.email ?? '').toLowerCase().includes(term),
        );
    }, [clients, search]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenant?.id || !form.nome.trim()) return;

        setSaving(true);
        const { error } = await supabase.from('clients').insert({
            tenant_id: tenant.id,
            nome: form.nome.trim(),
            email: form.email.trim() || null,
            telefone: form.telefone.trim() || null,
        } as any);
        setSaving(false);

        if (error) {
            // O trigger check_tenant_active devolve a mensagem de assinatura vencida.
            showToast(error.message, 'error');
            return;
        }

        showToast(`${t.client} cadastrado.`, 'success');
        setForm(emptyForm);
        setIsFormOpen(false);
        fetchClients(tenant.id);
    };

    // Convida o cliente para o portal. O vinculo com o auth user e feito
    // pela Edge Function, que roda com service_role.
    const handleInvite = async (client: Client) => {
        if (!client.email) {
            showToast('Cadastre um e-mail antes de convidar.', 'error');
            return;
        }

        setInvitingId(client.id);
        const { error } = await supabase.functions.invoke('invite-client', {
            body: { client_id: client.id, email: client.email, nome: client.nome },
        });
        setInvitingId(null);

        if (error) {
            showToast('Falha ao enviar o convite.', 'error');
            return;
        }
        showToast('Convite enviado.', 'success');
        if (tenant?.id) fetchClients(tenant.id);
    };

    return (
        <DashboardLayout title="Clientes">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{t.manageClients}</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {clients.length} {clients.length === 1 ? t.clientLower : t.clientsLower}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(o => !o)}
                        disabled={isBlocked}
                        className="bg-primary text-white px-5 py-3 rounded-xl font-bold text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        {t.addClient}
                    </button>
                </div>

                {isBlocked && (
                    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        {blockedMessage}
                    </div>
                )}

                {isFormOpen && (
                    <form onSubmit={handleCreate} className="mb-8 grid gap-4 sm:grid-cols-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                        <input
                            value={form.nome}
                            onChange={e => setForm({ ...form, nome: e.target.value })}
                            placeholder="Nome"
                            required
                            className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                        />
                        <input
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            placeholder="E-mail"
                            type="email"
                            className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                        />
                        <input
                            value={form.telefone}
                            onChange={e => setForm({ ...form, telefone: e.target.value })}
                            placeholder="Telefone"
                            className="px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                        />
                        <div className="sm:col-span-3 flex gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIsFormOpen(false); setForm(emptyForm); }}
                                className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                )}

                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t.searchClient}
                    className="w-full mb-6 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
                />

                {loading && <p className="text-sm text-slate-500">Carregando...</p>}

                {!loading && filtered.length === 0 && (
                    <p className="text-sm text-slate-500 py-12 text-center">{t.noClients}</p>
                )}

                <div className="grid gap-3">
                    {filtered.map(client => (
                        <div
                            key={client.id}
                            className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4"
                        >
                            <div className="min-w-0">
                                <Link
                                    to={`/clientes/${client.id}`}
                                    className="font-bold text-slate-900 dark:text-white hover:text-primary transition-colors"
                                >
                                    {client.nome}
                                </Link>
                                <p className="text-xs text-slate-500 truncate">{client.email ?? 'sem e-mail'}</p>
                            </div>

                            <div className="flex items-center gap-3">
                                {client.client_user_id ? (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                        Portal ativo
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleInvite(client)}
                                        disabled={invitingId === client.id || isBlocked}
                                        className="text-xs font-bold text-primary hover:underline disabled:opacity-40"
                                    >
                                        {invitingId === client.id ? 'Enviando...' : 'Convidar para o portal'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Clients;
