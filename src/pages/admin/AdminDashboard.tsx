import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { supabase } from '../../utils/supabase';

interface PlanSlice { label: string; pct: number; color: string; }
interface ActivityItem {
    id: string;
    title: string;
    desc: string;
    time: string;
    type: string;
    typeColor: string;
    icon: string;
    iconColor: string;
}

const PLAN_COLORS = ['bg-primary', 'bg-blue-500', 'bg-cyan-500', 'bg-amber-500', 'bg-slate-600'];

const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr as string).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Agora';
    if (min < 60) return `Há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Há ${h}h`;
    const d = Math.floor(h / 24);
    return `Há ${d}d`;
};

const trendLabel = (current: number, prev: number): string => {
    if (prev === 0) return current > 0 ? '+100%' : '—';
    const pct = Math.round(((current - prev) / prev) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
};

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalTenants: 0, mrr: 0, newSubs: 0, totalSims: 0 });
    const [trends, setTrends] = useState({ tenants: '—', mrr: '—', newSubs: '—', sims: '—' });
    const [openTickets, setOpenTickets] = useState(0);
    const [planDist, setPlanDist] = useState<PlanSlice[]>([]);
    const [activity, setActivity] = useState<ActivityItem[]>([]);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchKpis(),
                fetchPlanDistribution(),
                fetchActivity(),
            ]);
        } finally {
            setLoading(false);
        }
    };

    const safeCount = async (query: any): Promise<number> => {
        const { count } = await query;
        return count || 0;
    };

    // Soma o consumo (cota do plano + creditos extras) das linhas retornadas.
    const safeSum = async (query: any): Promise<number> => {
        const { data } = await query;
        return ((data as any[]) || []).reduce(
            (acc, r) => acc + (r.operacoes_utilizadas || 0) + (r.creditos_extra_utilizados || 0),
            0,
        );
    };

    const fetchKpis = async () => {
        try {
            const now = new Date();
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

            // Source of truth: profiles with role=tenant_admin joined to tenants + plans
            // This only counts tenants that have a real admin user (excludes orphan/test tenants)
            const { data: tenantRows } = await (supabase as any)
                .from('profiles')
                .select('tenants!profiles_tenant_id_fkey(id, status, created_at, plans(preco_mensal))')
                .eq('role', 'tenant_admin');

            const rows = (tenantRows || []).map((p: any) => p.tenants).filter(Boolean);

            // Empresas Ativas: tenants with status = 'active' that have admin users
            const activeRows = rows.filter((t: any) => t.status === 'active');
            const activeTenants = activeRows.length;

            // MRR: sum preco_mensal of active tenants
            const mrrThis = activeRows.reduce((s: number, t: any) => s + (t.plans?.preco_mensal || 0), 0);

            // Novas Assinaturas: tenants created this month
            const newSubsThis = rows.filter((t: any) =>
                t.created_at && new Date(t.created_at) >= new Date(thisMonthStart)
            ).length;

            // Trends: compare with last month
            const lastMonthActiveRows = rows.filter((t: any) =>
                (t.status === 'active' || t.status === 'canceling')
                && t.created_at && new Date(t.created_at) <= new Date(lastMonthEnd)
            );
            const lastMonthTenants = lastMonthActiveRows.length;
            const mrrLast = lastMonthActiveRows.reduce((s: number, t: any) => s + (t.plans?.preco_mensal || 0), 0);
            const newSubsLast = rows.filter((t: any) =>
                t.created_at
                && new Date(t.created_at) >= new Date(lastMonthStart)
                && new Date(t.created_at) <= new Date(lastMonthEnd)
            ).length;

            // Chamados abertos + consumo de operacoes do mes.
            // O consumo vem de usage_tracking, que e a fonte de verdade da cota:
            // e o mesmo numero que increment_operation_usage grava.
            const mesAtual   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

            const [ticketsOpen, simsThis, simsLast] = await Promise.all([
                safeCount(supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open')),
                safeSum(supabase.from('usage_tracking').select('operacoes_utilizadas, creditos_extra_utilizados').eq('mes_referencia', mesAtual)),
                safeSum(supabase.from('usage_tracking').select('operacoes_utilizadas, creditos_extra_utilizados').eq('mes_referencia', mesAnterior)),
            ]);

            setStats({ totalTenants: activeTenants, mrr: mrrThis, newSubs: newSubsThis, totalSims: simsThis });
            setTrends({
                tenants: trendLabel(activeTenants, lastMonthTenants),
                mrr:     trendLabel(mrrThis, mrrLast),
                newSubs: trendLabel(newSubsThis, newSubsLast),
                sims:    trendLabel(simsThis, simsLast),
            });
            setOpenTickets(ticketsOpen);
        } catch (err) {
            console.error('KPI fetch error:', err);
        }
    };


    const fetchPlanDistribution = async () => {
        try {
            // Use profiles → tenants → plans (same pattern as AdminTenants, known to work)
            const { data, error } = await (supabase as any)
                .from('profiles')
                .select('tenants!profiles_tenant_id_fkey(status, plans(nome))')
                .eq('role', 'tenant_admin');
            if (error) { return; }
            const active = (data || []).filter((p: any) => p.tenants?.status === 'active');
            if (active.length === 0) { setPlanDist([]); return; }
            const counts: Record<string, number> = {};
            active.forEach((p: any) => {
                const name = p.tenants?.plans?.nome || 'Sem Plano';
                counts[name] = (counts[name] || 0) + 1;
            });
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            setPlanDist(
                Object.entries(counts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([label, count], i) => ({
                        label,
                        pct: Math.round((count / total) * 100),
                        color: PLAN_COLORS[i] || 'bg-slate-600',
                    }))
            );
        } catch (err) {
            console.error('Plan distribution fetch error:', err);
        }
    };

    const fetchActivity = async () => {
        try {
        const items: ActivityItem[] = [];

        // Overdue invoices
        const { data: overdue } = await (supabase as any)
            .from('billing_invoices')
            .select('id, value, updated_at, tenants(nome_fantasia)')
            .eq('status', 'OVERDUE')
            .order('updated_at', { ascending: false })
            .limit(3);
        overdue?.forEach((inv: any) => {
            const amt = `R$ ${Number(inv.value).toFixed(2).replace('.', ',')}`;
            items.push({
                id: inv.id,
                title: 'Fatura em atraso',
                desc: `${inv.tenants?.nome_fantasia || 'Tenant'} — ${amt}`,
                time: timeAgo(inv.updated_at),
                type: 'Crítico',
                typeColor: 'text-red-500',
                icon: 'error',
                iconColor: 'text-red-500',
            });
        });

        // Open support tickets
        const { data: tickets } = await (supabase as any)
            .from('support_tickets')
            .select('id, subject, created_at')
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(3);
        tickets?.forEach((t: any) => {
            items.push({
                id: t.id,
                title: 'Chamado aberto',
                desc: t.subject,
                time: timeAgo(t.created_at),
                type: 'Suporte',
                typeColor: 'text-amber-500',
                icon: 'headset_mic',
                iconColor: 'text-amber-500',
            });
        });

        // Recent confirmed payments
        const { data: payments } = await (supabase as any)
            .from('billing_invoices')
            .select('id, value, payment_date, tenants(nome_fantasia)')
            .eq('status', 'CONFIRMED')
            .order('payment_date', { ascending: false })
            .limit(3);
        payments?.forEach((p: any) => {
            const amt = `R$ ${Number(p.value).toFixed(2).replace('.', ',')}`;
            items.push({
                id: p.id,
                title: 'Pagamento confirmado',
                desc: `${p.tenants?.nome_fantasia || 'Tenant'} — ${amt}`,
                time: timeAgo(p.payment_date),
                type: 'Sucesso',
                typeColor: 'text-emerald-500',
                icon: 'check_circle',
                iconColor: 'text-emerald-500',
            });
        });

        // Recent new tenants
        const { data: newTenants } = await supabase
            .from('tenants')
            .select('id, nome_fantasia, created_at')
            .order('created_at', { ascending: false })
            .limit(2);
        newTenants?.forEach((nt: any) => {
            items.push({
                id: nt.id,
                title: 'Novo assinante',
                desc: nt.nome_fantasia,
                time: timeAgo(nt.created_at),
                type: 'Info',
                typeColor: 'text-blue-500',
                icon: 'business',
                iconColor: 'text-blue-500',
            });
        });

        // Sort by approximate recency — keep as fetched (already ordered per type)
        setActivity(items.slice(0, 6));
        } catch (err) {
            console.error('Activity fetch error:', err);
        }
    };

    const kpis = [
        { label: 'Empresas Ativas',     value: stats.totalTenants.toLocaleString('pt-BR'),                              icon: 'business',     trend: trends.tenants, color: 'text-primary'    },
        { label: 'MRR Recorrente',      value: `R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, icon: 'payments',     trend: trends.mrr,     color: 'text-emerald-500' },
        { label: 'Novas Assinaturas',   value: `+${stats.newSubs}`,                                                     icon: 'group_add',    trend: trends.newSubs, color: 'text-blue-500'   },
        { label: 'Operações no Mês',   value: stats.totalSims.toLocaleString('pt-BR'),                                  icon: 'science',      trend: trends.sims,    color: 'text-amber-500'  },
    ];

    const trendPositive = (t: string) => !t.startsWith('-');

    return (
        <DashboardLayout title="Visão Geral da Plataforma">
            <div className="space-y-8 pb-20">

                {/* Quick Nav */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Dashboard', icon: 'dashboard',       href: '/admin/dashboard', color: 'text-slate-500' },
                        { label: 'Assinantes', icon: 'business',       href: '/admin/tenants',   color: 'text-blue-500'  },
                        { label: 'Planos',    icon: 'workspace_premium', href: '/admin/plans',   color: 'text-amber-500' },
                        { label: 'Suporte',   icon: 'headset_mic',     href: '/admin/support',   color: 'text-primary', badge: openTickets > 0 ? openTickets : null },
                    ].map((nav, i) => (
                        <Link key={i} to={nav.href}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 hover:border-primary hover:shadow-lg transition-all group relative">
                            <div className={`size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${nav.color} group-hover:scale-110 transition-transform`}>
                                <span className="material-symbols-outlined">{nav.icon}</span>
                            </div>
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{nav.label}</span>
                            {nav.badge != null && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black rounded-full size-6 flex items-center justify-center shadow-md animate-pulse">
                                    {nav.badge}
                                </span>
                            )}
                        </Link>
                    ))}
                </section>

                {/* KPI Cards */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {kpis.map((kpi, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`size-10 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 ${kpi.color}`}>
                                    <span className="material-symbols-outlined">{kpi.icon}</span>
                                </div>
                                {kpi.trend !== '—' && (
                                    <span className={`text-[10px] font-black flex items-center px-2 py-0.5 rounded-full ${trendPositive(kpi.trend) ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                        <span className="material-symbols-outlined text-xs mr-0.5">
                                            {trendPositive(kpi.trend) ? 'trending_up' : 'trending_down'}
                                        </span>
                                        {kpi.trend}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest leading-none">{kpi.label}</p>
                            <h3 className="text-2xl font-black mt-2 text-slate-900 dark:text-white tracking-tighter italic uppercase">
                                {loading ? '...' : kpi.value}
                            </h3>
                        </div>
                    ))}
                </section>

                {/* Charts Area */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Plan Distribution */}
                    <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <span className="material-symbols-outlined text-[120px] text-primary">pie_chart</span>
                        </div>
                        <h4 className="font-black text-sm uppercase tracking-[0.2em] text-white mb-2 relative z-10">Dist. de Planos</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-8 relative z-10">Tenants ativos por plano</p>

                        {loading ? (
                            <div className="space-y-4 mt-6">
                                {[1,2,3].map(i => (
                                    <div key={i} className="h-8 bg-slate-800 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : planDist.length === 0 ? (
                            <p className="text-slate-500 text-xs mt-12">Nenhum tenant ativo</p>
                        ) : (
                            <div className="space-y-5 relative z-10 mt-4">
                                {planDist.map((item, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-400 truncate max-w-[120px]">{item.label}</span>
                                            <span className="text-white italic">{item.pct}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${item.pct}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Activity Log */}
                <section className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="size-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-400">notifications_active</span>
                            </div>
                            <h4 className="font-black text-sm uppercase tracking-[0.2em] text-slate-900 dark:text-white leading-none mt-1">
                                Atividade Recente
                            </h4>
                        </div>
                        <Link to="/admin/support" className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                            Ver Suporte
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {loading ? (
                            [1,2,3,4].map(i => (
                                <div key={i} className="p-6 flex items-center gap-6 animate-pulse">
                                    <div className="size-12 rounded-[1.25rem] bg-slate-100 dark:bg-slate-800" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                                    </div>
                                </div>
                            ))
                        ) : activity.length === 0 ? (
                            <div className="p-12 text-center text-slate-400 text-sm">Nenhuma atividade recente</div>
                        ) : (
                            activity.map((item, i) => (
                                <div key={i} className="p-6 flex items-center gap-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group">
                                    <div className={`size-12 rounded-[1.25rem] bg-slate-50 dark:bg-slate-800 flex items-center justify-center ${item.iconColor} group-hover:scale-110 transition-transform`}>
                                        <span className="material-symbols-outlined">{item.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight">{item.title}</p>
                                        <p className="text-[10px] text-slate-500 mt-1 font-medium truncate">{item.desc}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.time}</p>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${item.typeColor} mt-2 block`}>{item.type}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Status Footer */}
                <footer className="pt-10 flex flex-wrap items-center justify-between opacity-60">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Backend API: Online</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-emerald-500"></span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">DB: Conectado</span>
                        </div>
                    </div>
                </footer>

            </div>
        </DashboardLayout>
    );
};

export default AdminDashboard;
