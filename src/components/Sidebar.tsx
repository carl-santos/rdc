import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTerminology } from '../hooks/useTerminology';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const location = useLocation();
    const { user, profile, signOut } = useAuth();
    const terminology = useTerminology();

    const menuItems = [
        { icon: 'dashboard', label: 'Início', path: '/dashboard' },
        { icon: 'groups', label: terminology.clients, path: '/clientes' },
        { icon: 'diversity_3', label: 'Equipes', path: '/equipes' },
        { icon: 'settings', label: 'Configurações', path: '/configuracoes' },
        { icon: 'payments', label: 'Assinaturas', path: '/assinatura' },
        { icon: 'help_center', label: 'Ajuda e Suporte', path: '/suporte' },
        { icon: 'forum', label: 'Meus Chamados', path: '/meus-chamados' },
        { icon: 'policy', label: 'LGPD', path: '/lgpd' },
    ];

    const adminItems = [
        { icon: 'admin_panel_settings', label: 'Painel Admin', path: '/admin/dashboard' },
        { icon: 'corporate_fare', label: 'Assinantes', path: '/admin/tenants' },
        { icon: 'payments', label: 'Planos', path: '/admin/plans' },
        { icon: 'headset_mic', label: 'Chamados', path: '/admin/support' },
        { icon: 'manage_search', label: 'Auditoria', path: '/admin/auditoria' },
        { icon: 'shield', label: 'Central LGPD', path: '/admin/lgpd' },
    ];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleLinkClick = () => {
        onClose();
    };

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 w-64
                    border-r border-slate-200 dark:border-slate-800
                    bg-white dark:bg-slate-950
                    flex flex-col h-screen
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:relative lg:translate-x-0 lg:z-auto
                `}
                aria-label="Menu de navegação"
            >
                <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex items-center gap-3">
                    <div className="bg-primary size-8 rounded-lg flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-xl">vital_signs</span>
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">SaaS Foundation</h2>

                    {/* Close button — mobile only */}
                    <button
                        onClick={onClose}
                        className="ml-auto lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Fechar menu"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2 hide-scrollbar">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={handleLinkClick}
                            className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${location.pathname === item.path
                                ? 'bg-primary/10 text-primary font-semibold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                                }`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            <span className="text-sm">{item.label}</span>
                        </Link>
                    ))}

                    {profile?.role === 'platform_admin' && (
                        <>
                            <div className="my-4 h-px bg-slate-100 dark:bg-slate-900 mx-2"></div>
                            <p className="px-3 text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Administração</p>
                            {adminItems.map((item) => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={handleLinkClick}
                                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${location.pathname.startsWith(item.path)
                                        ? 'bg-primary/10 text-primary font-semibold'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                                        }`}
                                >
                                    <span className="material-symbols-outlined">{item.icon}</span>
                                    <span className="text-sm">{item.label}</span>
                                </Link>
                            ))}
                        </>
                    )}

                    <div className="mt-auto">
                        <button
                            onClick={() => { signOut(); onClose(); }}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors mt-2"
                        >
                            <span className="material-symbols-outlined">logout</span>
                            <span className="text-sm font-medium">Sair</span>
                        </button>
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-900">
                    <Link
                        to="/perfil"
                        onClick={handleLinkClick}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all group"
                    >
                        <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-primary/30 transition-all shadow-sm">
                            {user?.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-slate-400">person</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                {profile?.nome || 'Carregando...'}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate uppercase tracking-widest font-black opacity-70">
                                {profile?.cargo || 'Profissional'}
                            </p>
                        </div>
                    </Link>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
