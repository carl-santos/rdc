import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import NotificationBell from '../components/NotificationBell';
import { resolveStorageUrl } from '../utils/storageUrl';

interface ClientLayoutProps {
    children: React.ReactNode;
    title?: string;
}

const navItems = [
    { to: '/cliente/dashboard', icon: 'home', label: 'Início' },
    { to: '/cliente/configuracoes', icon: 'settings', label: 'Configurações' },
    { to: '/cliente/suporte', icon: 'support_agent', label: 'Ajuda e Suporte' },
    { to: '/cliente/chamados', icon: 'confirmation_number', label: 'Meus Chamados' },
    { to: '/cliente/lgpd', icon: 'shield', label: 'LGPD' },
];

const bottomNavItems = [
    { to: '/cliente/dashboard', icon: 'home', label: 'Início' },
    { to: '/cliente/suporte', icon: 'support_agent', label: 'Suporte' },
    { to: '/cliente/configuracoes', icon: 'settings', label: 'Config.' },
];

const ClientLayout = ({ children, title }: ClientLayoutProps) => {
    const { profile, user, signOut } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        supabase.from('clients').select('foto_url').eq('client_user_id', user.id as any).maybeSingle()
            .then(async ({ data }) => {
                // SEC-01: foto_url pode ser uma referência de bucket privado → Signed URL.
                if ((data as any)?.foto_url) setPhotoUrl(await resolveStorageUrl((data as any).foto_url));
            });
    }, [user?.id]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [sidebarOpen]);

    const clientName = profile?.nome || 'Cliente';

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            {/* Skip navigation — acessibilidade */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-bold focus:shadow-lg"
            >
                Pular para o conteúdo principal
            </a>

            {/* Backdrop (mobile) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:z-auto flex-shrink-0`}>
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <Link to="/cliente/dashboard" className="flex items-center gap-2">
                        <div className="bg-primary size-7 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                            <span className="material-symbols-outlined text-base">vital_signs</span>
                        </div>
                        <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">SaaS Foundation</span>
                    </Link>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Profile button */}
                <Link
                    to="/cliente/configuracoes"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 p-3 mx-3 mt-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
                >
                    <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-primary/30 flex-shrink-0 flex items-center justify-center">
                        {photoUrl ? (
                            <img src={photoUrl} alt={clientName} className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-slate-400 text-xl">person</span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{clientName}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Meu Perfil</p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-base flex-shrink-0">chevron_right</span>
                </Link>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                }`
                            }
                        >
                            <span className="material-symbols-outlined text-xl">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Sign out */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
                {/* Header */}
                <header className="min-h-[56px] md:h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Abrir menu"
                        >
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        {title && <h1 className="text-base md:text-lg font-bold truncate">{title}</h1>}
                    </div>
                    <div className="flex items-center gap-2">
                        <NotificationBell />
                        {/* Profile button (mobile header) */}
                        <Link to="/cliente/configuracoes" className="lg:hidden">
                            <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-primary/30 flex items-center justify-center">
                                {photoUrl ? (
                                    <img src={photoUrl} alt={clientName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="material-symbols-outlined text-slate-400 text-base">person</span>
                                )}
                            </div>
                        </Link>
                    </div>
                </header>

                <div id="main-content" className="flex-1 p-4 md:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto w-full">
                    {children}
                </div>

                <footer className="p-6 pb-24 lg:pb-6 text-center text-slate-400 text-xs border-t border-slate-100 dark:border-slate-900 flex items-center justify-center gap-4">
                    <span>© 2026 SaaS Foundation</span>
                    <Link to="/privacidade" className="hover:text-primary transition-colors">Privacidade</Link>
                    <Link to="/termos" className="hover:text-primary transition-colors">Termos</Link>
                </footer>
            </main>

            {/* Bottom navigation — mobile only */}
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 py-2">
                {bottomNavItems.map(item => {
                    const isActive = location.pathname === item.to;
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors min-w-[56px] ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                            <span className="text-[9px] font-black uppercase tracking-wider">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>
        </div>
    );
};

export default ClientLayout;
