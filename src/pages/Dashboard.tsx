import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../layouts/DashboardLayout';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUsageQuota } from '../hooks/useUsageQuota';
import { useTerminology } from '../hooks/useTerminology';
import { useTenantGate } from '../hooks/useTenantGate';

interface Stats {
    clients: number;
    openTickets: number;
    teamMembers: number;
}

async function fetchStats(tenantId: string): Promise<Stats> {
    const [clientsRes, ticketsRes, teamRes] = await Promise.all([
        supabase.from('clients')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id' as any, tenantId as any)
            .is('deleted_at', null),
        supabase.from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id' as any, tenantId as any)
            .in('status', ['open', 'in_progress']),
        supabase.from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id' as any, tenantId as any)
            .in('role', ['tenant_admin', 'collaborator']),
    ]);

    return {
        clients: clientsRes.count ?? 0,
        openTickets: ticketsRes.count ?? 0,
        teamMembers: teamRes.count ?? 0,
    };
}

const Dashboard = () => {
    const { tenant, profile } = useAuth();
    const { usage, isAtLimit, isNearLimit } = useUsageQuota();
    const t = useTerminology();
    const { isBlocked, message: blockedMessage } = useTenantGate();

    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats', tenant?.id],
        queryFn: () => fetchStats(tenant!.id),
        enabled: !!tenant?.id,
    });

    const consumidas = usage ? usage.utilizadas + usage.creditos_utilizados : 0;
    const total = usage ? usage.limite + usage.creditos_extra : 0;
    const percentual = total > 0 ? Math.min(100, Math.round((consumidas / total) * 100)) : 0;

    const cards = [
        { label: t.clients, value: stats?.clients, to: '/clientes', icon: 'groups' },
        { label: 'Chamados abertos', value: stats?.openTickets, to: '/meus-chamados', icon: 'forum' },
        { label: 'Equipe', value: stats?.teamMembers, to: '/equipes', icon: 'diversity_3' },
    ];

    return (
        <DashboardLayout title="Início">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                        Ola, {profile?.nome?.split(' ')[0] ?? 'bem-vindo'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">{tenant?.nome_fantasia}</p>
                </div>

                {isBlocked && (
                    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                        {blockedMessage}{' '}
                        <Link to="/assinatura" className="font-bold underline">Ver assinatura</Link>
                    </div>
                )}

                {/* Cota do mes */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                            Operacoes do mes
                        </h2>
                        <p className="text-sm text-slate-500">
                            {consumidas} de {total}
                        </p>
                    </div>

                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-primary'
                            }`}
                            style={{ width: `${percentual}%` }}
                        />
                    </div>

                    {isAtLimit && (
                        <p className="mt-4 text-sm text-red-600">
                            Limite atingido.{' '}
                            <Link to="/assinatura" className="font-bold underline">Comprar creditos</Link>
                        </p>
                    )}
                    {!isAtLimit && isNearLimit && (
                        <p className="mt-4 text-sm text-amber-600">
                            Restam {usage?.restantes} operacoes neste mes.
                        </p>
                    )}
                </section>

                {/* Indicadores */}
                <div className="grid gap-4 sm:grid-cols-3">
                    {cards.map(card => (
                        <Link
                            key={card.label}
                            to={card.to}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:border-primary transition-colors"
                        >
                            <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-primary text-xl">{card.icon}</span>
                            </div>
                            <p className="text-3xl font-black text-slate-900 dark:text-white">
                                {isLoading ? '—' : card.value ?? 0}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">{card.label}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Dashboard;
