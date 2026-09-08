-- ============================================================================
-- Plano padrao no cadastro.
--
-- Ate aqui todo tenant nascia sem plano_id e batia no PlanSelectionModal ja no
-- primeiro acesso, antes de ver qualquer tela do produto. O signup passa a
-- entrar direto no plano marcado como padrao.
--
-- A escolha vira dado, nao codigo: em vez de fixar o nome 'Free' no trigger,
-- um plano carrega is_default. Trocar o tier de entrada, ou desligar o
-- comportamento, e um UPDATE — nao exige migration nova.
--
-- Sem nenhum plano padrao definido, plano_id fica nulo e a parede de selecao
-- volta a aparecer, que era o comportamento anterior.
-- ============================================================================

ALTER TABLE public.plans
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- No maximo um padrao por vez. O indice parcial sobre uma constante e o jeito
-- de expressar "no maximo uma linha satisfaz esta condicao".
CREATE UNIQUE INDEX IF NOT EXISTS plans_unico_padrao
    ON public.plans ((true)) WHERE is_default;

COMMENT ON COLUMN public.plans.is_default IS
'Plano atribuido automaticamente ao tenant criado no signup. No maximo um. Sem nenhum, o tenant nasce sem plano e a interface exige a escolha.';

UPDATE public.plans SET is_default = true WHERE nome = 'Free';

-- ============================================================================
-- handle_new_user: o caso 3 (signup direto) passa a atribuir o plano padrao.
-- Os casos 1 (perfil pre-existente) e 2 (convite) seguem iguais: quem entra
-- por convite herda o tenant, e o plano dele, de quem convidou.
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
    plano_padrao   UUID;
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

    -- Caso 3: signup direto. Cria tenant no plano padrao, perfil admin e a
    -- linha de cota do mes.
    org_name    := COALESCE(NEW.raw_user_meta_data->>'org_name', 'Minha Empresa');
    org_segment := COALESCE(NEW.raw_user_meta_data->>'segment', 'Geral');
    full_name   := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');

    SELECT id INTO plano_padrao FROM public.plans WHERE is_default LIMIT 1;

    INSERT INTO public.tenants (nome_fantasia, segmento, status, plano_id)
    VALUES (org_name, org_segment, 'active', plano_padrao)
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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
