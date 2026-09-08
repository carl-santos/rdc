-- ============================================================================
-- BASELINE DA SAAS FOUNDATION
--
-- Schema central multi-tenant: planos, tenants, perfis, clientes finais,
-- cota de uso, suporte, auditoria, notificacoes e faturamento.
--
-- Este arquivo existe porque no projeto de origem as tabelas centrais foram
-- criadas pelo painel do Supabase e nunca entraram em migration. Aqui elas
-- passam a ser codigo versionado, com o hardening de RLS ja incorporado.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- platform_admin: opera a plataforma inteira
-- tenant_admin:   administra um assinante
-- collaborator:   membro da equipe do assinante
-- client:         cliente final, acessa apenas o portal
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('platform_admin', 'tenant_admin', 'collaborator', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 2. TABELAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plans (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                  TEXT NOT NULL,
    preco_mensal          NUMERIC(10,2) NOT NULL,
    limite_clientes       INTEGER NOT NULL,
    limite_operacoes_mes  INTEGER NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_fantasia         TEXT NOT NULL,
    razao_social          TEXT,
    cpf_cnpj              TEXT,
    segmento              TEXT,
    telefone              TEXT,
    whatsapp_atendimento  TEXT,
    logo_url              TEXT,
    cep                   TEXT,
    logradouro            TEXT,
    numero                TEXT,
    complemento           TEXT,
    cidade                TEXT,
    estado                TEXT,
    plano_id              UUID REFERENCES public.plans(id),
    status                public.tenant_status NOT NULL DEFAULT 'active',
    asaas_customer_id     TEXT,
    asaas_subscription_id TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nome                TEXT NOT NULL,
    email               TEXT,
    telefone            TEXT,
    foto_url            TEXT,
    -- usuario do portal, preenchido quando o cliente aceita o convite
    client_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    portal_activated_at TIMESTAMPTZ,
    consent_given_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clients_tenant_idx ON public.clients (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id  UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    client_id  UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    nome       TEXT NOT NULL,
    email      TEXT NOT NULL,
    cargo      TEXT,
    role       public.user_role NOT NULL DEFAULT 'collaborator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_tenant_idx ON public.profiles (tenant_id);

-- Cota mensal por tenant. Uma linha por mes de referencia.
CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                 UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    mes_referencia            DATE NOT NULL,
    clientes_cadastrados      INTEGER NOT NULL DEFAULT 0,
    operacoes_utilizadas      INTEGER NOT NULL DEFAULT 0,
    creditos_extra            INTEGER NOT NULL DEFAULT 0,
    creditos_extra_utilizados INTEGER NOT NULL DEFAULT 0,
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, mes_referencia)
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticket_number         TEXT NOT NULL UNIQUE,
    subject               TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
    description           TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
    category              TEXT NOT NULL,
    subcategory           TEXT,
    priority              TEXT NOT NULL DEFAULT 'medium',
    status                public.ticket_status NOT NULL DEFAULT 'open',
    tags                  TEXT[],
    confidence_score      NUMERIC(4,3),
    resolution_type       TEXT,
    blocks_sales          BOOLEAN DEFAULT false,
    read                  BOOLEAN DEFAULT false,
    unread_messages_count INTEGER DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_tenant_idx ON public.support_tickets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx   ON public.support_tickets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'support', 'system')),
    message     TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_messages_ticket_idx ON public.ticket_messages (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    message_id  UUID REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    file_name   TEXT NOT NULL,
    file_url    TEXT NOT NULL,
    file_type   TEXT,
    file_size   INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    role          TEXT,
    event_type    TEXT,
    action        TEXT NOT NULL,
    category      TEXT DEFAULT 'system' CHECK (category IN ('auth','data_access','system','billing','error')),
    resource_type TEXT NOT NULL,
    resource_id   TEXT,
    severity      TEXT DEFAULT 'info'    CHECK (severity IN ('info','warning','critical')),
    status        TEXT DEFAULT 'success' CHECK (status IN ('success','error')),
    ip_address    TEXT,
    user_agent    TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx   ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_category_created_idx ON public.audit_logs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_severity_idx         ON public.audit_logs (severity) WHERE severity IN ('warning','critical');
CREATE INDEX IF NOT EXISTS audit_logs_status_idx           ON public.audit_logs (status, created_at DESC) WHERE status = 'error';

CREATE TABLE IF NOT EXISTS public.notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,
    title        TEXT NOT NULL,
    message      TEXT NOT NULL,
    link         TEXT,
    read         BOOLEAN NOT NULL DEFAULT false,
    reference_id TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    asaas_payment_id      TEXT NOT NULL UNIQUE,
    asaas_subscription_id TEXT,
    status                TEXT NOT NULL DEFAULT 'PENDING',
    value                 NUMERIC(10,2) NOT NULL,
    due_date              DATE NOT NULL,
    payment_date          DATE,
    billing_type          TEXT,
    invoice_url           TEXT,
    bank_slip_url         TEXT,
    pix_qrcode_encoded    TEXT,
    description           TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_invoices_tenant_idx ON public.billing_invoices (tenant_id, due_date DESC);

-- ============================================================================
-- 3. HELPERS DE RLS
--
-- Todos SECURITY DEFINER com search_path fixo: evita recursao de policy
-- (a funcao le profiles sem reaplicar RLS) e search-path hijacking.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'platform_admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('tenant_admin', 'platform_admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_professional()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('tenant_admin', 'collaborator')
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Alias historico usado por policies das migrations seguintes.
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Id do registro de cliente do usuario logado (portal).
CREATE OR REPLACE FUNCTION public.get_my_client_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================================
-- 4. GATING DE ASSINATURA
--
-- Bloqueia escrita quando o tenant nao esta ativo. Aplicado por trigger para
-- valer tambem em chamadas que passam por RPC.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_tenant_active()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    _status TEXT;
BEGIN
    SELECT status INTO _status FROM public.tenants WHERE id = NEW.tenant_id;

    IF _status IS NOT NULL AND _status <> 'active' THEN
        RAISE EXCEPTION 'Operacao bloqueada: a assinatura do tenant esta %. Regularize o pagamento.', _status;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_tenant_active_clients ON public.clients;
CREATE TRIGGER trg_check_tenant_active_clients
    BEFORE INSERT ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.check_tenant_active();

-- ============================================================================
-- 5. COTA DE USO
--
-- increment_operation_usage consome primeiro a cota do plano e so depois os
-- creditos extras. O UPDATE condicional em uma unica instrucao evita que duas
-- requisicoes simultaneas estourem o limite.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_operation_usage(p_tenant_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_mes       DATE := date_trunc('month', current_date)::date;
    v_limite    INTEGER;
    v_restantes INTEGER;
BEGIN
    IF p_tenant_id IS NULL OR p_tenant_id <> public.get_my_tenant_id() THEN
        RAISE EXCEPTION 'Tenant invalido.';
    END IF;

    SELECT COALESCE(p.limite_operacoes_mes, 0) INTO v_limite
    FROM public.tenants t
    LEFT JOIN public.plans p ON p.id = t.plano_id
    WHERE t.id = p_tenant_id;

    INSERT INTO public.usage_tracking (tenant_id, mes_referencia)
    VALUES (p_tenant_id, v_mes)
    ON CONFLICT (tenant_id, mes_referencia) DO NOTHING;

    -- Consome cota do plano; se esgotada, consome credito extra.
    UPDATE public.usage_tracking
    SET operacoes_utilizadas = CASE
            WHEN operacoes_utilizadas < v_limite THEN operacoes_utilizadas + 1
            ELSE operacoes_utilizadas
        END,
        creditos_extra_utilizados = CASE
            WHEN operacoes_utilizadas >= v_limite THEN creditos_extra_utilizados + 1
            ELSE creditos_extra_utilizados
        END,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND mes_referencia = v_mes
      AND (operacoes_utilizadas < v_limite
           OR creditos_extra_utilizados < creditos_extra)
    RETURNING (v_limite - operacoes_utilizadas) + (creditos_extra - creditos_extra_utilizados)
    INTO v_restantes;

    IF v_restantes IS NULL THEN
        RAISE EXCEPTION 'Limite de operacoes do plano esgotado.';
    END IF;

    RETURN v_restantes;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_operation_credits(p_tenant_id UUID, p_credits INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_mes DATE := date_trunc('month', current_date)::date;
BEGIN
    IF p_credits IS NULL OR p_credits <= 0 THEN
        RAISE EXCEPTION 'Quantidade de creditos invalida.';
    END IF;

    INSERT INTO public.usage_tracking (tenant_id, mes_referencia, creditos_extra)
    VALUES (p_tenant_id, v_mes, p_credits)
    ON CONFLICT (tenant_id, mes_referencia)
    DO UPDATE SET creditos_extra = public.usage_tracking.creditos_extra + p_credits,
                  updated_at     = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_operation_remaining(p_tenant_id UUID)
RETURNS TABLE (
    limite              INTEGER,
    utilizadas          INTEGER,
    creditos_extra      INTEGER,
    creditos_utilizados INTEGER,
    restantes           INTEGER
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT
        COALESCE(p.limite_operacoes_mes, 0),
        COALESCE(u.operacoes_utilizadas, 0),
        COALESCE(u.creditos_extra, 0),
        COALESCE(u.creditos_extra_utilizados, 0),
        (COALESCE(p.limite_operacoes_mes, 0) - COALESCE(u.operacoes_utilizadas, 0))
      + (COALESCE(u.creditos_extra, 0)       - COALESCE(u.creditos_extra_utilizados, 0))
    FROM public.tenants t
    LEFT JOIN public.plans p ON p.id = t.plano_id
    LEFT JOIN public.usage_tracking u
           ON u.tenant_id = t.id
          AND u.mes_referencia = date_trunc('month', current_date)::date
    WHERE t.id = p_tenant_id
      AND t.id = public.get_my_tenant_id();
$$;

-- ============================================================================
-- 6. PROVISIONAMENTO DE USUARIO
--
-- Um unico trigger cobre os tres caminhos de entrada: perfil ja criado por
-- Edge Function, convite (equipe ou portal) e signup direto, que cria o tenant.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_tenant_id  UUID;
    org_name       TEXT;
    org_segment    TEXT;
    full_name      TEXT;
    profile_exists BOOLEAN;
    invited_role   TEXT;
    invited_tenant UUID;
    invited_client UUID;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) INTO profile_exists;

    -- Caso 1: perfil ja criado antes de o trigger disparar.
    IF profile_exists THEN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
            jsonb_build_object('tenant_id', (SELECT tenant_id FROM public.profiles WHERE id = NEW.id))
        WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    invited_role   := NEW.raw_user_meta_data->>'role';
    invited_tenant := NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid;
    invited_client := NULLIF(NEW.raw_user_meta_data->>'client_id', '')::uuid;

    -- Caso 2: convite. Nao cria tenant, apenas vincula ao existente.
    IF invited_role IS NOT NULL AND invited_tenant IS NOT NULL THEN
        INSERT INTO public.profiles (id, tenant_id, nome, email, role, cargo, client_id)
        VALUES (
            NEW.id,
            invited_tenant,
            COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', 'Usuario'),
            NEW.email,
            invited_role::public.user_role,
            NEW.raw_user_meta_data->>'cargo',
            invited_client
        );

        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
            jsonb_strip_nulls(jsonb_build_object(
                'role', invited_role,
                'tenant_id', invited_tenant,
                'client_id', invited_client
            ))
        WHERE id = NEW.id;

        RETURN NEW;
    END IF;

    -- Caso 3: signup direto. Cria tenant, perfil admin e a linha de cota do mes.
    org_name    := COALESCE(NEW.raw_user_meta_data->>'org_name', 'Minha Empresa');
    org_segment := COALESCE(NEW.raw_user_meta_data->>'segment', 'Geral');
    full_name   := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');

    INSERT INTO public.tenants (nome_fantasia, segmento, status)
    VALUES (org_name, org_segment, 'active')
    RETURNING id INTO new_tenant_id;

    INSERT INTO public.profiles (id, tenant_id, nome, email, role, cargo)
    VALUES (NEW.id, new_tenant_id, full_name, NEW.email, 'tenant_admin', org_segment);

    INSERT INTO public.usage_tracking (tenant_id, mes_referencia)
    VALUES (new_tenant_id, date_trunc('month', current_date)::date);

    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
        jsonb_build_object('tenant_id', new_tenant_id)
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Impede que o proprio usuario eleve seu papel ou troque de tenant.
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.is_platform_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Alteracao de papel nao permitida.';
    END IF;

    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND NOT public.is_tenant_admin() THEN
        RAISE EXCEPTION 'Alteracao de tenant nao permitida.';
    END IF;

    IF NEW.client_id IS DISTINCT FROM OLD.client_id AND NOT public.is_tenant_admin() THEN
        RAISE EXCEPTION 'Alteracao de vinculo de cliente nao permitida.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ============================================================================
-- 7. NOTIFICACOES AUTOMATICAS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.notifications (user_id, tenant_id, type, title, message, link, reference_id)
    SELECT p.id,
           NEW.tenant_id,
           'ticket_novo',
           'Novo chamado aberto',
           NEW.subject,
           '/admin/support',
           NEW.id::text
    FROM public.profiles p
    WHERE p.role = 'platform_admin';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_new_ticket ON public.support_tickets;
CREATE TRIGGER trg_notify_admins_on_new_ticket
    AFTER INSERT ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_ticket();

CREATE OR REPLACE FUNCTION public.notify_user_on_ticket_reply()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id   UUID;
    v_tenant_id UUID;
    v_subject   TEXT;
BEGIN
    IF NEW.sender_type <> 'support' THEN
        RETURN NEW;
    END IF;

    SELECT user_id, tenant_id, subject INTO v_user_id, v_tenant_id, v_subject
    FROM public.support_tickets WHERE id = NEW.ticket_id;

    INSERT INTO public.notifications (user_id, tenant_id, type, title, message, link, reference_id)
    VALUES (v_user_id, v_tenant_id, 'ticket_resposta', 'Resposta no seu chamado', v_subject,
            '/meus-chamados', NEW.ticket_id::text);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_on_ticket_reply ON public.ticket_messages;
CREATE TRIGGER trg_notify_user_on_ticket_reply
    AFTER INSERT ON public.ticket_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_user_on_ticket_reply();

-- ============================================================================
-- 8. RLS
-- ============================================================================

ALTER TABLE public.plans              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices   ENABLE ROW LEVEL SECURITY;

-- plans: catalogo legivel por usuario logado; escrita so platform_admin.
CREATE POLICY plans_read ON public.plans
    FOR SELECT TO authenticated USING (true);
CREATE POLICY plans_write ON public.plans
    FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- tenants: cada um enxerga o proprio; platform_admin enxerga todos.
CREATE POLICY tenants_read ON public.tenants
    FOR SELECT TO authenticated
    USING (id = public.get_my_tenant_id() OR public.is_platform_admin());
CREATE POLICY tenants_update ON public.tenants
    FOR UPDATE TO authenticated
    USING ((id = public.get_my_tenant_id() AND public.is_tenant_admin()) OR public.is_platform_admin())
    WITH CHECK ((id = public.get_my_tenant_id() AND public.is_tenant_admin()) OR public.is_platform_admin());
CREATE POLICY tenants_admin_all ON public.tenants
    FOR ALL TO authenticated
    USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- profiles: o proprio, os colegas do tenant, e tudo para platform_admin.
CREATE POLICY profiles_read_self ON public.profiles
    FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_read_tenant ON public.profiles
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());
CREATE POLICY profiles_read_platform_admin ON public.profiles
    FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin_manage ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- clients: equipe do tenant gerencia; o proprio cliente le seu registro.
CREATE POLICY clients_tenant_manage ON public.clients
    FOR ALL TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional())
    WITH CHECK (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());
CREATE POLICY clients_read_self ON public.clients
    FOR SELECT TO authenticated USING (id = public.get_my_client_id());
CREATE POLICY clients_platform_admin ON public.clients
    FOR ALL TO authenticated
    USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- usage_tracking: leitura pelo tenant; escrita apenas pelas RPCs (definer).
CREATE POLICY usage_read ON public.usage_tracking
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin());

