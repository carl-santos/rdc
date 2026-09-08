import { supabase } from './supabase';

/**
 * Resolução de URLs de arquivos privados via Signed URLs.
 *
 * Todos os buckets da foundation são privados: nada é acessível por URL
 * pública. Na leitura, geramos uma Signed URL de curta duração.
 *
 * Esta função aceita tanto o formato de referência "bucket/caminho" quanto uma
 * URL completa já gravada no banco, e deixa passar URLs externas sem alteração.
 */

// Buckets privados que exigem Signed URL.
const SIGNED_BUCKETS = ['avatars', 'tenant-logos', 'ticket-attachments'];

// TTL da Signed URL (segundos): generoso para sessões longas, curto o bastante
// para não virar um link permanente.
export const SIGNED_URL_TTL = 60 * 60; // 1h

// Cache em memória para evitar re-assinar a mesma imagem a cada render.
const cache = new Map<string, { url: string; exp: number }>();

/**
 * Decompõe o valor gravado em { bucket, path } quando ele aponta para um bucket
 * sensível. Retorna null quando deve ser usado como está (URL externa, avatar
 * público, vazio).
 */
export function parseStorageRef(stored?: string | null): { bucket: string; path: string } | null {
    if (!stored) return null;

    // URL completa do Supabase Storage (público ou já assinado)
    const m = stored.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
    if (m) {
        const bucket = m[1];
        return SIGNED_BUCKETS.includes(bucket)
            ? { bucket, path: decodeURIComponent(m[2]) }
            : null; // outro bucket (avatars/ai-templates) — manter URL
    }

    // Qualquer outra URL absoluta (CDN externo, googleusercontent, etc.) — passthrough
    if (/^https?:\/\//i.test(stored)) return null;

    // Referência "bucket/caminho/arquivo" (novo formato de gravação)
    const slash = stored.indexOf('/');
    if (slash > 0) {
        const bucket = stored.slice(0, slash);
        if (SIGNED_BUCKETS.includes(bucket)) {
            return { bucket, path: stored.slice(slash + 1) };
        }
    }

    return null;
}

/**
 * Converte o valor gravado em uma URL exibível/baixável.
 * - Bucket sensível → Signed URL (com cache).
 * - Caso contrário → o próprio valor (passthrough).
 */
export async function resolveStorageUrl(stored?: string | null): Promise<string | null> {
    if (!stored) return null;

    const ref = parseStorageRef(stored);
    if (!ref) return stored; // passthrough

    const key = `${ref.bucket}/${ref.path}`;
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.exp > now) return hit.url;

    const { data, error } = await supabase.storage
        .from(ref.bucket)
        .createSignedUrl(ref.path, SIGNED_URL_TTL);

    if (error || !data?.signedUrl) return null;

    // Expira no cache 5 min antes do TTL real para não servir URL prestes a vencer.
    cache.set(key, { url: data.signedUrl, exp: now + (SIGNED_URL_TTL - 300) * 1000 });
    return data.signedUrl;
}
