-- Chatbot flows: estrutura em árvore para atendimento automatizado
-- Cada nó tem uma mensagem do bot + opções clicáveis que levam a outros nós.
-- Um nó com escalate_to_human = true encerra o bot e entra na fila de suporte.
-- Um nó com is_terminal = true encerra o fluxo com sucesso (resolvido).

CREATE TABLE IF NOT EXISTS public.chatbot_flows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação do fluxo
    name            TEXT NOT NULL,          -- nome interno (ex: "Login - Senha Esquecida")
    category        TEXT NOT NULL,          -- espelha support_tickets.category
    subcategory     TEXT,                   -- espelha support_tickets.subcategory (NULL = qualquer)
    tags            TEXT[] DEFAULT '{}',    -- tags auxiliares para match

    -- Estrutura em árvore
    parent_id       UUID REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
    -- NULL = nó raiz do fluxo

    -- Conteúdo do nó
    bot_message     TEXT NOT NULL,          -- mensagem exibida pelo bot neste nó
    option_label    TEXT,                   -- label do botão que leva ATÉ este nó (NULL no raiz)

    -- Comportamento do nó
    is_root         BOOLEAN NOT NULL DEFAULT false,   -- TRUE apenas no nó raiz de cada fluxo
    is_terminal     BOOLEAN NOT NULL DEFAULT false,   -- TRUE = encerra com sucesso
    escalate_to_human BOOLEAN NOT NULL DEFAULT false, -- TRUE = escala para suporte humano
    is_published    BOOLEAN NOT NULL DEFAULT false,

    -- Metadados
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Garante no máximo um nó raiz publicado por (category, subcategory)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_flows_one_root
    ON public.chatbot_flows (category, COALESCE(subcategory, ''))
    WHERE is_root = true AND is_published = true;

-- Índice para busca de filhos de um nó
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_parent
    ON public.chatbot_flows (parent_id);

-- Índice para busca por categoria/subcategoria
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_category
    ON public.chatbot_flows (category, subcategory)
    WHERE is_published = true;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.chatbot_flows_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_chatbot_flows_updated_at ON public.chatbot_flows;
CREATE TRIGGER trg_chatbot_flows_updated_at
    BEFORE UPDATE ON public.chatbot_flows
    FOR EACH ROW EXECUTE FUNCTION public.chatbot_flows_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados leem apenas fluxos publicados
DO $$ BEGIN
    CREATE POLICY "chatbot_flows_select_published"
        ON public.chatbot_flows FOR SELECT TO authenticated
        USING (is_published = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Platform admin lê tudo (inclusive rascunhos)
DO $$ BEGIN
    CREATE POLICY "chatbot_flows_select_admin"
        ON public.chatbot_flows FOR SELECT TO authenticated
        USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Platform admin: INSERT / UPDATE / DELETE
DO $$ BEGIN
    CREATE POLICY "chatbot_flows_insert_admin"
        ON public.chatbot_flows FOR INSERT TO authenticated
        WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "chatbot_flows_update_admin"
        ON public.chatbot_flows FOR UPDATE TO authenticated
        USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "chatbot_flows_delete_admin"
        ON public.chatbot_flows FOR DELETE TO authenticated
        USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RPC: busca nó raiz para um ticket ────────────────────────────────────────
-- Retorna o nó raiz publicado que melhor corresponde a (category, subcategory).
-- Prioridade: match exato de subcategoria > match só de categoria.
CREATE OR REPLACE FUNCTION public.get_chatbot_root(
    p_category    TEXT,
    p_subcategory TEXT DEFAULT NULL
)
RETURNS SETOF public.chatbot_flows
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Tenta match exato (category + subcategory)
    RETURN QUERY
        SELECT * FROM public.chatbot_flows
        WHERE is_root = true
          AND is_published = true
          AND category = p_category
          AND subcategory = p_subcategory
        LIMIT 1;

    IF FOUND THEN RETURN; END IF;

    -- Fallback: só category, subcategory NULL
    RETURN QUERY
        SELECT * FROM public.chatbot_flows
        WHERE is_root = true
          AND is_published = true
          AND category = p_category
          AND subcategory IS NULL
        LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chatbot_root TO authenticated;

-- RPC: busca filhos diretos de um nó
CREATE OR REPLACE FUNCTION public.get_chatbot_children(p_parent_id UUID)
RETURNS SETOF public.chatbot_flows
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
        SELECT * FROM public.chatbot_flows
        WHERE parent_id = p_parent_id
          AND is_published = true
        ORDER BY created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chatbot_children TO authenticated;
