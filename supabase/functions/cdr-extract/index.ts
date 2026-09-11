import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import mammoth from 'https://esm.sh/mammoth@1.9.0';
import { extractText as extractPdfText } from 'https://esm.sh/unpdf@1.3.2';

const RequestSchema = z.object({
    document_id: z.string().uuid(),
});

const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:3000';
const IS_DEV = SITE_URL.startsWith('http://localhost') || SITE_URL.includes('127.0.0.1');
const ALLOWED_ORIGINS = IS_DEV
    ? [SITE_URL, 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174']
    : [SITE_URL];
const MAX_CHARS = 200_000;

function getCors(origin: string | null) {
    const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL;
    return {
        'Access-Control-Allow-Origin': o,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
    });
}

function fileExtension(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function decodeXml(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function textFromOfficeXml(xml: string): string {
    const matches = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)];
    return matches.map((m) => decodeXml(m[1] ?? '')).join(' ').replace(/\s+/g, ' ').trim();
}

async function extractFromPdf(bytes: Uint8Array): Promise<string> {
    const result = await extractPdfText(bytes, { mergePages: true });
    const raw = result?.text;
    if (Array.isArray(raw)) return raw.join('\n\n').trim();
    if (typeof raw === 'string') return raw.trim();
    return '';
}

async function extractFromDocx(bytes: Uint8Array): Promise<string> {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const lib = (mammoth as { default?: { extractRawText: typeof mammoth.extractRawText } }).default ?? mammoth;
    const result = await lib.extractRawText({ arrayBuffer: copy as ArrayBuffer });
    return String(result?.value ?? '').trim();
}

async function extractFromPptx(bytes: Uint8Array): Promise<string> {
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files)
        .filter((name) => /ppt\/(slides|notesSlides)\/(slide|notesSlide)\d+\.xml$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const parts: string[] = [];
    for (const name of names) {
        const xml = await zip.files[name].async('string');
        const text = textFromOfficeXml(xml);
        if (text) parts.push(text);
    }
    return parts.join('\n\n').trim();
}

async function extractBytes(fileName: string, bytes: Uint8Array): Promise<string> {
    const ext = fileExtension(fileName);
    if (ext === '.pdf') return extractFromPdf(bytes);
    if (ext === '.docx') return extractFromDocx(bytes);
    if (ext === '.pptx') return extractFromPptx(bytes);
    if (ext === '.doc' || ext === '.ppt') {
        throw new Error('Arquivos .doc e .ppt antigos não são extraídos. Salve como .docx, .pptx ou .pdf.');
    }
    throw new Error('Formato sem extração automática.');
}

serve(async (req) => {
    const cors = getCors(req.headers.get('origin'));
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405, cors);

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json({ error: 'Não autorizado' }, 401, cors);

        const userClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (authErr || !user) return json({ error: 'Não autorizado' }, 401, cors);

        const parsed = RequestSchema.safeParse(await req.json());
        if (!parsed.success) {
            return json({ error: parsed.error.issues[0]?.message || 'Requisição inválida' }, 400, cors);
        }

        const { data: profile } = await userClient
            .from('profiles')
            .select('tenant_id, role')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile?.tenant_id || !['tenant_admin', 'collaborator', 'platform_admin'].includes(profile.role)) {
            return json({ error: 'Sem permissão' }, 403, cors);
        }

        const { data: doc, error: docErr } = await userClient
            .from('cdr_documents')
            .select('id, tenant_id, file_name, storage_path, status')
            .eq('id', parsed.data.document_id)
            .maybeSingle();

        if (docErr || !doc) return json({ error: 'Documento não encontrado' }, 404, cors);
        if (doc.tenant_id !== profile.tenant_id && profile.role !== 'platform_admin') {
            return json({ error: 'Sem permissão' }, 403, cors);
        }

        const admin = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: file, error: downloadErr } = await admin.storage
            .from('cdr-documents')
            .download(doc.storage_path);

        if (downloadErr || !file) {
            await admin.from('cdr_documents').update({
                status: 'failed',
                error_message: 'Não foi possível ler o arquivo no Storage.',
            }).eq('id', doc.id);
            return json({ error: 'Não foi possível ler o arquivo no Storage.' }, 404, cors);
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        try {
            const extracted = (await extractBytes(doc.file_name, bytes)).slice(0, MAX_CHARS);
            if (!extracted) {
                await admin.from('cdr_documents').update({
                    status: 'failed',
                    extracted_text: null,
                    error_message: 'Nenhum texto extraível neste arquivo (pode ser só imagem).',
                }).eq('id', doc.id);
                return json({ error: 'Nenhum texto extraível neste arquivo.', status: 'failed' }, 422, cors);
            }

            await admin.from('cdr_documents').update({
                status: 'ready',
                extracted_text: extracted,
                error_message: null,
            }).eq('id', doc.id);

            return json({ ok: true, status: 'ready', chars: extracted.length }, 200, cors);
        } catch (extractErr) {
            const message = extractErr instanceof Error ? extractErr.message : 'Falha na extração.';
            await admin.from('cdr_documents').update({
                status: 'failed',
                error_message: message.slice(0, 500),
            }).eq('id', doc.id);
            return json({ error: message, status: 'failed' }, 422, cors);
        }
    } catch (err) {
        console.error('cdr-extract', err);
        return json({ error: 'Erro interno' }, 500, cors);
    }
});
