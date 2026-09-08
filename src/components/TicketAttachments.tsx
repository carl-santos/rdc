import { useRef, useState } from 'react';
import { supabase } from '../utils/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingFile {
    file: File;
    previewUrl: string | null;  // URL local para imagens
}

export interface UploadedAttachment {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string | null;
    file_size: number | null;
    signedUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = 10;
const MAX_FILES = 5;

function humanSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string | null): string {
    if (!type) return 'attach_file';
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'picture_as_pdf';
    if (type.includes('word') || type.includes('document')) return 'description';
    if (type.includes('excel') || type.includes('sheet')) return 'table_chart';
    if (type === 'text/plain') return 'text_snippet';
    return 'attach_file';
}

// ─── AttachmentPicker ─────────────────────────────────────────────────────────
// Usado nos formulários antes de submeter (ainda sem ticket_id).
// Retorna os arquivos selecionados para o pai fazer upload junto com o submit.

interface AttachmentPickerProps {
    files: PendingFile[];
    onChange: (files: PendingFile[]) => void;
    compact?: boolean;  // versão menor para o widget do chatbot
}

export function AttachmentPicker({ files, onChange, compact = false }: AttachmentPickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const addFiles = (incoming: FileList | File[]) => {
        const arr = Array.from(incoming);
        const valid = arr.filter(f => {
            if (f.size > MAX_SIZE_MB * 1024 * 1024) return false;
            return true;
        });
        const next: PendingFile[] = valid.map(f => ({
            file: f,
            previewUrl: IMAGE_TYPES.includes(f.type) ? URL.createObjectURL(f) : null,
        }));
        const merged = [...files, ...next].slice(0, MAX_FILES);
        onChange(merged);
    };

    const remove = (idx: number) => {
        const f = files[idx];
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        onChange(files.filter((_, i) => i !== idx));
    };

    if (compact) {
        return (
            <div className="flex items-center gap-2 flex-wrap">
                <input ref={inputRef} type="file" multiple accept="image/*,.pdf" className="hidden"
                    onChange={e => e.target.files && addFiles(e.target.files)} />
                <button type="button" onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors text-xs font-semibold"
                    title="Anexar arquivo">
                    <span className="material-symbols-outlined text-base">attach_file</span>
                    {files.length === 0 ? 'Anexar' : `${files.length} anexo(s)`}
                </button>
                {files.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 max-w-[120px]">
                        <span className="material-symbols-outlined text-[12px]">{fileIcon(f.file.type)}</span>
                        <span className="truncate">{f.file.name}</span>
                        <button type="button" onClick={() => remove(i)} className="text-slate-400 hover:text-red-500 ml-0.5 shrink-0">
                            <span className="material-symbols-outlined text-[12px]">close</span>
                        </button>
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all flex items-center gap-3 ${
                    dragOver
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
            >
                <input ref={inputRef} type="file" multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                    onChange={e => e.target.files && addFiles(e.target.files)} />
                <span className="material-symbols-outlined text-slate-400 text-2xl shrink-0">upload_file</span>
                <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Arraste arquivos aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                        Imagens, PDF, Word, Excel · Máx. {MAX_SIZE_MB} MB por arquivo · até {MAX_FILES} arquivos
                    </p>
                </div>
            </div>

            {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 group">
                            {f.previewUrl ? (
                                <img src={f.previewUrl} alt="" className="size-8 rounded-lg object-cover shrink-0" />
                            ) : (
                                <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-500 text-base">{fileIcon(f.file.type)}</span>
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">{f.file.name}</p>
                                <p className="text-[10px] text-slate-400">{humanSize(f.file.size)}</p>
                            </div>
                            <button type="button" onClick={() => remove(i)}
                                className="text-slate-300 hover:text-red-500 transition-colors ml-1 shrink-0">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── AttachmentList ───────────────────────────────────────────────────────────
// Exibe anexos já salvos (com signed URL para download/preview).

interface AttachmentListProps {
    attachments: UploadedAttachment[];
    compact?: boolean;
}

export function AttachmentList({ attachments, compact = false }: AttachmentListProps) {
    if (attachments.length === 0) return null;

    if (compact) {
        return (
            <div className="flex flex-wrap gap-1.5 mt-1">
                {attachments.map(a => (
                    <a key={a.id} href={a.signedUrl ?? a.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors max-w-[150px]">
                        <span className="material-symbols-outlined text-[12px]">{fileIcon(a.file_type)}</span>
                        <span className="truncate">{a.file_name}</span>
                    </a>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map(a => {
                const isImage = IMAGE_TYPES.includes(a.file_type ?? '');
                return (
                    <a key={a.id} href={a.signedUrl ?? a.file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary/50 rounded-xl px-3 py-2 transition-all group">
                        {isImage && a.signedUrl ? (
                            <img src={a.signedUrl} alt={a.file_name} className="size-8 rounded-lg object-cover shrink-0" />
                        ) : (
                            <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-slate-500 text-base">{fileIcon(a.file_type)}</span>
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors truncate max-w-[160px]">
                                {a.file_name}
                            </p>
                            <p className="text-[10px] text-slate-400">{humanSize(a.file_size)}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300 group-hover:text-primary text-base transition-colors ml-1">open_in_new</span>
                    </a>
                );
            })}
        </div>
    );
}

// ─── uploadAttachments ────────────────────────────────────────────────────────
// Utilitário: faz upload dos PendingFiles e insere registros em ticket_attachments.
// Retorna os IDs inseridos (ou [] se falhar silenciosamente).

export async function uploadAttachments(
    files: PendingFile[],
    ticketId: string,
    messageId: string | null,
    userId: string,
): Promise<string[]> {
    if (files.length === 0) return [];

    const inserted: string[] = [];

    for (const pending of files) {
        try {
            const ext = pending.file.name.split('.').pop() ?? 'bin';
            const path = `${userId}/${ticketId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

            const { error: storageErr } = await supabase.storage
                .from('ticket-attachments')
                .upload(path, pending.file, { upsert: false });

            if (storageErr) {
                console.error('[uploadAttachments] storage error:', storageErr.message);
                continue;
            }

            const { data: att, error: dbErr } = await supabase
                .from('ticket_attachments')
                .insert({
                    ticket_id:   ticketId,
                    message_id:  messageId,
                    uploaded_by: userId,
                    file_name:   pending.file.name,
                    file_url:    path,
                    file_type:   pending.file.type || null,
                    file_size:   pending.file.size,
                })
                .select('id')
                .single();

            if (dbErr) {
                console.error('[uploadAttachments] db error:', dbErr.message);
                continue;
            }

            inserted.push(att.id);
        } catch (e) {
            console.error('[uploadAttachments] unexpected:', e);
        }
    }

    return inserted;
}

// ─── fetchAttachmentsWithSignedUrls ───────────────────────────────────────────
// Busca anexos de um ticket (ou mensagem) e gera signed URLs para exibição.

export async function fetchAttachmentsWithSignedUrls(
    ticketId: string,
    messageId?: string,
): Promise<UploadedAttachment[]> {
    let query = supabase
        .from('ticket_attachments')
        .select('id, file_name, file_url, file_type, file_size')
        .eq('ticket_id', ticketId)
        .order('created_at');

    if (messageId) {
        query = query.eq('message_id', messageId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const result: UploadedAttachment[] = [];
    for (const row of data) {
        let signedUrl: string | undefined;
        const { data: signed } = await supabase.storage
            .from('ticket-attachments')
            .createSignedUrl(row.file_url, 3600);
        signedUrl = signed?.signedUrl ?? undefined;
        result.push({ ...row, signedUrl });
    }
    return result;
}
