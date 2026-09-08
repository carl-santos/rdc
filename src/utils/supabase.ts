import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Captura o hash SINCRONAMENTE antes de qualquer navegação do React Router.
// O InviteRedirect muda a URL para /aceitar-convite, removendo o hash.
// Guardamos tudo no sessionStorage para recuperação manual posterior.
const _hash = window.location.hash || '';

if (_hash.includes('type=invite') || _hash.includes('type=magiclink')) {
    const linkType = _hash.includes('type=invite') ? 'invite' : 'magiclink';
    sessionStorage.setItem('app_auth_link_type', linkType);
    // Guarda o hash completo para recuperação manual da sessão no AcceptInvite
    if (_hash.includes('access_token')) {
        sessionStorage.setItem('app_invite_tokens', _hash);
    }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos nas variáveis de ambiente.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        lockType: 'local'
    } as any,
    // Adding extra resilience for fetching
    global: {
        headers: { 'x-application-name': 'app' },
    }
});


