-- ============================================================================
-- CENTRAL DE SOLICITACOES LGPD
--
-- Cobre os quatro tipos de solicitacao: data_access, data_portability,
-- revoke_consent e data_delete.
--
-- O ticket em support_tickets continua sendo a conversa com o titular. As
-- colunas abaixo guardam o estado de execucao da solicitacao (quem processou,
-- quando resolveu, caminho do export) e o rastro de revogacao e anonimizacao
-- em profiles e clients.
-- ============================================================================

-- 1. Enriquecimento do ticket (colunas so preenchidas quando category='lgpd')
ALTER TABLE public.support_tickets
    ADD COLUMN IF NOT EXISTS lgpd_type             TEXT
        CHECK (lgpd_type IN ('data_access','data_portability','revoke_consent','data_delete')),
    ADD COLUMN IF NOT EXISTS lgpd_status           TEXT DEFAULT 'pending'
        CHECK (lgpd_status IN ('pending','in_progress','resolved','rejected')),
    ADD COLUMN IF NOT EXISTS lgpd_resolved_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lgpd_processed_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lgpd_resolution_notes TEXT,
    ADD COLUMN IF NOT EXISTS lgpd_export_path      TEXT;

CREATE INDEX IF NOT EXISTS support_tickets_lgpd_idx
    ON public.support_tickets (lgpd_status, lgpd_type, created_at DESC)
    WHERE category = 'lgpd';

-- 2. Profiles: revogacao de consentimento e anonimizacao
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS consents_revoked    JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS consents_revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS consents_revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS anonymized_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS anonymized_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.consents_revoked IS
'Flags de consentimento revogado. Chaves sugeridas: consent_ai, consent_third_party, consent_marketing (true = revogado). Consultado pelas Edge Functions para bloquear funcionalidades que dependem de consentimento.';

COMMENT ON COLUMN public.profiles.anonymized_at IS
'Timestamp da anonimizacao. Quando preenchido, nome e email viraram placeholders e o auth.user foi deletado. A linha permanece para preservar as FKs em billing_invoices e audit_logs.';

-- 3. Clients: anonimizacao e soft delete
--    O soft delete atende data_delete sem quebrar integridade referencial.
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS anonymized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clients_active_idx
    ON public.clients (tenant_id, created_at)
    WHERE deleted_at IS NULL;

-- 4. Bucket de exports (privado, acesso por URL assinada)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('lgpd-exports', 'lgpd-exports', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Cada titular le apenas os proprios exports; o admin da plataforma le todos.
DO $$ BEGIN
    CREATE POLICY lgpd_exports_owner_read
        ON storage.objects FOR SELECT TO authenticated
        USING (
            bucket_id = 'lgpd-exports'
            AND (
                public.is_platform_admin()
                OR (storage.foldername(name))[1] = auth.uid()::text
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY lgpd_exports_admin_write
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'lgpd-exports'
            AND public.is_platform_admin()
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