-- support_tickets: autor le o seu; equipe le os do tenant; suporte le tudo.
CREATE POLICY tickets_read_own ON public.support_tickets
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY tickets_read_tenant ON public.support_tickets
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());
CREATE POLICY tickets_read_platform_admin ON public.support_tickets
    FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY tickets_insert ON public.support_tickets
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND tenant_id = public.get_my_tenant_id());
CREATE POLICY tickets_update_platform_admin ON public.support_tickets
    FOR UPDATE TO authenticated
    USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ticket_messages e ticket_attachments recebem policy nas migrations
-- 20260101000011 e 20260101000012, com escopo explicito por posse do ticket e
-- por tenant. Nao definir policy aqui: com RLS habilitado e nenhuma policy, as
-- duas tabelas ficam fechadas ate aquelas migrations rodarem.

-- audit_logs: somente leitura pela aplicacao. A escrita e do service_role
-- (Edge Function log-audit), que ignora RLS.
CREATE POLICY audit_read_own ON public.audit_logs
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY audit_read_tenant ON public.audit_logs
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id() AND public.is_tenant_professional());
CREATE POLICY audit_read_platform_admin ON public.audit_logs
    FOR SELECT TO authenticated USING (public.is_platform_admin());

CREATE POLICY notifications_read ON public.notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update ON public.notifications
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY billing_read ON public.billing_invoices
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_my_tenant_id() OR public.is_platform_admin());

