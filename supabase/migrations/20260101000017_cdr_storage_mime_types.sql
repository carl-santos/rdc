-- Windows/Chrome often send .md/.docx as application/octet-stream or text/x-markdown,
-- which the original cdr-documents allowlist rejected with HTTP 400.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/csv',
    'text/x-csv',
    'application/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream'
]
WHERE id = 'cdr-documents';
