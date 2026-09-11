/** Limite de 10 MB, alinhado ao bucket de anexos de chamado. */
export const CDR_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const CDR_ALLOWED_EXTENSIONS = [
    '.txt',
    '.md',
    '.csv',
    '.pdf',
    '.docx',
    '.pptx',
    '.ppt',
    '.doc',
] as const;

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json'];
const MAX_EXTRACT_CHARS = 200_000;

const MIME_BY_EXTENSION: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/plain',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.doc': 'application/msword',
    '.ppt': 'application/vnd.ms-powerpoint',
};

export function fileExtension(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function isAllowedCdrDocument(file: File): boolean {
    return (CDR_ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension(file.name));
}

/** MIME the Storage bucket accepts. Browsers often leave File.type empty for .md/.docx. */
export function contentTypeForCdrDocument(file: File): string {
    return MIME_BY_EXTENSION[fileExtension(file.name)] || file.type || 'application/octet-stream';
}

export function isExtractableTextFile(file: File): boolean {
    const ext = fileExtension(file.name);
    return TEXT_EXTENSIONS.includes(ext) || file.type.startsWith('text/');
}

const SERVER_EXTRACT_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.doc', '.ppt'];

export function needsServerExtraction(fileName: string): boolean {
    return SERVER_EXTRACT_EXTENSIONS.includes(fileExtension(fileName));
}

export async function extractDocumentText(file: File): Promise<string | null> {
    if (!isExtractableTextFile(file)) return null;
    const text = await file.text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, MAX_EXTRACT_CHARS);
}

export function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
