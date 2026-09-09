import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { listRepresentatives } from '../hooks/useCdr';

export function useRepresentatives() {
    const { tenant } = useAuth();
    return useQuery({
        queryKey: ['cdr-representatives', tenant?.id],
        queryFn: () => listRepresentatives(tenant!.id),
        enabled: !!tenant?.id,
    });
}
