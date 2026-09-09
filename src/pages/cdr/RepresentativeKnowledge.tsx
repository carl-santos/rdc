import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { useAuditLog } from '../../hooks/useAuditLog';
import { useTenantGate } from '../../hooks/useTenantGate';
import { listDocuments } from '../../hooks/useCdr';
import { DigitalRepresentative } from '../../types/cdr';
import {
    CDR_ALLOWED_EXTENSIONS,
    CDR_MAX_FILE_BYTES,
    extractDocumentText,
    formatFileSize,
    isAllowedCdrDocument,
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
            const { error: uploadError } = await supabase.storage
                .from('cdr-documents')
                .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });

            if (uploadError) {
                showToast(`Falha no upload de ${file.name}.`, 'error');
                continue;
            }

            const extracted = await extractDocumentText(file);
            const { error: insertError } = await supabase.from('cdr_documents').insert({
                tenant_id: tenant.id,
                representative_id: representative.id,
                uploaded_by: user?.id ?? null,
                file_name: file.name,
                storage_path: storagePath,
                mime_type: file.type || null,
                file_size: file.size,
                status: extracted ? 'ready' : 'pending',
                extracted_text: extracted,
            });

            if (insertError) {
                await supabase.storage.from('cdr-documents').remove([storagePath]);
                showToast(insertError.message, 'error');
                continue;
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

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold">Base de conhecimento</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Envie textos, PDFs e apresentações autorizados. Arquivos .txt, .md e .csv entram no chat imediatamente;
                    os demais ficam armazenados para extração nas próximas sprints.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                    Formatos: {CDR_ALLOWED_EXTENSIONS.join(', ')} · até 10 MB
                </p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading || isBlocked}
                    className="mt-4 bg-primary text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                >
                    {uploading ? 'Enviando…' : 'Enviar documentos'}
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
                            </div>
                            <button
                                onClick={() => handleDelete(doc.id, doc.storage_path)}
                                className="text-red-500 text-sm font-semibold hover:underline"
                            >
                                Remover
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default RepresentativeKnowledge;
