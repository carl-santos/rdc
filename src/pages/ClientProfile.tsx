import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { supabase } from '../utils/supabase';
import { useToast } from '../components/Toast';
import { useTerminology } from '../hooks/useTerminology';
import { Database } from '../types/database';

type Client = Database['public']['Tables']['clients']['Row'];
type Ticket = Database['public']['Tables']['support_tickets']['Row'];

const ClientProfile = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const showToast = useToast();
    const t = useTerminology();

    const [client, setClient] = useState<Client | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const [form, setForm] = useState({ nome: '', email: '', telefone: '' });

    useEffect(() => {
        if (!clientId) return;

        const load = async () => {
            setLoading(true);

            // A RLS ja restringe ao tenant do usuario; nao e preciso filtrar aqui.
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('id' as any, clientId as any)
                .maybeSingle();

            if (error || !data) {
                showToast('Registro nao encontrado.', 'error');
                navigate('/clientes', { replace: true });
                return;
            }

            const row = data as Client;
            setClient(row);
            setForm({
                nome: row.nome ?? '',
                email: row.email ?? '',
                telefone: row.telefone ?? '',
            });

            if (row.client_user_id) {
                const { data: ticketData } = await supabase
                    .from('support_tickets')
                    .select('*')
                    .eq('user_id' as any, row.client_user_id as any)
                    .order('created_at', { ascending: false })
                    .limit(10);
                setTickets((ticketData ?? []) as Ticket[]);
            }

            setLoading(false);
        };

        load();
    }, [clientId, navigate, showToast]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId) return;

        setSaving(true);
        const { error } = await supabase
            .from('clients')
            .update({
                nome: form.nome.trim(),
                email: form.email.trim() || null,
                telefone: form.telefone.trim() || null,
            } as any)
            .eq('id' as any, clientId as any);
        setSaving(false);

        if (error) {
            showToast(error.message, 'error');
            return;
        }
        showToast('Dados atualizados.', 'success');
    };

    // Exclusao logica: preserva as FKs em audit_logs e nos chamados, como exige
    // o fluxo de data_delete da LGPD.
    const handleDelete = async () => {
        if (!clientId) return;

        const { error } = await supabase
            .from('clients')
            .update({ deleted_at: new Date().toISOString() } as any)
            .eq('id' as any, clientId as any);

        if (error) {
            showToast(error.message, 'error');
            return;
        }
        showToast(`${t.client} removido.`, 'success');
        navigate('/clientes', { replace: true });
    };

    if (loading) {
        return (
            <DashboardLayout title="Perfil">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                    <p className="text-sm text-slate-500">Carregando...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="Perfil">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <Link to="/clientes" className="text-xs font-bold text-slate-500 hover:text-primary">
                    &larr; {t.clients}
                </Link>

                <div className="flex flex-wrap items-center justify-between gap-4 mt-4 mb-8">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">{client?.nome}</h1>
                    {client?.client_user_id ? (
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                            Portal ativo
                        </span>
                    ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Sem acesso ao portal
                        </span>
                    )}
                </div>

                <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <h2 className="sm:col-span-2 text-sm font-black uppercase tracking-widest text-slate-400">
                        {t.clientData}
                    </h2>
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
                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                        >
                            {saving ? 'Salvando...' : 'Salvar alteracoes'}
                        </button>
                    </div>
                </form>

                <section className="mt-8">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">
                        Chamados recentes
                    </h2>
                    {tickets.length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhum chamado.</p>
                    ) : (
                        <div className="grid gap-2">
                            {tickets.map(ticket => (
                                <div key={ticket.id} className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{ticket.subject}</p>
                                        <p className="text-xs text-slate-500">#{ticket.ticket_number}</p>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {ticket.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-6">
                    {confirmingDelete ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="text-sm text-slate-600 dark:text-slate-300">{t.deleteClient}</p>
                            <button
                                onClick={handleDelete}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs"
                            >
                                Confirmar exclusao
                            </button>
                            <button
                                onClick={() => setConfirmingDelete(false)}
                                className="px-4 py-2 rounded-lg font-bold text-xs text-slate-500"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setConfirmingDelete(true)}
                            className="text-xs font-bold text-red-600 hover:underline"
                        >
                            {t.deleteClient}
                        </button>
                    )}
                </section>
            </div>
        </DashboardLayout>
    );
};

export default ClientProfile;