-- ============================================================================
-- 9. GRANTS
--
-- Trigger functions nunca sao chamaveis via REST. Helpers de RLS precisam de
-- EXECUTE para authenticated, senao toda policy que os usa quebra.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_columns()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_tenant_active()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_on_new_ticket() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user_on_ticket_reply() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin()        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_professional() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_tenant_id()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id()     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_client_id()       FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.increment_operation_usage(UUID)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_operation_credits(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.add_operation_credits(UUID, INTEGER) TO service_role;

-- ============================================================================
-- 10. STORAGE
--
-- Buckets privados. O acesso e sempre por URL assinada gerada pela aplicacao.
-- O primeiro segmento do caminho e o tenant_id, e as policies exigem que ele
-- bata com o tenant do usuario.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('avatars',            'avatars',            false, 2097152,  ARRAY['image/jpeg','image/png','image/webp']),
    ('tenant-logos',       'tenant-logos',       false, 2097152,  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']),
    ('ticket-attachments', 'ticket-attachments', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_tenant_read ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id IN ('avatars', 'tenant-logos', 'ticket-attachments')
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    );

CREATE POLICY storage_tenant_write ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id IN ('avatars', 'tenant-logos', 'ticket-attachments')
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
    );

CREATE POLICY storage_tenant_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id IN ('avatars', 'tenant-logos', 'ticket-attachments')
        AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
        AND public.is_tenant_professional()
    );

-- ============================================================================
-- 11. SEED MINIMO
-- ============================================================================

INSERT INTO public.plans (nome, preco_mensal, limite_clientes, limite_operacoes_mes)
VALUES
    ('Free',     0.00,   5,   10),
    ('Pro',      99.00,  100, 500),
    ('Business', 299.00, 500, 2000)
ON CONFLICT DO NOTHING;
