import { useEffect, useState } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';

interface TenantAdmin {
    profile_id: string;
    profile_nome: string;
    profile_email: string;
    tenant_id: string;
    tenant_nome_fantasia: string;
    tenant_status: string;
    tenant_created_at: string;
    tenant_plano_id: string | null;
    plan_nome: string | null;
    plan_preco: number | null;
}

interface Invoice {
    id: string;
    status: string;
    value: number;
    due_date: string;
    payment_date: string | null;
    billing_type: string | null;
    invoice_url: string | null;
}

interface Usage {
    clientes_cadastrados: number;
    operacoes_utilizadas: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    active:    { label: 'Ativo',           color: 'bg-emerald-500/10 text-emerald-600', dot: 'bg-emerald-500' },
    canceling: { label: 'Em cancelamento', color: 'bg-orange-500/10 text-orange-500',   dot: 'bg-orange-500' },
    suspended: { label: 'Suspenso',        color: 'bg-red-500/10 text-red-500',         dot: 'bg-red-500' },
    pending:   { label: 'Pendente',        color: 'bg-yellow-500/10 text-yellow-600',   dot: 'bg-yellow-500' },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
    PENDING:   { label: 'Pendente',   color: 'bg-yellow-100 text-yellow-700' },
    RECEIVED:  { label: 'Pago',       color: 'bg-emerald-100 text-emerald-700' },
    CONFIRMED: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-700' },
    OVERDUE:   { label: 'Em atraso',  color: 'bg-red-100 text-red-600' },
    REFUNDED:  { label: 'Estornado',  color: 'bg-slate-100 text-slate-500' },
    CANCELED:  { label: 'Cancelado',  color: 'bg-slate-100 text-slate-500' },
};

function formatDate(iso: string | null) {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
}

