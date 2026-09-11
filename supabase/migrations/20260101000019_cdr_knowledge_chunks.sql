-- Trechos indexados da base do RDC para recuperar só o que é relevante à pergunta.
-- Sem embeddings: full-text em português, no mesmo padrão da FAQ.

CREATE TABLE IF NOT EXISTS public.cdr_document_chunks (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_id        UUID NOT NULL REFERENCES public.cdr_documents(id) ON DELETE CASCADE,
    representative_id  UUID NOT NULL REFERENCES public.digital_representatives(id) ON DELETE CASCADE,
    chunk_index        INTEGER NOT NULL,
    content            TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
    search_vector      tsvector,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS cdr_document_chunks_rep_idx
    ON public.cdr_document_chunks (representative_id, document_id, chunk_index);

CREATE INDEX IF NOT EXISTS cdr_document_chunks_search_idx
    ON public.cdr_document_chunks USING GIN (search_vector);

ALTER TABLE public.cdr_document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY cdr_chunks_select ON public.cdr_document_chunks
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());

CREATE POLICY cdr_chunks_select_admin ON public.cdr_document_chunks
    FOR SELECT TO authenticated
    USING (public.is_platform_admin());

REVOKE ALL ON public.cdr_document_chunks FROM PUBLIC, anon;
GRANT SELECT ON public.cdr_document_chunks TO authenticated;

-- Parte texto em blocos de ~1200 caracteres, preferindo parágrafos.
CREATE OR REPLACE FUNCTION public.rebuild_cdr_document_chunks(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_doc     public.cdr_documents%ROWTYPE;
    v_parts   TEXT[];
    v_part    TEXT;
    v_buf     TEXT := '';
    v_idx     INTEGER := 0;
    v_target  CONSTANT INTEGER := 1200;
    v_piece   TEXT;
BEGIN
    DELETE FROM public.cdr_document_chunks WHERE document_id = p_document_id;

    SELECT * INTO v_doc FROM public.cdr_documents WHERE id = p_document_id;
    IF NOT FOUND THEN RETURN; END IF;
    IF v_doc.status IS DISTINCT FROM 'ready' THEN RETURN; END IF;
    IF v_doc.extracted_text IS NULL OR btrim(v_doc.extracted_text) = '' THEN RETURN; END IF;

    v_parts := regexp_split_to_array(v_doc.extracted_text, E'\\n[[:space:]]*\\n');
    IF v_parts IS NULL OR array_length(v_parts, 1) IS NULL THEN
        v_parts := ARRAY[v_doc.extracted_text];
    END IF;

    FOREACH v_part IN ARRAY v_parts LOOP
        v_part := btrim(v_part);
        IF v_part = '' THEN CONTINUE; END IF;

        IF char_length(v_buf) > 0 AND char_length(v_buf) + 2 + char_length(v_part) > v_target THEN
            v_idx := v_idx + 1;
            INSERT INTO public.cdr_document_chunks
                (tenant_id, document_id, representative_id, chunk_index, content, search_vector)
            VALUES (
                v_doc.tenant_id, v_doc.id, v_doc.representative_id, v_idx, left(v_buf, 4000),
                to_tsvector('portuguese', left(v_buf, 4000))
            );
            v_buf := '';
        END IF;

        IF char_length(v_part) > v_target THEN
            IF v_buf <> '' THEN
                v_idx := v_idx + 1;
                INSERT INTO public.cdr_document_chunks
                    (tenant_id, document_id, representative_id, chunk_index, content, search_vector)
                VALUES (
                    v_doc.tenant_id, v_doc.id, v_doc.representative_id, v_idx, left(v_buf, 4000),
                    to_tsvector('portuguese', left(v_buf, 4000))
                );
                v_buf := '';
            END IF;
            WHILE char_length(v_part) > 0 LOOP
                v_piece := left(v_part, v_target);
                v_idx := v_idx + 1;
                INSERT INTO public.cdr_document_chunks
                    (tenant_id, document_id, representative_id, chunk_index, content, search_vector)
                VALUES (
                    v_doc.tenant_id, v_doc.id, v_doc.representative_id, v_idx, v_piece,
                    to_tsvector('portuguese', v_piece)
                );
                v_part := substr(v_part, v_target + 1);
            END LOOP;
        ELSIF v_buf = '' THEN
            v_buf := v_part;
        ELSE
            v_buf := v_buf || E'\n\n' || v_part;
        END IF;
    END LOOP;

    IF btrim(v_buf) <> '' THEN
        v_idx := v_idx + 1;
        INSERT INTO public.cdr_document_chunks
            (tenant_id, document_id, representative_id, chunk_index, content, search_vector)
        VALUES (
            v_doc.tenant_id, v_doc.id, v_doc.representative_id, v_idx, left(v_buf, 4000),
            to_tsvector('portuguese', left(v_buf, 4000))
        );
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_cdr_document_chunks(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_rebuild_cdr_chunks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.rebuild_cdr_document_chunks(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cdr_documents_chunks ON public.cdr_documents;
CREATE TRIGGER trg_cdr_documents_chunks
    AFTER INSERT OR UPDATE OF extracted_text, status
    ON public.cdr_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_rebuild_cdr_chunks();

REVOKE EXECUTE ON FUNCTION public.trg_rebuild_cdr_chunks() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_cdr_knowledge(
    p_representative_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
    file_name TEXT,
    content TEXT,
    match_rank REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_q     tsquery;
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
    v_hits  INTEGER := 0;
BEGIN
    IF p_query IS NOT NULL AND btrim(p_query) <> '' THEN
        BEGIN
            v_q := websearch_to_tsquery('portuguese', p_query);
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                v_q := plainto_tsquery('portuguese', p_query);
            EXCEPTION WHEN OTHERS THEN
                v_q := NULL;
            END;
        END;
    END IF;

    IF v_q IS NOT NULL AND length(v_q::text) > 0 THEN
        RETURN QUERY
        SELECT d.file_name, c.content, ts_rank_cd(c.search_vector, v_q)::REAL AS match_rank
        FROM public.cdr_document_chunks c
        JOIN public.cdr_documents d ON d.id = c.document_id
        WHERE c.representative_id = p_representative_id
          AND (c.tenant_id = public.get_my_tenant_id() OR public.is_platform_admin())
          AND c.search_vector @@ v_q
        ORDER BY match_rank DESC, c.chunk_index
        LIMIT v_limit;
        GET DIAGNOSTICS v_hits = ROW_COUNT;
    END IF;

    IF v_hits > 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT d.file_name, c.content, 0::REAL
    FROM public.cdr_document_chunks c
    JOIN public.cdr_documents d ON d.id = c.document_id
    WHERE c.representative_id = p_representative_id
      AND (c.tenant_id = public.get_my_tenant_id() OR public.is_platform_admin())
    ORDER BY d.created_at DESC, c.chunk_index
    LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_cdr_knowledge(UUID, TEXT, INTEGER) TO authenticated;

SELECT public.rebuild_cdr_document_chunks(id)
FROM public.cdr_documents
WHERE status = 'ready' AND extracted_text IS NOT NULL;
