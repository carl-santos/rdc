import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

/**
 * csp-report
 *
 * Endpoint público que recebe relatórios de violação de Content-Security-Policy
 * enviados automaticamente pelo navegador quando algum recurso é bloqueado pela
 * CSP da aplicação. Útil para detectar tentativas de XSS, scripts maliciosos
 * injetados ou recursos legítimos sendo bloqueados em produção.
 *
 * Aceita os dois formatos:
 *   - Content-Type: application/csp-report  (legacy, CSP report-uri)
 *   - Content-Type: application/reports+json (Reporting API, CSP report-to)
 *
 * Os relatórios ficam visíveis em Supabase Dashboard → Edge Functions → Logs.
 * Para análise estruturada/alertas, encaminhar para Sentry/Logflare/etc.
 */

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response(null, { status: 405 });
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body) {
            return new Response(null, { status: 204 });
        }

        // Reporting API envia array de reports; report-uri envia objeto único
        const reports = Array.isArray(body) ? body : [body];

        for (const report of reports) {
            const cspReport = report['csp-report'] ?? report.body ?? report;
            console.warn('[csp-report]', JSON.stringify({
                blocked_uri: cspReport?.['blocked-uri'] ?? cspReport?.blockedURL,
                violated_directive: cspReport?.['violated-directive'] ?? cspReport?.effectiveDirective,
                document_uri: cspReport?.['document-uri'] ?? cspReport?.documentURL,
                source_file: cspReport?.['source-file'] ?? cspReport?.sourceFile,
                line_number: cspReport?.['line-number'] ?? cspReport?.lineNumber,
                user_agent: req.headers.get('user-agent'),
            }));
        }

        return new Response(null, { status: 204 });
    } catch (err) {
        console.error('[csp-report] Erro ao parsear:', err);
        return new Response(null, { status: 204 });
    }
});
