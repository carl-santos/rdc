-- Banco de sugestões: enriquece tickets com category='feedback'
-- Não duplica dados — referencia support_tickets e adiciona gestão + analytics.

CREATE TABLE IF NOT EXISTS public.suggestion_meta (
    ticket_id     UUID PRIMARY KEY REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'unread'
                    CHECK (status IN ('unread','reviewing','planned','implemented','rejected')),
    admin_notes   TEXT,
    reviewed_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_meta_status
    ON public.suggestion_meta (status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.suggestion_meta_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_suggestion_meta_updated_at ON public.suggestion_meta;
CREATE TRIGGER trg_suggestion_meta_updated_at
    BEFORE UPDATE ON public.suggestion_meta
    FOR EACH ROW EXECUTE FUNCTION public.suggestion_meta_set_updated_at();

-- Trigger: insere suggestion_meta automaticamente quando um ticket feedback é criado
CREATE OR REPLACE FUNCTION public.auto_create_suggestion_meta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.category = 'feedback' THEN
        INSERT INTO public.suggestion_meta (ticket_id)
        VALUES (NEW.id)
        ON CONFLICT (ticket_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_suggestion_meta ON public.support_tickets;
CREATE TRIGGER trg_auto_suggestion_meta
    AFTER INSERT ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.auto_create_suggestion_meta();

-- Backfill: tickets feedback já existentes
INSERT INTO public.suggestion_meta (ticket_id)
SELECT id FROM public.support_tickets
WHERE category = 'feedback'
ON CONFLICT (ticket_id) DO NOTHING;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.suggestion_meta ENABLE ROW LEVEL SECURITY;

-- Platform admin: leitura e escrita total
DO $$ BEGIN
    CREATE POLICY "suggestion_meta_all_admin"
        ON public.suggestion_meta FOR ALL TO authenticated
        USING (public.is_platform_admin())
        WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RPC: analytics de sugestões ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_suggestion_analytics(
    p_days INTEGER DEFAULT 90
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_since TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
    v_result JSON;
BEGIN
    SELECT json_build_object(

        -- 1. Totais por status
        'by_status', (
            SELECT json_agg(row_to_json(r)) FROM (
                SELECT sm.status, COUNT(*) AS total
                FROM public.suggestion_meta sm
                JOIN public.support_tickets st ON st.id = sm.ticket_id
                GROUP BY sm.status
                ORDER BY total DESC
            ) r
        ),

        -- 2. Volume diário nos últimos p_days dias
        'daily_volume', (
            SELECT json_agg(row_to_json(r)) FROM (
                SELECT
                    DATE(st.created_at) AS day,
                    COUNT(*) AS total
                FROM public.support_tickets st
                WHERE st.category = 'feedback'
                  AND st.created_at >= v_since
                GROUP BY DATE(st.created_at)
                ORDER BY day
            ) r
        ),

        -- 3. Ranking de subcategorias
        'by_subcategory', (
            SELECT json_agg(row_to_json(r)) FROM (
                SELECT
                    COALESCE(st.subcategory, 'sem_subcategoria') AS subcategory,
                    COUNT(*) AS total
                FROM public.support_tickets st
                WHERE st.category = 'feedback'
                GROUP BY st.subcategory
                ORDER BY total DESC
            ) r
        ),

        -- 4. Top tenants por volume
        'by_tenant', (
            SELECT json_agg(row_to_json(r)) FROM (
                SELECT
                    COALESCE(t.name, 'Desconhecido') AS tenant_name,
                    COUNT(*) AS total
                FROM public.support_tickets st
                LEFT JOIN public.tenants t ON t.id = st.tenant_id
                WHERE st.category = 'feedback'
                GROUP BY t.name
                ORDER BY total DESC
                LIMIT 10
            ) r
        ),

        -- 5. Total geral
        'total', (
            SELECT COUNT(*) FROM public.support_tickets WHERE category = 'feedback'
        ),

        -- 6. Total no período
        'total_period', (
            SELECT COUNT(*) FROM public.support_tickets
            WHERE category = 'feedback' AND created_at >= v_since
        )

    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_suggestion_analytics TO authenticated;
