-- ============================================================================
-- DOMINIO DO REPRESENTANTE DIGITAL COGNITIVO (RDC)
--
-- Um representante por tenant pode ter documentos, conversas e mensagens.
-- Isolamento por tenant via RLS, no mesmo padrao da baseline.
-- ============================================================================

-- Auditoria: eventos do produto (CDR) e a categoria ja usada pela Edge Function.
ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_category_check;

ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_category_check
    CHECK (category IN ('auth', 'data_access', 'system', 'billing', 'error', 'operation', 'cdr'));

CREATE TABLE IF NOT EXISTS public.digital_representatives (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome         TEXT NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 120),
    descricao    TEXT CHECK (char_length(descricao) <= 2000),
    persona      TEXT CHECK (char_length(persona) <= 4000),
    instrucoes   TEXT CHECK (char_length(instrucoes) <= 8000),
    autonomia    TEXT NOT NULL DEFAULT 'assisted'
                 CHECK (autonomia IN ('supervised', 'assisted', 'autonomous')),
    idioma       TEXT NOT NULL DEFAULT 'pt-BR',
    ativo        BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_representatives_tenant_idx
    ON public.digital_representatives (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cdr_documents (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    representative_id  UUID NOT NULL REFERENCES public.digital_representatives(id) ON DELETE CASCADE,
    uploaded_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    file_name          TEXT NOT NULL,
    storage_path       TEXT NOT NULL,
    mime_type          TEXT,
    file_size          INTEGER,
    status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'ready', 'failed')),
    extracted_text     TEXT,
    error_message      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cdr_documents_representative_idx
    ON public.cdr_documents (representative_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cdr_documents_tenant_idx
    ON public.cdr_documents (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cdr_conversations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    representative_id  UUID NOT NULL REFERENCES public.digital_representatives(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode               TEXT NOT NULL DEFAULT 'chat'
                       CHECK (mode IN ('chat', 'presentation', 'class', 'meeting')),
    title              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cdr_conversations_tenant_idx
    ON public.cdr_conversations (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS cdr_conversations_representative_idx
    ON public.cdr_conversations (representative_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS cdr_conversations_user_idx
    ON public.cdr_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.cdr_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES public.cdr_conversations(id) ON DELETE CASCADE,
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content          TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 16000),
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cdr_messages_conversation_idx
    ON public.cdr_messages (conversation_id, created_at);

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_digital_representatives ON public.digital_representatives;
CREATE TRIGGER trg_touch_digital_representatives
    BEFORE UPDATE ON public.digital_representatives
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_cdr_conversations ON public.cdr_conversations;
CREATE TRIGGER trg_touch_cdr_conversations
    BEFORE UPDATE ON public.cdr_conversations
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Gating de assinatura nas escritas do produto.
DROP TRIGGER IF EXISTS trg_check_tenant_active_cdr ON public.digital_representatives;
CREATE TRIGGER trg_check_tenant_active_cdr
    BEFORE INSERT ON public.digital_representatives
    FOR EACH ROW EXECUTE FUNCTION public.check_tenant_active();

DROP TRIGGER IF EXISTS trg_check_tenant_active_cdr_docs ON public.cdr_documents;
CREATE TRIGGER trg_check_tenant_active_cdr_docs
    BEFORE INSERT ON public.cdr_documents
    FOR EACH ROW EXECUTE FUNCTION public.check_tenant_active();

DROP TRIGGER IF EXISTS trg_check_tenant_active_cdr_conv ON public.cdr_conversations;
CREATE TRIGGER trg_check_tenant_active_cdr_conv
    BEFORE INSERT ON public.cdr_conversations
    FOR EACH ROW EXECUTE FUNCTION public.check_tenant_active();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.digital_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdr_documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdr_conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdr_messages            ENABLE ROW LEVEL SECURITY;

CREATE POLICY cdr_manage ON public.digital_representatives
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional())
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());

CREATE POLICY cdr_platform_admin ON public.digital_representatives
    FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

CREATE POLICY cdr_docs_manage ON public.cdr_documents
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional())
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());

CREATE POLICY cdr_docs_platform_admin ON public.cdr_documents
    FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

CREATE POLICY cdr_conv_manage ON public.cdr_conversations
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional())
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());

CREATE POLICY cdr_conv_platform_admin ON public.cdr_conversations
    FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

CREATE POLICY cdr_msg_manage ON public.cdr_messages
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional())
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());

CREATE POLICY cdr_msg_platform_admin ON public.cdr_messages
    FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- STORAGE
-- Caminho: {tenant_id}/{representative_id}/{uuid}-{filename}
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cdr-documents',
    'cdr-documents',
    false,
    10485760,
    ARRAY[
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.ms-powerpoint'
    ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY cdr_documents_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'cdr-documents'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    );

CREATE POLICY cdr_documents_write ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'cdr-documents'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
        AND public.is_tenant_professional()
    );

CREATE POLICY cdr_documents_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'cdr-documents'
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
        AND public.is_tenant_professional()
    );
