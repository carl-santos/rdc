-- FAQ / Knowledge Base articles
-- Platform admins manage articles; all authenticated users can read them.
-- category and subcategory match the ids defined in ticketClassifier.ts.

CREATE TABLE IF NOT EXISTS public.faq_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  category      TEXT NOT NULL,
  subcategory   TEXT,
  tags          TEXT[] DEFAULT '{}',
  is_published  BOOLEAN NOT NULL DEFAULT false,
  helpful_yes   INTEGER NOT NULL DEFAULT 0,
  helpful_no    INTEGER NOT NULL DEFAULT 0,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION public.touch_faq_article()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_faq_article ON public.faq_articles;
CREATE TRIGGER trg_touch_faq_article
  BEFORE UPDATE ON public.faq_articles
  FOR EACH ROW EXECUTE FUNCTION public.touch_faq_article();

-- RLS
ALTER TABLE public.faq_articles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read published articles
CREATE POLICY "faq_articles_read_published"
  ON public.faq_articles FOR SELECT
  USING (is_published = true);

-- Platform admins can read all articles (including drafts)
CREATE POLICY "faq_articles_admin_read_all"
  ON public.faq_articles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Platform admins can insert
CREATE POLICY "faq_articles_admin_insert"
  ON public.faq_articles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Platform admins can update
CREATE POLICY "faq_articles_admin_update"
  ON public.faq_articles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Platform admins can delete
CREATE POLICY "faq_articles_admin_delete"
  ON public.faq_articles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_admin'
    )
  );

-- Index for category lookups (used by the smart FAQ suggestion)
CREATE INDEX IF NOT EXISTS idx_faq_articles_category ON public.faq_articles (category, subcategory) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_faq_articles_tags ON public.faq_articles USING GIN (tags) WHERE is_published = true;
