import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
    reference_id: string | null;
    created_at: string;
}

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        const { data, error } = await (supabase as any)
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
        if (error) {
            return;
        }
        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter((n: Notification) => !n.read).length);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user) return;
        fetchNotifications();

        // Re-fetch when tab becomes visible again (user returns from another tab)
        const onVisible = () => {
            if (document.visibilityState === 'visible') fetchNotifications();
        };
        document.addEventListener('visibilitychange', onVisible);

        // Realtime subscription for live updates
        const channel = (supabase as any)
            .channel(`notifications_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload: any) => {
                    const newNotif = payload.new as Notification;
                    setNotifications(prev => {
                        if (prev.some(n => n.id === newNotif.id)) return prev;
                        return [newNotif, ...prev];
                    });
                    setUnreadCount(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            document.removeEventListener('visibilitychange', onVisible);
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const markAsRead = async (id: string) => {
        await (supabase as any).from('notifications').update({ read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        if (!user) return;
        await (supabase as any)
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    return { notifications, unreadCount, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
