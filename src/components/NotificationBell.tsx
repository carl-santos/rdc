import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, Notification } from '../hooks/useNotifications';

const TYPE_ICON: Record<string, string> = {
    operation_ready:          'description',
    client_registered:        'person_add',
    new_ticket:                'confirmation_number',
    ticket_replied:            'forum',
    lgpd_consent_revoked:      'shield_lock',
    lgpd_consent_granted:      'verified',
    lgpd_data_access_resolved: 'manage_search',
    lgpd_data_portability_resolved: 'download',
    lgpd_revoke_consent_resolved:   'block',
    lgpd_grant_consent_resolved:    'restart_alt',
};

const TYPE_COLOR: Record<string, string> = {
    operation_ready:          'text-emerald-500',
    client_registered:        'text-primary',
    new_ticket:                'text-amber-500',
    ticket_replied:            'text-violet-500',
    lgpd_consent_revoked:      'text-red-500',
    lgpd_consent_granted:      'text-emerald-500',
    lgpd_data_access_resolved: 'text-blue-500',
    lgpd_data_portability_resolved: 'text-violet-500',
    lgpd_revoke_consent_resolved:   'text-amber-500',
    lgpd_grant_consent_resolved:    'text-emerald-500',
};

function timeAgo(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
}

const NotificationBell = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, refetch } = useNotifications();
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Clicar no card só marca como lida (não navega — usuário precisa ler o texto completo
    // antes de decidir). Para navegar, há botão "Abrir" separado quando há link.
    const handleMarkRead = async (n: Notification) => {
        if (!n.read) await markAsRead(n.id);
    };

    const handleOpenLink = async (e: React.MouseEvent, n: Notification) => {
        e.stopPropagation();
        if (!n.read) await markAsRead(n.id);
        setOpen(false);
        // Blindagem (defesa em profundidade): só navega para caminho interno.
        // Rejeita protocol-relative (//) e backslash — evita open-redirect mesmo que
        // uma futura fonte de notificação passe a gerar um link externo.
        if (n.link && n.link.startsWith('/') && !n.link.startsWith('//') && !n.link.includes('\\')) {
            navigate(n.link);
        }
    };

    return (
        <div className="relative" ref={ref}>
            {/* Bell button */}
            <button
                onClick={() => { setOpen(o => !o); if (!open) refetch(); }}
                className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label={unreadCount > 0 ? `Notificações — ${unreadCount} não lidas` : 'Notificações'}
                aria-haspopup="true"
                aria-expanded={open}
            >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[20px] h-[20px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none border-2 border-white dark:border-slate-950" aria-hidden="true">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white">Notificações</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
                            >
                                Marcar todas como lidas
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                                <span className="material-symbols-outlined text-3xl">notifications_off</span>
                                <p className="text-xs font-semibold">Nenhuma notificação</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => handleMarkRead(n)}
                                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${!n.read ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                                >
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center ${!n.read ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                        <span className={`material-symbols-outlined text-base ${TYPE_COLOR[n.type] ?? 'text-slate-500'}`}>
                                            {TYPE_ICON[n.type] ?? 'circle_notifications'}
                                        </span>
                                    </div>

                                    {/* Content — texto completo, sem truncamento */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {n.title}
                                        </p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 whitespace-pre-line break-words">
                                            {n.message}
                                        </p>
                                        <div className="flex items-center justify-between mt-2 gap-2">
                                            <p className="text-[10px] text-slate-400">{timeAgo(n.created_at)}</p>
                                            {n.link && (
                                                <button
                                                    onClick={(e) => handleOpenLink(e, n)}
                                                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    Abrir
                                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Unread dot */}
                                    {!n.read && (
                                        <div className="flex-shrink-0 size-2 rounded-full bg-primary mt-1.5" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
