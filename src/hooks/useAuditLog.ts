import { useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

export type AuditCategory = 'auth' | 'operation' | 'data_access' | 'system' | 'billing' | 'error' | 'cdr';
export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditEventInput {
    event_type: string;
    action: string;
    category?: AuditCategory;
    resource_type?: string;
    resource_id?: string | null;
    severity?: AuditSeverity;
    status?: 'success' | 'error';
    metadata?: Record<string, unknown>;
}

/**
 * Hook fire-and-forget para registrar eventos de auditoria.
 * Nunca bloqueia a UI — erros são silenciados.
 * Inclui deduplicação para evitar logs duplicados por re-renders do React.
 *
 * Uso:
 *   const { logEvent } = useAuditLog();
 *   logEvent({ event_type: 'operation_started', action: 'Iniciou operação multi-etapa', category: 'operation', resource_type: 'client', resource_id: clientId });
 */
export function useAuditLog() {
    const { user } = useAuth();
    // Deduplicação: evita disparos duplos (React StrictMode, re-renders rápidos)
    const lastRef = useRef<{ key: string; time: number } | null>(null);

    const logEvent = useCallback((event: AuditEventInput) => {
        if (!user) return;

        const key = `${event.event_type}:${event.action}:${event.resource_id ?? ''}`;
        const now = Date.now();
        if (lastRef.current?.key === key && now - lastRef.current.time < 300) return;
        lastRef.current = { key, time: now };

        // Fire and forget — NUNCA aguarda, NUNCA propaga erros
        supabase.functions.invoke('log-audit', { body: event }).catch(() => {});
    }, [user]);

    return { logEvent };
}
