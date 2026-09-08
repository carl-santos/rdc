-- Support Ticket Intelligence Layer
-- Adds subcategory, tags, resolution routing and confidence score
-- Preserves all existing columns and RLS policies

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolution_type TEXT DEFAULT 'human' CHECK (resolution_type IN ('auto', 'ai', 'human')),
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100);

COMMENT ON COLUMN public.support_tickets.subcategory     IS 'Second-level classification within the category';
COMMENT ON COLUMN public.support_tickets.tags            IS 'Auto-generated keyword tags for semantic search and routing';
COMMENT ON COLUMN public.support_tickets.resolution_type IS 'Routing decision: auto = FAQ match, ai = AI agent, human = manual support';
COMMENT ON COLUMN public.support_tickets.confidence_score IS 'Classifier confidence 0-100 for the assigned priority/routing';
