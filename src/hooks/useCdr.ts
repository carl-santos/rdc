import { supabase } from '../utils/supabase';
import {
    CdrConversation,
    CdrDocument,
    CdrMessage,
    CdrSessionMode,
    DigitalRepresentative,
} from '../types/cdr';

export async function listRepresentatives(tenantId: string): Promise<DigitalRepresentative[]> {
    const { data, error } = await supabase
        .from('digital_representatives')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DigitalRepresentative[];
}

export async function getRepresentative(id: string): Promise<DigitalRepresentative | null> {
    const { data, error } = await supabase
        .from('digital_representatives')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return (data as DigitalRepresentative | null) ?? null;
}

export async function extractCdrDocument(documentId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('cdr-extract', {
        body: { document_id: documentId },
    });
    if (error) {
        const payload = data as { error?: string } | null;
        throw new Error(payload?.error || error.message || 'Falha na extração.');
    }
    const payload = data as { error?: string; status?: string } | null;
    if (payload?.error) throw new Error(payload.error);
}

export async function listDocuments(representativeId: string): Promise<CdrDocument[]> {
    const { data, error } = await supabase
        .from('cdr_documents')
        .select('*')
        .eq('representative_id', representativeId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as CdrDocument[];
}

export async function listConversations(tenantId: string): Promise<(CdrConversation & { representative_nome?: string })[]> {
    const { data, error } = await supabase
        .from('cdr_conversations')
        .select('*, digital_representatives(nome)')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(80);
    if (error) throw error;
    return ((data ?? []) as Array<CdrConversation & { digital_representatives?: { nome: string } | null }>).map((row) => ({
        ...row,
        representative_nome: row.digital_representatives?.nome,
    }));
}

export async function listMessages(conversationId: string): Promise<CdrMessage[]> {
    const { data, error } = await supabase
        .from('cdr_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as CdrMessage[];
}

export function sessionPath(representativeId: string, mode: CdrSessionMode): string {
    if (mode === 'chat') return `/representantes/${representativeId}/chat`;
    if (mode === 'presentation') return `/representantes/${representativeId}/apresentacao`;
    if (mode === 'class') return `/representantes/${representativeId}/aula`;
    return `/representantes/${representativeId}/reuniao`;
}
