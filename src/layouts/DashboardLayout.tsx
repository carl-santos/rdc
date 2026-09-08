import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import PlanSelectionModal from '../components/PlanSelectionModal';
import PaymentPendingScreen from '../components/PaymentPendingScreen';
import { useAuth } from '../contexts/AuthContext';
import { useTerminology } from '../hooks/useTerminology';

interface Breadcrumb {
    label: string;
    path?: string;
}

const ROUTE_BREADCRUMBS: { pattern: RegExp; crumbs: Breadcrumb[] }[] = [
    { pattern: /^\/clientes$/, crumbs: [{ label: 'Clientes' }] },
    { pattern: /^\/clientes\/[^/]+$/, crumbs: [{ label: 'Clientes', path: '/clientes' }, { label: 'Perfil' }] },
    { pattern: /^\/equipes$/, crumbs: [{ label: 'Equipes' }] },
    { pattern: /^\/configuracoes$/, crumbs: [{ label: 'Configurações' }] },
    { pattern: /^\/assinatura$/, crumbs: [{ label: 'Assinatura' }] },
    { pattern: /^\/suporte$/, crumbs: [{ label: 'Suporte' }] },
    { pattern: /^\/meus-chamados$/, crumbs: [{ label: 'Chamados' }] },
    { pattern: /^\/perfil$/, crumbs: [{ label: 'Perfil' }] },
    { pattern: /^\/lgpd$/, crumbs: [{ label: 'LGPD' }] },
    { pattern: /^\/admin\/tenants$/, crumbs: [{ label: 'Admin', path: '/admin/dashboard' }, { label: 'Assinantes' }] },
    { pattern: /^\/admin\/plans$/, crumbs: [{ label: 'Admin', path: '/admin/dashboard' }, { label: 'Planos' }] },
    { pattern: /^\/admin\/support$/, crumbs: [{ label: 'Admin', path: '/admin/dashboard' }, { label: 'Chamados' }] },
];

interface DashboardLayoutProps {
    children: React.ReactNode;
    title: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { tenant, profile, loading } = useAuth();
    const location = useLocation();
    const terminology = useTerminology();

    const breadcrumbs = ROUTE_BREADCRUMBS.find(r => r.pattern.test(location.pathname))?.crumbs ?? [];

    const bottomNavItems = [
        { icon: 'dashboard', label: 'Início', path: '/dashboard' },
        { icon: 'groups', label: terminology.clients, path: '/clientes' },
        { icon: 'person', label: 'Perfil', path: '/perfil' },
    ];

    const isTenantMember =
        !loading &&
        profile?.role !== 'platform_admin' &&
        (profile?.role === 'tenant_admin' || profile?.role === 'collaborator') &&
        !!(tenant);

    // No plan, no subscription → choose a plan
    const showPlanModal = isTenantMember && !(tenant as any).plano_id && !(tenant as any).asaas_subscription_id;

    // Subscription created but payment not yet confirmed → waiting screen
    const showPaymentPending = isTenantMember && !(tenant as any).plano_id && !!(tenant as any).asaas_subscription_id;

    return (
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
            {/* Skip navigation — acessibilidade */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-bold focus:shadow-lg"
            >
                Pular para o conteúdo principal
            </a>

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
                <header className="min-h-[56px] md:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-4 md:px-8">
                    <div className="flex items-center gap-3">
                        {/* Hamburger — mobile only */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Abrir menu"
                        >
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div>
                            {breadcrumbs.length > 0 && (
                                <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-slate-400 mb-0.5">
                                    <Link to="/dashboard" className="hover:text-primary transition-colors">Início</Link>
                                    {breadcrumbs.map((crumb, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[11px]">chevron_right</span>
                                            {crumb.path && i < breadcrumbs.length - 1 ? (
                                                <Link to={crumb.path} className="hover:text-primary transition-colors">{crumb.label}</Link>
                                            ) : (
                                                <span className="text-slate-600 dark:text-slate-300 font-medium">{crumb.label}</span>
                                            )}
                                        </span>
                                    ))}
                                </nav>
                            )}
                            <h1 className="text-base md:text-lg font-bold truncate leading-tight">{title}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationBell />
                    </div>
                </header>

                <div id="main-content" className="p-4 md:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto w-full">
                    {children}
                </div>

                <footer className="mt-auto p-6 md:p-8 pb-24 lg:pb-8 text-center text-slate-400 text-xs border-t border-slate-100 dark:border-slate-900 flex flex-col items-center gap-2">
                    <p>© 2026 Plataforma SaaS Foundation B2B. Apenas para Uso Profissional.</p>
                    <Link to="/privacidade" className="hover:text-primary transition-colors uppercase font-black tracking-widest text-[9px]">Política de Privacidade & LGPD</Link>
                </footer>
            </main>

            {/* Bottom navigation — mobile only */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 py-2">
                {bottomNavItems.map(item => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors min-w-[56px] ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <span className={`material-symbols-outlined text-2xl transition-all ${isActive ? 'filled' : ''}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                            <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {showPlanModal && <PlanSelectionModal />}
            {showPaymentPending && <PaymentPendingScreen />}
        </div>
    );
};

export default DashboardLayout;
