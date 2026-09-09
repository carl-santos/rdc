import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../../layouts/DashboardLayout';
import { getRepresentative } from '../../hooks/useCdr';
import { MODE_LABELS } from '../../types/cdr';

const tabs = [
    { to: '', label: 'Visão geral', end: true },
    { to: 'conhecimento', label: 'Conhecimento', end: false },
    { to: 'chat', label: MODE_LABELS.chat, end: false },
    { to: 'apresentacao', label: MODE_LABELS.presentation, end: false },
    { to: 'aula', label: MODE_LABELS.class, end: false },
    { to: 'reuniao', label: MODE_LABELS.meeting, end: false },
];

const RepresentativeLayout = () => {
    const { id } = useParams<{ id: string }>();

    const { data: representative, isLoading, error, refetch } = useQuery({
        queryKey: ['cdr-representative', id],
        queryFn: () => getRepresentative(id!),
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <DashboardLayout title="Representante">
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                </div>
            </DashboardLayout>
        );
    }

    if (error || !representative) {
        return (
            <DashboardLayout title="Representante">
                <p className="text-sm text-slate-500">Não foi possível carregar este representante.</p>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title={representative.nome}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                <div className="mb-6">
                    <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">Representante digital</p>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">{representative.nome}</h1>
                    {representative.descricao && (
                        <p className="text-sm text-slate-500 mt-1">{representative.descricao}</p>
                    )}
                </div>

                <nav className="flex gap-1 overflow-x-auto mb-6 border-b border-slate-200 dark:border-slate-800">
                    {tabs.map((tab) => (
                        <NavLink
                            key={tab.to || 'index'}
                            to={tab.to}
                            end={tab.end}
                            className={({ isActive }) =>
                                `whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                                    isActive
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                }`
                            }
                        >
                            {tab.label}
                        </NavLink>
                    ))}
                </nav>

                <Outlet context={{ representative, reload: refetch }} />
            </div>
        </DashboardLayout>
    );
};

export default RepresentativeLayout;
