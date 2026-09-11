import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

// ─── Schema de validação do body ──────────────────────────────────────────
const RequestSchema = z.object({
    event_type:    z.string().max(100).optional(),
    action:        z.string().max(200).optional(),
    category:      z.enum(['auth', 'operation', 'data_access', 'system', 'billing', 'error', 'cdr']).optional(),
    resource_type: z.string().max(100).optional(),
    resource_id:   z.string().uuid().optional().nullable(),
    severity:      z.enum(['info', 'warning', 'critical']).optional(),
    status:        z.enum(['success', 'error']).optional(),
    metadata:      z.record(z.unknown()).optional(),
}).passthrough();

const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:3000';
const IS_DEV = SITE_URL.startsWith('http://localhost') || SITE_URL.includes('127.0.0.1');
const ALLOWED_ORIGINS = IS_DEV
    ? [SITE_URL, 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174']
    : [SITE_URL];

function getCors(origin: string | null) {
    const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL;
    return {
        'Access-Control-Allow-Origin': o,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

// Palavras-chave cujos valores NUNCA devem aparecer nos logs
const REDACT_KEYS = [
    'password', 'senha', 'token', 'secret', 'key', 'authorization',
    'image_url', 'imagem', 'foto', 'base64', 'photo', 'credential',
];

function redactSensitive(obj: unknown, depth = 0): unknown {
    if (depth > 4 || obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(v => redactSensitive(v, depth + 1));
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        result[k] = REDACT_KEYS.some(p => k.toLowerCase().includes(p))
            ? '[REDACTED]'
            : redactSensitive(v, depth + 1);
    }
    return result;
}

serve(async (req) => {
    const cors = getCors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return new Response('Unauthorized', { status: 401, headers: cors });

        // Verificar JWT do usuário
        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: cors });

        const adminClient = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Derivar tenant_id e role do servidor — nunca confiar no cliente
        const { data: profile } = await adminClient
            .from('profiles')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        // Validação via Zod (mantém compatibilidade — campos opcionais com fallback)
        let rawBody: unknown;
        try {
            rawBody = await req.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const parsed = RequestSchema.safeParse(rawBody);
        if (!parsed.success) {
            console.error('[log-audit] validation failed:', parsed.error.issues.map(i => i.path.join('.')));
            return new Response(JSON.stringify({ error: 'Invalid input', issues: parsed.error.issues }), {
                status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }
        const body = parsed.data;

        const { error } = await adminClient.from('audit_logs').insert({
            user_id:       user.id,
            tenant_id:     profile?.tenant_id ?? null,
            role:          profile?.role ?? null,
            event_type:    body.event_type    ?? 'unknown',
            action:        body.action        ?? 'unknown',
            category:      body.category      ?? 'system',
            resource_type: body.resource_type ?? 'unknown',
            resource_id:   body.resource_id   ?? null,
            severity:      body.severity      ?? 'info',
            status:        body.status        ?? 'success',
            ip_address:    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
            user_agent:    req.headers.get('user-agent')?.slice(0, 255) ?? null,
            metadata:      redactSensitive(body.metadata ?? {}),
        });

        if (error) {
            console.error('[log-audit] insert failed:', error.message);
            return new Response(JSON.stringify({ error: 'Failed to record audit log' }), {
                status: 500,
                headers: { ...cors, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { ...cors, 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('[log-audit] unexpected error:', err);
        return new Response('Internal Server Error', { status: 500, headers: cors });
    }
});
