import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';

type LgpdType   = 'data_access' | 'data_portability' | 'revoke_consent' | 'data_delete' | 'grant_consent';
type LgpdStatus = 'pending' | 'in_progress' | 'resolved' | 'rejected';

interface LgpdTicket {
    id: string;
    ticket_number: string;
    user_id: string;
    tenant_id: string | null;
    subject: string;
    description: string | null;
    created_at: string;
    lgpd_type: LgpdType | null;
    lgpd_status: LgpdStatus;
    lgpd_resolved_at: string | null;
    lgpd_processed_by: string | null;
    user_nome?: string;
    user_email?: string;
    tenant_nome?: string;
}

const TYPE_META: Record<LgpdType, { label: string; icon: string; color: string }> = {
    data_access:      { label: 'Acesso aos dados',  icon: 'manage_search', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    data_portability: { label: 'Portabilidade',     icon: 'download',      color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800' },
    revoke_consent:   { label: 'Revogar consentimento', icon: 'block',     color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    grant_consent:    { label: 'Reativar consentimento', icon: 'restart_alt', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
    data_delete:      { label: 'Excluir conta',     icon: 'delete_forever', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
};

const STATUS_META: Record<LgpdStatus, { label: string; color: string }> = {
    pending:     { label: 'Pendente',    color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' },
    in_progress: { label: 'Em andamento', color: 'text-blue-700  bg-blue-100  dark:bg-blue-900/30  border-blue-200  dark:border-blue-800' },
    resolved:    { label: 'Atendido',    color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800' },
    rejected:    { label: 'Rejeitado',   color: 'text-slate-700 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

const DEADLINE_DAYS = 15; // LGPD: 15 dias úteis para resposta

function daysRemaining(createdAt: string): number {
    const created = new Date(createdAt).getTime();
    const deadline = created + DEADLINE_DAYS * 24 * 60 * 60 * 1000;
    return Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
}

const AdminLgpd = () => {
    const { profile } = useAuth();
    const [tickets, setTickets]   = useState<LgpdTicket[]>([]);
    const [loading, setLoading]   = useState(true);
    const [filterStatus, setFilterStatus] = useState<LgpdStatus | 'all'>('pending');
    const [filterType, setFilterType]     = useState<LgpdType | 'all'>('all');
    const [search, setSearch]     = useState('');

    const isPlatformAdmin = profile?.role === 'platform_admin';

    useEffect(() => {
        fetchTickets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            // Tickets LGPD
            const { data: ticketsData, error } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('category', 'lgpd' as any)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const list = (ticketsData as any[]) || [];
            if (list.length === 0) {
                setTickets([]);
                return;
            }

            // Enriquece com profile do user e nome do tenant
            const userIds   = [...new Set(list.map(t => t.user_id).filter(Boolean))];
            const tenantIds = [...new Set(list.map(t => t.tenant_id).filter(Boolean))];

            const [{ data: profilesData }, { data: tenantsData }] = await Promise.all([
                userIds.length > 0
                    ? supabase.from('profiles').select('id, nome, email').in('id' as any, userIds as any)
                    : Promise.resolve({ data: [] as any[] }),
                tenantIds.length > 0
                    ? supabase.from('tenants').select('id, nome_fantasia').in('id' as any, tenantIds as any)
                    : Promise.resolve({ data: [] as any[] }),
            ]);

            const profilesMap = new Map((profilesData as any[] || []).map(p => [p.id, p]));
            const tenantsMap  = new Map((tenantsData  as any[] || []).map(t => [t.id, t]));

            const enriched: LgpdTicket[] = list.map(t => ({
                ...t,
                user_nome:   profilesMap.get(t.user_id)?.nome ?? '—',
                user_email:  profilesMap.get(t.user_id)?.email ?? '—',
                tenant_nome: t.tenant_id ? (tenantsMap.get(t.tenant_id)?.nome_fantasia ?? '—') : '(sem tenant)',
            }));

            setTickets(enriched);
        } catch (err) {
            console.error('Error fetching LGPD tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        return tickets.filter(t => {
            if (filterStatus !== 'all' && t.lgpd_status !== filterStatus) return false;
            if (filterType   !== 'all' && t.lgpd_type   !== filterType)   return false;
            if (search) {
                const s = search.toLowerCase();
                if (
                    !t.ticket_number.toLowerCase().includes(s) &&
                    !t.user_nome?.toLowerCase().includes(s) &&
                    !t.user_email?.toLowerCase().includes(s)
                ) return false;
            }
            return true;
        });
    }, [tickets, filterStatus, filterType, search]);

    const counts = useMemo(() => ({
        all:         tickets.length,
        pending:     tickets.filter(t => t.lgpd_status === 'pending').length,
        in_progress: tickets.filter(t => t.lgpd_status === 'in_progress').length,
        resolved:    tickets.filter(t => t.lgpd_status === 'resolved').length,
        rejected:    tickets.filter(t => t.lgpd_status === 'rejected').length,
        overdue:     tickets.filter(t => t.lgpd_status !== 'resolved' && t.lgpd_status !== 'rejected' && daysRemaining(t.created_at) < 0).length,
    }), [tickets]);

    return (
        <DashboardLayout title="Central LGPD">
            <div className="space-y-6">
                {/* Header / KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                        { key: 'pending',     label: 'Pendentes',  value: counts.pending,     color: 'text-amber-600' },
                        { key: 'in_progress', label: 'Em andamento', value: counts.in_progress, color: 'text-blue-600' },
                        { key: 'resolved',    label: 'Atendidos',  value: counts.resolved,    color: 'text-emerald-600' },
                        { key: 'overdue',     label: 'Atrasados',  value: counts.overdue,     color: 'text-red-600' },
                    ] as const).map(kpi => (
                        <div key={kpi.key} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{kpi.label}</p>
                            <p className={`text-3xl font-black mt-1 ${kpi.color}`}>{kpi.value}</p>
                        </div>
                    ))}
                </div>

                {/* Filtros */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    {/* Busca */}
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <span className="material-symbols-outlined text-xl">search</span>
                        </span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por nº, nome ou e-mail..."
                            className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary"
                        />
                    </div>
                    {/* Tipo */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary"
                    >
                        <option value="all">Todos os tipos</option>
                        <option value="data_access">Acesso aos dados</option>
                        <option value="data_portability">Portabilidade</option>
                        <option value="revoke_consent">Revogar consentimento</option>
                        <option value="grant_consent">Reativar consentimento</option>
                        <option value="data_delete">Excluir conta</option>
                    </select>
                    {/* Status */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary"
                    >
                        <option value="all">Todos os status</option>
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em andamento</option>
                        <option value="resolved">Atendido</option>
                        <option value="rejected">Rejeitado</option>
                    </select>
                </div>

                {/* Lista */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="size-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-slate-300 text-4xl">shield</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nenhuma solicitação</h3>
                            <p className="text-slate-500 text-sm">Sem solicitações LGPD para os filtros selecionados.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-950">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Solicitante</th>
                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Tenant</th>
                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Prazo</th>
                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filtered.map(t => {
                                    const type = t.lgpd_type ? TYPE_META[t.lgpd_type] : null;
                                    const status = STATUS_META[t.lgpd_status];
                                    const remaining = daysRemaining(t.created_at);
                                    const isResolved = t.lgpd_status === 'resolved' || t.lgpd_status === 'rejected';
                                    const overdue = !isResolved && remaining < 0;
                                    const canActOnDelete = isPlatformAdmin || t.lgpd_type !== 'data_delete';

                                    return (
                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{t.user_nome}</span>
                                                    <span className="text-xs text-slate-500">{t.user_email}</span>
                                                    <span className="text-[10px] font-mono text-slate-400 mt-0.5">{t.ticket_number}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {type ? (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase rounded-full border ${type.color}`}>
                                                        <span className="material-symbols-outlined text-[12px]">{type.icon}</span>
                                                        {type.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-xs text-slate-600 dark:text-slate-400">{t.tenant_nome}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase rounded-full border ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {isResolved ? (
                                                    <span className="text-xs text-slate-400">—</span>
                                                ) : overdue ? (
                                                    <span className="text-xs font-black text-red-600">Atrasado {Math.abs(remaining)}d</span>
                                                ) : (
                                                    <span className={`text-xs font-bold ${remaining <= 3 ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                                        {remaining}d restantes
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                {canActOnDelete ? (
                                                    <Link
                                                        to={`/admin/lgpd/${t.id}`}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-black uppercase tracking-wider hover:bg-primary hover:text-white transition-colors"
                                                    >
                                                        Processar
                                                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                                                    </Link>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">requer platform_admin</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Aviso de prazo */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400 flex items-start gap-2">
                    <span className="material-symbols-outlined text-slate-400 mt-0.5 flex-shrink-0">info</span>
                    <span>
                        A LGPD exige resposta em até <strong>15 dias úteis</strong> a partir do recebimento da solicitação. Solicitações atrasadas geram risco de sanção pela ANPD.
                    </span>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AdminLgpd;