function formatCurrency(v: number) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const AdminTenants = () => {
    const [tenantAdmins, setTenantAdmins] = useState<TenantAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [mrr, setMrr] = useState(0);

    // Detail panel
    const [selected, setSelected] = useState<TenantAdmin | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [usage, setUsage] = useState<Usage | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Impersonate
    const [impersonateLoading, setImpersonateLoading] = useState(false);
    const [impersonateError, setImpersonateError] = useState<string | null>(null);
    const [showImpersonateConfirm, setShowImpersonateConfirm] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch tenant_admin profiles with their tenant and plan
            const { data: profiles, error } = await (supabase as any)
                .from('profiles')
                .select(`
                    id, nome, email, tenant_id,
                    tenants!profiles_tenant_id_fkey(
                        id, nome_fantasia, status, created_at, plano_id,
                        plans(id, nome, preco_mensal)
                    )
                `)
                .eq('role', 'tenant_admin')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const rows: TenantAdmin[] = (profiles || [])
                .filter((p: any) => p.tenants)
                .map((p: any) => {
                    const t = p.tenants;
                    const plan = t.plans;
                    return {
                        profile_id: p.id,
                        profile_nome: p.nome || '—',
                        profile_email: p.email || '—',
                        tenant_id: t.id,
                        tenant_nome_fantasia: t.nome_fantasia || '—',
                        tenant_status: t.status || 'pending',
                        tenant_created_at: t.created_at,
                        tenant_plano_id: t.plano_id || null,
                        plan_nome: plan?.nome || null,
                        plan_preco: plan?.preco_mensal ?? null,
                    };
                });

            setTenantAdmins(rows);

            // MRR: sum of active tenant plan prices
            const { data: mrrRows } = await (supabase as any)
                .from('tenants')
                .select('plans(preco_mensal)')
                .eq('status', 'active');
            setMrr(mrrRows?.reduce((s: number, t: any) => s + (t.plans?.preco_mensal || 0), 0) || 0);
        } catch (err) {
            console.error('[AdminTenants] fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const openDetail = async (ta: TenantAdmin) => {
        setSelected(ta);
        setInvoices([]);
        setUsage(null);
        setImpersonateError(null);
        setShowImpersonateConfirm(false);
        setDetailLoading(true);
        try {
            const [invRes, usageRes] = await Promise.all([
                (supabase as any)
                    .from('billing_invoices')
                    .select('id, status, value, due_date, payment_date, billing_type, invoice_url')
                    .eq('tenant_id', ta.tenant_id)
                    .order('due_date', { ascending: false })
                    .limit(10),
                (supabase as any)
                    .from('usage_tracking')
                    .select('clientes_cadastrados, operacoes_utilizadas')
                    .eq('tenant_id', ta.tenant_id)
                    .order('mes_referencia', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
            ]);
            if (invRes.data) setInvoices(invRes.data);
            if (usageRes.data) setUsage(usageRes.data);
        } catch (err) {
            console.error('[AdminTenants] detail fetch error:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleImpersonate = async () => {
        if (!selected) return;
        setImpersonateLoading(true);
        setImpersonateError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada.');

            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ target_user_id: selected.profile_id }),
                }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar link de impersonação.');

            // Open in new tab to preserve admin session
            window.open(data.actionLink, '_blank');
            setShowImpersonateConfirm(false);
        } catch (err) {
            setImpersonateError(err instanceof Error ? err.message : 'Erro interno.');
        } finally {
            setImpersonateLoading(false);
        }
    };

    const filtered = tenantAdmins.filter(ta => {
        const matchesSearch =
            ta.tenant_nome_fantasia.toLowerCase().includes(search.toLowerCase()) ||
            ta.profile_email.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || ta.tenant_status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const counts = {
        total:     tenantAdmins.length,
        active:    tenantAdmins.filter(t => t.tenant_status === 'active').length,
        pending:   tenantAdmins.filter(t => t.tenant_status === 'pending').length,
        canceling: tenantAdmins.filter(t => t.tenant_status === 'canceling').length,
        suspended: tenantAdmins.filter(t => t.tenant_status === 'suspended').length,
    };

    return (
        <DashboardLayout title="Assinantes">
            <div className="space-y-8 pb-20">

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'Total',           value: counts.total,                                                                          icon: 'groups',           color: 'text-primary'       },
                        { label: 'Ativos',          value: counts.active,                                                                         icon: 'verified',         color: 'text-emerald-500'   },
                        { label: 'Pendentes',       value: counts.pending,                                                                        icon: 'schedule',         color: 'text-yellow-500'    },
                        { label: 'Em Cancelamento', value: counts.canceling,                                                                      icon: 'cancel',           color: 'text-orange-500'    },
                        { label: 'Suspensos',       value: counts.suspended,                                                                      icon: 'block',            color: 'text-red-500'       },
                        { label: 'MRR',             value: `R$\u00a0${mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,               icon: 'payments',         color: 'text-blue-500'      },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:scale-110 transition-transform">
                                    <span className={`material-symbols-outlined text-xl ${kpi.color}`}>{kpi.icon}</span>
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">{kpi.label}</p>
                            <p className={`text-3xl font-black text-slate-900 dark:text-white mt-1 italic uppercase tracking-tighter ${loading ? 'opacity-30' : ''}`}>
                                {loading ? '·' : kpi.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Search + Filters */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-48">
                        <span className="absolute inset-y-0 left-4 flex items-center text-slate-300 pointer-events-none">
                            <span className="material-symbols-outlined">search</span>
                        </span>
                        <input
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Pesquisar por nome ou e-mail..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary text-slate-600 dark:text-slate-300"
                    >
                        <option value="all">Todos os status</option>
                        <option value="active">Ativos</option>
                        <option value="pending">Pendentes</option>
                        <option value="canceling">Em cancelamento</option>
                        <option value="suspended">Suspensos</option>
                    </select>
                    <button
                        onClick={fetchData}
                        className="p-3 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-2xl transition-all"
                        title="Atualizar"
                    >
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assinante</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrador</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Início</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {loading ? (
                                    <tr><td colSpan={6} className="py-20 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto" />
                                    </td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">
                                        Nenhum registro encontrado.
                                    </td></tr>
                                ) : filtered.map(ta => {
                                    const st = STATUS_CONFIG[ta.tenant_status] || STATUS_CONFIG.pending;
                                    return (
                                        <tr
                                            key={ta.tenant_id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all group cursor-pointer"
                                            onClick={() => openDetail(ta)}
                                        >
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm uppercase group-hover:scale-110 transition-transform">
                                                        {ta.tenant_nome_fantasia.substring(0, 2)}
                                                    </div>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{ta.tenant_nome_fantasia}</p>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{ta.profile_nome}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{ta.profile_email}</p>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                {ta.plan_nome ? (
                                                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg border border-primary/20">
                                                        {ta.plan_nome}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold uppercase">Sem plano</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap">
                                                <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase w-fit ${st.color}`}>
                                                    <span className={`size-1.5 rounded-full ${st.dot}`} />
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-[10px] font-bold text-slate-500 uppercase">
                                                {formatDate(ta.tenant_created_at)}
                                            </td>
                                            <td className="px-8 py-6 whitespace-nowrap text-right">
                                                <button
                                                    onClick={e => { e.stopPropagation(); openDetail(ta); }}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                    title="Ver Detalhes"
                                                >
                                                    <span className="material-symbols-outlined">arrow_forward</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-8 py-5 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {filtered.length} de {tenantAdmins.length} assinantes
                        </p>
                    </div>
                </div>
            </div>

            {/* Detail Slide-over Panel */}
            {selected && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div
                        className="flex-1 bg-slate-950/50 backdrop-blur-sm"
                        onClick={() => setSelected(null)}
                    />
                    {/* Panel */}
                    <div className="w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-y-auto">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-lg uppercase">
                                    {selected.tenant_nome_fantasia.substring(0, 2)}
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{selected.tenant_nome_fantasia}</h2>
                                    {(() => {
                                        const st = STATUS_CONFIG[selected.tenant_status] || STATUS_CONFIG.pending;
                                        return (
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase ${st.color}`}>
                                                <span className={`size-1.5 rounded-full ${st.dot}`} />
                                                {st.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 p-8 space-y-8">
                            {/* Admin Info */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrador</h3>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 flex items-center gap-4">
                                    <div className="size-10 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-primary text-xl">person</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">{selected.profile_nome}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{selected.profile_email}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Plan Info */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plano</h3>
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-xl">verified</span>
                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase">
                                            {selected.plan_nome || 'Sem plano'}
                                        </p>
                                    </div>
                                    {selected.plan_preco !== null && (
                                        <p className="text-sm font-black text-primary">
                                            R$ {formatCurrency(selected.plan_preco)}<span className="text-[10px] text-slate-400 font-bold">/mês</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Usage Metrics */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Métricas de Uso (Mês Atual)</h3>
                                {detailLoading ? (
                                    <div className="py-8 flex justify-center">
                                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 text-center">
                                            <p className="text-3xl font-black text-slate-900 dark:text-white italic">{usage?.clientes_cadastrados ?? '—'}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Clientes</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 text-center">
                                            <p className="text-3xl font-black text-slate-900 dark:text-white italic">{usage?.operacoes_utilizadas ?? '—'}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Operações</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Billing History */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico de Faturas</h3>
                                {detailLoading ? (
                                    <div className="py-8 flex justify-center">
                                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
                                    </div>
                                ) : invoices.length === 0 ? (
                                    <div className="py-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        Nenhuma fatura registrada.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {invoices.map(inv => {
                                            const st = INV_STATUS[inv.status] || { label: inv.status, color: 'bg-slate-100 text-slate-500' };
                                            return (
                                                <div key={inv.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900 dark:text-white">{formatDate(inv.due_date)}</p>
                                                        {inv.payment_date && (
                                                            <p className="text-[10px] text-slate-400">Pago em {formatDate(inv.payment_date)}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-sm font-black text-slate-900 dark:text-white">R$ {formatCurrency(inv.value)}</p>
                                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${st.color}`}>{st.label}</span>
                                                        {inv.invoice_url && (
                                                            <a href={inv.invoice_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-primary transition-colors">
                                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Impersonate */}
                            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acesso como Cliente</h3>
                                {impersonateError && (
                                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-sm text-red-600 dark:text-red-400 font-medium">
                                        <span className="material-symbols-outlined text-lg flex-shrink-0">error</span>
                                        {impersonateError}
                                    </div>
                                )}
                                {!showImpersonateConfirm ? (
                                    <button
                                        onClick={() => setShowImpersonateConfirm(true)}
                                        className="w-full flex items-center justify-center gap-3 py-4 rounded-[1.5rem] bg-slate-900 dark:bg-slate-700 text-white font-black text-[10px] uppercase tracking-[0.2em] hover:brightness-125 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-base">manage_accounts</span>
                                        Impersonar Cliente
                                    </button>
                                ) : (
                                    <div className="p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-4">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-amber-500 text-xl flex-shrink-0">warning</span>
                                            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                                Você será redirecionado para uma nova aba e estará logado como <strong>{selected.profile_nome}</strong> ({selected.profile_email}). Sua sessão admin permanece ativa nesta aba.
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleImpersonate}
                                                disabled={impersonateLoading}
                                                className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {impersonateLoading && <span className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white" />}
                                                Confirmar
                                            </button>
                                            <button
                                                onClick={() => setShowImpersonateConfirm(false)}
                                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:border-slate-300 transition-all"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <p className="text-[9px] text-slate-400 text-center font-medium">
                                    A sessão de impersonação abre em nova aba. Link válido por 1 hora.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default AdminTenants;
