import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';

export interface UsageQuota {
    limite: number;
    utilizadas: number;
    creditos_extra: number;
    creditos_utilizados: number;
    restantes: number;
}

/**
 * Cota de operacoes do tenant no mes corrente.
 *
 * A conta vem da RPC get_operation_remaining, que soma o limite do plano aos
 * creditos extras e desconta o que ja foi consumido. Manter a aritmetica no
 * banco evita divergencia entre o que a tela mostra e o que o
 * increment_operation_usage realmente permite gravar.
 */
export function useUsageQuota() {
    const { tenant } = useAuth();
    const [usage, setUsage] = useState<UsageQuota | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUsage = useCallback(async () => {
        if (!tenant?.id) {
            setUsage(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .rpc('get_operation_remaining', { p_tenant_id: tenant.id } as any)
            .maybeSingle();

        if (!error && data) {
            setUsage(data as unknown as UsageQuota);
        }
        setLoading(false);
    }, [tenant?.id]);

    useEffect(() => { fetchUsage(); }, [fetchUsage]);

    const isAtLimit = usage ? usage.restantes <= 0 : false;
    const isNearLimit = usage ? usage.restantes > 0 && usage.restantes <= 5 : false;

    return {
        usage,
        loading,
        isAtLimit,
        isNearLimit,
        remaining: usage?.restantes ?? null,
        refetch: fetchUsage,
    };
}
