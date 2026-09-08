import { useAuth } from '../contexts/AuthContext';

/**
 * Returns tenant gating info: whether operations are blocked
 * and appropriate messaging based on tenant status.
 */
export function useTenantGate() {
    const { tenant } = useAuth();

    const status = tenant?.status ?? 'active';
    const isActive = status === 'active';
    const isSuspended = status === 'suspended';
    const isCanceled = status === 'canceled';
    const isBlocked = !isActive;

    const message = isSuspended
        ? 'Sua assinatura está suspensa. Regularize o pagamento para continuar usando a plataforma.'
        : isCanceled
            ? 'Sua assinatura foi cancelada. Assine novamente para usar a plataforma.'
            : '';

    return { isActive, isSuspended, isCanceled, isBlocked, message, status };
}
