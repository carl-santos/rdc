-- FAQ full-text search (Estratégia C) + RPC de busca em 3 camadas
-- Estratégia A: exact match category + subcategory
-- Estratégia B: tag overlap (&&)
-- Estratégia C: Portuguese full-text search via tsvector
-- Executa A → B → C em cascata, desduplicando por id.

-- 1. Coluna search_vector (simples, sem GENERATED — preenchida via trigger)
--    array_to_string não é IMMUTABLE no Postgres, então não pode ser usada
--    em colunas GENERATED ALWAYS AS (...) STORED.
ALTER TABLE public.faq_articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 2. Função que (re)calcula o search_vector — IMMUTABLE não se aplica aqui
--    pois ela lê NEW.* via trigger (VOLATILE por default, ok).
CREATE OR REPLACE FUNCTION public.faq_articles_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(NEW.title,   '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

-- 3. Trigger: recalcula antes de cada INSERT ou UPDATE
DROP TRIGGER IF EXISTS trg_faq_articles_search_vector ON public.faq_articles;
CREATE TRIGGER trg_faq_articles_search_vector
  BEFORE INSERT OR UPDATE ON public.faq_articles
  FOR EACH ROW EXECUTE FUNCTION public.faq_articles_search_vector_update();

-- 4. Backfill dos artigos já existentes (se houver)
UPDATE public.faq_articles SET updated_at = updated_at WHERE search_vector IS NULL;

-- 5. Índice GIN para full-text lookup eficiente
CREATE INDEX IF NOT EXISTS idx_faq_articles_search_vector
  ON public.faq_articles USING GIN (search_vector)
  WHERE is_published = true;

-- 6. RPC: busca em 3 camadas retornando até `max_results` artigos
--    Parâmetros:
--      p_category    – categoria do ticket (ex: 'support')
--      p_subcategory – subcategoria do ticket (ex: 'login'), pode ser NULL
--      p_tags        – array de tags do ticket (ex: '{login,senha}'), pode ser NULL/vazio
--      p_query       – texto livre do assunto/descrição, pode ser NULL/vazio
--      p_max_results – total máximo a retornar (default 5)
CREATE OR REPLACE FUNCTION public.search_faq_articles(
  p_category    TEXT,
  p_subcategory TEXT    DEFAULT NULL,
  p_tags        TEXT[]  DEFAULT '{}',
  p_query       TEXT    DEFAULT NULL,
  p_max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  id               UUID,
  title            TEXT,
  content          TEXT,
  category         TEXT,
  subcategory      TEXT,
  tags             TEXT[],
  helpful_yes      INTEGER,
  helpful_no       INTEGER,
  match_strategy   TEXT,   -- 'exact' | 'tags' | 'fulltext'
  rank             REAL
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_query_tsquery tsquery;
BEGIN
  -- Normaliza query para tsquery (ignora se vazio ou inválido)
  IF p_query IS NOT NULL AND trim(p_query) <> '' THEN
    BEGIN
      v_query_tsquery := plainto_tsquery('portuguese', p_query);
    EXCEPTION WHEN OTHERS THEN
      v_query_tsquery := NULL;
    END;
  END IF;

  RETURN QUERY
  WITH

  -- ── Estratégia A: correspondência exata de categoria + subcategoria ─────
  exact AS (
    SELECT
      a.id, a.title, a.content, a.category, a.subcategory, a.tags,
      a.helpful_yes, a.helpful_no,
      'exact'::TEXT AS match_strategy,
      1.0::REAL     AS rank
    FROM public.faq_articles a
    WHERE a.is_published = true
      AND a.category = p_category
      AND (p_subcategory IS NULL OR a.subcategory = p_subcategory)
  ),

  -- ── Estratégia B: overlap de tags ────────────────────────────────────────
  tag_match AS (
    SELECT
      a.id, a.title, a.content, a.category, a.subcategory, a.tags,
      a.helpful_yes, a.helpful_no,
      'tags'::TEXT AS match_strategy,
      -- rank = proporção de tags que batem
      (array_length(a.tags & p_tags, 1)::REAL /
       GREATEST(array_length(p_tags, 1), 1)::REAL) AS rank
    FROM public.faq_articles a
    WHERE a.is_published = true
      AND array_length(p_tags, 1) > 0
      AND a.tags && p_tags          -- overlap operator
      AND a.id NOT IN (SELECT id FROM exact)
  ),

  -- ── Estratégia C: full-text search ───────────────────────────────────────
  fulltext AS (
    SELECT
      a.id, a.title, a.content, a.category, a.subcategory, a.tags,
      a.helpful_yes, a.helpful_no,
      'fulltext'::TEXT AS match_strategy,
      ts_rank_cd(a.search_vector, v_query_tsquery)::REAL AS rank
    FROM public.faq_articles a
    WHERE a.is_published = true
      AND v_query_tsquery IS NOT NULL
      AND a.search_vector @@ v_query_tsquery
      AND a.id NOT IN (SELECT id FROM exact)
      AND a.id NOT IN (SELECT id FROM tag_match)
  ),

  -- ── União das três estratégias ────────────────────────────────────────────
  combined AS (
    SELECT * FROM exact
    UNION ALL
    SELECT * FROM tag_match  WHERE rank > 0
    UNION ALL
    SELECT * FROM fulltext   WHERE rank > 0
  )

  SELECT *
  FROM combined
  ORDER BY
    CASE match_strategy
      WHEN 'exact'    THEN 0
      WHEN 'tags'     THEN 1
      WHEN 'fulltext' THEN 2
    END,
    rank DESC
  LIMIT p_max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_faq_articles TO authenticated;

-- 7. RPC: registrar feedback de utilidade (helpful_yes / helpful_no)
CREATE OR REPLACE FUNCTION public.vote_faq_article(
  p_article_id UUID,
  p_helpful    BOOLEAN   -- true = sim, false = não
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_helpful THEN
    UPDATE public.faq_articles SET helpful_yes = helpful_yes + 1 WHERE id = p_article_id;
  ELSE
    UPDATE public.faq_articles SET helpful_no  = helpful_no  + 1 WHERE id = p_article_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_faq_article TO authenticated;

-- 8. RPC: detectar incidente sistêmico
--    Retorna TRUE se >= p_threshold tickets com mesma category+subcategory
--    foram abertos nos últimos p_window_minutes minutos.
CREATE OR REPLACE FUNCTION public.detect_support_incident(
  p_category         TEXT,
  p_subcategory      TEXT,
  p_threshold        INTEGER DEFAULT 3,
  p_window_minutes   INTEGER DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.support_tickets
  WHERE category   = p_category
    AND subcategory = p_subcategory
    AND created_at >= now() - (p_window_minutes || ' minutes')::INTERVAL;

  RETURN v_count >= p_threshold;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_support_incident TO authenticated;
