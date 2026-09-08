import * as Sentry from '@sentry/react';

// PROD-01 — Monitoramento de erros (Sentry).
// Ativado SOMENTE quando VITE_SENTRY_DSN está definido (produção). Sem o DSN,
// initSentry() e captureException() são no-ops — não afeta dev/local.
// `sendDefaultPii: false` evita enviar dados pessoais por padrão (LGPD).

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry(): void {
    if (!DSN) return;
    Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: 0.1,
    });
}

export function captureException(error: unknown): void {
    if (!DSN) return;
    Sentry.captureException(error);
}
