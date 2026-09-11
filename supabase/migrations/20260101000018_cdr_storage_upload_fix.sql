-- Storage 400: o allowlist rejeitava o MIME detectado (ex.: .md como text/plain
-- enquanto o cliente mandava text/markdown). A validacao de extensao fica no app.
-- platform_admin precisa escrever no bucket; is_tenant_professional() nao o inclui.

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'cdr-documents';

DROP POLICY IF EXISTS cdr_documents_write ON storage.objects;
CREATE POLICY cdr_documents_write ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'cdr-documents'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
        AND (public.is_tenant_professional() OR public.is_platform_admin())
    );

DROP POLICY IF EXISTS cdr_documents_delete ON storage.objects;
CREATE POLICY cdr_documents_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'cdr-documents'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
        AND (public.is_tenant_professional() OR public.is_platform_admin())
    );

DROP POLICY IF EXISTS cdr_documents_read ON storage.objects;
CREATE POLICY cdr_documents_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'cdr-documents'
        AND (
            (storage.foldername(name))[1] = public.get_my_tenant_id()::text
            OR public.is_platform_admin()
        )
    );
