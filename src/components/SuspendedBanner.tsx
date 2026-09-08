import { Link } from 'react-router-dom';
import { useTenantGate } from '../hooks/useTenantGate';

/**
 * Banner displayed at the top of pages when the tenant is suspended or canceled.
 * Renders nothing if the tenant is active.
 */
export default function SuspendedBanner() {
    const { isBlocked, isSuspended, message } = useTenantGate();

    if (!isBlocked) return null;

    return (
        <div className={`rounded-lg border px-4 py-3 mb-6 flex items-center gap-3 ${
            isSuspended
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-red-50 border-red-300 text-red-800'
        }`}>
            <span className="material-icons text-xl">
                {isSuspended ? 'warning' : 'cancel'}
            </span>
            <p className="flex-1 text-sm">{message}</p>
            <Link
                to="/assinatura"
                className={`text-sm font-medium underline ${
                    isSuspended ? 'text-amber-700' : 'text-red-700'
                }`}
            >
                Ver assinatura
            </Link>
        </div>
    );
}
