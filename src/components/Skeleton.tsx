/**
 * Skeleton – animated placeholder para loading states.
 *
 * Uso básico:
 *   <Skeleton className="h-8 w-48" />         ← linha de texto
 *   <Skeleton className="h-32 w-full" />       ← bloco / card
 *   <Skeleton circle className="size-12" />    ← avatar circular
 */

interface SkeletonProps {
    className?: string;
    circle?: boolean;
}

export function Skeleton({ className = '', circle = false }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-slate-200 dark:bg-slate-700/60 ${circle ? 'rounded-full' : 'rounded-lg'} ${className}`}
            aria-hidden="true"
        />
    );
}

/** Card de stat do dashboard — 2 linhas + barra de progresso */
export function StatCardSkeleton() {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-8 w-20 mt-1" />
                </div>
                <Skeleton circle className="size-9" />
            </div>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Skeleton className="h-3 w-52" />
            </div>
        </div>
    );
}

/** Linha de tabela de cliente */
export function ClientRowSkeleton() {
    return (
        <tr>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <Skeleton circle className="size-8 shrink-0" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-24" />
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-20" />
                </div>
            </td>
            <td className="px-6 py-4">
                <Skeleton className="h-5 w-14 rounded-full" />
            </td>
            <td className="px-6 py-4">
                <div className="flex justify-end gap-2">
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-7 w-16 rounded-lg" />
                </div>
            </td>
        </tr>
    );
}

/** Card de cliente (mobile) */
export function ClientCardSkeleton() {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex gap-3 items-start shadow-sm">
            <Skeleton circle className="size-12 shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-2.5 w-28" />
                <div className="flex gap-3 mt-1">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-2.5 w-14" />
                </div>
            </div>
        </div>
    );
}

/** Card de plano (pricing) */
export function PlanCardSkeleton({ featured = false }: { featured?: boolean }) {
    return (
        <div className={`bg-white dark:bg-slate-800 p-10 rounded-3xl flex flex-col gap-6 border ${featured ? 'border-2 border-primary/30 scale-105 shadow-xl' : 'border-slate-200 dark:border-slate-700 shadow-sm'}`}>
            <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-3 flex-grow">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
        </div>
    );
}
