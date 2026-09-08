import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    tenant: Tenant | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);

    // Track the last userId for which we've fetched data
    const fetchedForUserId = useRef<string | null>(null);
    const isFetching = useRef(false);

    const fetchProfileAndTenant = async (userId: string) => {
        // Already fetching or already fetched for this user
        if (isFetching.current || fetchedForUserId.current === userId) {
            return;
        }

        isFetching.current = true;

        try {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId as any)
                .maybeSingle();

            if (!profileData) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                const role = (currentUser?.user_metadata?.role as string) || 'collaborator';
                const nome = role === 'client'
                    ? (currentUser?.user_metadata?.nome || 'Cliente')
                    : 'Profissional';
                setProfile({ id: userId, nome, email: currentUser?.email || '', role } as any);
                fetchedForUserId.current = userId;
                return;
            }

            setProfile(profileData);
            fetchedForUserId.current = userId;

            if (profileData.tenant_id) {
                const { data: tenantData } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('id', profileData.tenant_id as any)
                    .maybeSingle();

                if (tenantData) {
                    setTenant(tenantData as any);
                }
            }
        } catch (err) {
            // Try to get role from user_metadata rather than assuming collaborator
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                const role = (currentUser?.user_metadata?.role as string) || 'collaborator';
                setProfile({ id: userId, nome: role === 'client' ? 'Cliente' : 'Profissional', email: currentUser?.email || '', role } as any);
            } catch {
                setProfile({ id: userId, nome: 'Usuário', email: '', role: 'collaborator' } as any);
            }
            fetchedForUserId.current = userId;
        } finally {
            isFetching.current = false;
            setLoading(false);
        }
    };

    useEffect(() => {
        // The Supabase recommended pattern:
        // 1. onAuthStateChange handles ALL session events (including initial load)
        // 2. We do NOT use async/await inside the callback - we call a sync setter
        // 3. A separate useEffect reacts to session changes
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                setUser(null);
                setProfile(null);
                setTenant(null);
                fetchedForUserId.current = null;
                isFetching.current = false;
                setLoading(false);
                try { sessionStorage.removeItem('app_access_logged'); } catch { /* noop */ }
                return;
            }

            // For INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED
            if (session?.user) {
                setUser(session.user);
                // Marco Civil (Lei 12.965/2014, Art. 15): registra o acesso à aplicação — uma vez
                // por sessão de navegador. Fire-and-forget; o log-audit captura IP + user-agent no
                // servidor e grava em audit_logs (durável, coberto por backup ≥ 6 meses).
                try {
                    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && sessionStorage.getItem('app_access_logged') !== '1') {
                        sessionStorage.setItem('app_access_logged', '1');
                        supabase.functions.invoke('log-audit', {
                            body: { event_type: 'app_access', action: 'Acesso à aplicação', category: 'auth', resource_type: 'session', status: 'success' },
                            headers: { Authorization: `Bearer ${session.access_token}` },
                        }).catch(() => {});
                    }
                } catch { /* fire-and-forget */ }
                // Trigger fetch via setUser - the second useEffect will handle it
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // React to user changes and fetch their profile/tenant
    useEffect(() => {
        if (user?.id) {
            fetchProfileAndTenant(user.id);
        } else if (user === null) {
            // Only clear loading if we've actually determined there's no user
            // (avoid clearing on initial render before auth check completes)
        }
    }, [user?.id]);

    const signOut = async () => {
        fetchedForUserId.current = null;
        isFetching.current = false;
        setLoading(true);
        await supabase.auth.signOut();
    };

    const refreshAuth = async () => {
        fetchedForUserId.current = null;
        isFetching.current = false;
        if (user?.id) {
            setLoading(true);
            await fetchProfileAndTenant(user.id);
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, tenant, loading, signOut, refreshAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
