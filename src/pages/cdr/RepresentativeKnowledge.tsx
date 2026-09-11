import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useTenantGate } from '../../hooks/useTenantGate';
import { listDocuments, extractCdrDocument } from '../../hooks/useCdr';
import { DigitalRepresentative } from '../../types/cdr';
import {
    CDR_ALLOWED_EXTENSIONS,
    CDR_MAX_FILE_BYTES,
    contentTypeForCdrDocument,
    extractDocumentText,
    formatFileSize,
    isAllowedCdrDocument,
    needsServerExtraction,
} from '../../utils/cdrDocuments';

interface OutletCtx {
    representative: DigitalRepresentative;
}

const statusLabel: Record<string, string> = {
    pending: 'Aguardando extração',
    ready: 'Pronto',
    failed: 'Falhou',
};

const RepresentativeKnowledge = () => {
    const { representative } = useOutletContext<OutletCtx>();
    const { tenant, user } = useAuth();
    const showToast = useToast();
    const { logEvent } = useAuditLog();
    const { isBlocked } = useTenantGate();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [extractingId, setExtractingId] = useState<string | null>(null);

    const { data: documents = [], isLoading, refetch } = useQuery({
        queryKey: ['cdr-documents', representative.id],
        queryFn: () => listDocuments(representative.id),
    });

    const handleFiles = async (files: FileList | null) => {
        if (!files || !tenant?.id || isBlocked) return;
        setUploading(true);

        for (const file of Array.from(files)) {
            if (!isAllowedCdrDocument(file)) {
                showToast(`Formato não suportado: ${file.name}`, 'error');
                continue;
            }
            if (file.size > CDR_MAX_FILE_BYTES) {
                showToast(`${file.name} excede 10 MB.`, 'error');
                continue;
            }

            const objectId = crypto.randomUUID();
            const storagePath = `${tenant.id}/${representative.id}/${objectId}-${file.name}`;
            const contentType = contentTypeForCdrDocument(file);
            const { error: uploadError } = await supabase.storage
                .from('cdr-documents')
                .upload(storagePath, file, { contentType, upsert: false });

            if (uploadError) {
                showToast(`Falha no upload de ${file.name}: ${uploadError.message}`, 'error');
                continue;
            }

            const extracted = await extractDocumentText(file);
            const { data: inserted, error: insertError } = await supabase.from('cdr_documents').insert({
                tenant_id: tenant.id,
                representative_id: representative.id,
                uploaded_by: user?.id ?? null,
                file_name: file.name,
                storage_path: storagePath,
                mime_type: contentType,
                file_size: file.size,
                status: extracted ? 'ready' : 'pending',
                extracted_text: extracted,
            }).select('id').single();

            if (insertError || !inserted) {
                await supabase.storage.from('cdr-documents').remove([storagePath]);
                showToast(insertError?.message || 'Não foi possível registrar o documento.', 'error');
                continue;
            }

            if (!extracted && needsServerExtraction(file.name)) {
                try {
                    await extractCdrDocument(inserted.id);
                } catch (extractErr) {
                    const message = extractErr instanceof Error ? extractErr.message : 'Falha na extração.';
                    showToast(`${file.name}: ${message}`, 'error');
                }
            }

            logEvent({
                event_type: 'cdr_document_uploaded',
                action: 'Enviou documento para o representante',
                category: 'cdr',
                resource_type: 'cdr_document',
                resource_id: representative.id,
                metadata: { file_name: file.name },
            });
        }

        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
        refetch();
        showToast('Documentos atualizados.', 'success');
    };

    const handleDelete = async (docId: string, storagePath: string) => {
        const { error } = await supabase.from('cdr_documents').delete().eq('id', docId);
        if (error) {
            showToast(error.message, 'error');
            return;
        }
        await supabase.storage.from('cdr-documents').remove([storagePath]);
        logEvent({
            event_type: 'cdr_document_deleted',
            action: 'Removeu documento do representante',
            category: 'cdr',
            resource_type: 'cdr_document',
            resource_id: representative.id,
        });
        refetch();
    };

    const handleExtract = async (docId: string) => {
        setExtractingId(docId);
        try {
            await extractCdrDocument(docId);
            showToast('Texto extraído. O arquivo já entra no chat.', 'success');
            await refetch();
        } catch (extractErr) {
            const message = extractErr instanceof Error ? extractErr.message : 'Falha na extração.';
            showToast(message, 'error');
            await refetch();
        } finally {
            setExtractingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold">Base de conhecimento</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Envie textos, PDFs e apresentações autorizados. Arquivos .txt, .md, .csv, .pdf, .docx e .pptx
                    têm o texto extraído para o chat. .doc e .ppt antigos precisam ser salvos em formato moderno.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                    Formatos: {CDR_ALLOWED_EXTENSIONS.join(', ')} · até 10 MB
                </p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={CDR_ALLOWED_EXTENSIONS.join(',')}
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading || isBlocked}
                    className="mt-4 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                >
                    {uploading ? 'Enviando e extraindo…' : 'Enviar documentos'}
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
                </div>
            ) : documents.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum documento ainda.</p>
            ) : (
                <ul className="space-y-3">
                    {documents.map((doc) => (
                        <li
                            key={doc.id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4"
                        >
                            <div className="min-w-0">
                                <p className="font-semibold truncate">{doc.file_name}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {statusLabel[doc.status] ?? doc.status} · {formatFileSize(doc.file_size)}
                                </p>
                                {doc.status === 'failed' && doc.error_message && (
                                    <p className="text-xs text-red-500 mt-1">{doc.error_message}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                {(doc.status === 'pending' || doc.status === 'failed') && needsServerExtraction(doc.file_name) && (
                                    <button
                                        onClick={() => handleExtract(doc.id)}
                                        disabled={extractingId === doc.id || isBlocked}
                                        className="text-primary text-sm font-semibold hover:underline disabled:opacity-50"
                                    >
                                        {extractingId === doc.id ? 'Extraindo…' : 'Extrair texto'}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(doc.id, doc.storage_path)}
                                    className="text-red-500 text-sm font-semibold hover:underline"
                                >
                                    Remover
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default RepresentativeKnowledge;
