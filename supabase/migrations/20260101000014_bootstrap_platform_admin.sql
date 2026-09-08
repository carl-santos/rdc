-- ============================================================================
-- Corrige o impasse de bootstrap do primeiro platform_admin.
--
-- protect_profile_columns recusava qualquer troca de papel a menos que
-- is_platform_admin() fosse verdadeiro. Em sessao sem JWT (SQL Editor, psql,
-- Edge Function com service_role), auth.uid() e nulo, a funcao retorna falso e
-- o UPDATE e recusado. Como o primeiro platform_admin so pode nascer por um
-- desses caminhos, nao havia como cria-lo: a unica saida era desabilitar o
-- trigger na mao.
--
-- O trigger passa a valer apenas para sessoes autenticadas pela API, que e o
-- que ele sempre quis proteger: impedir que um usuario logado eleve o proprio
-- papel ou mude de tenant. Um caminho sem JWT ja exige credencial de servidor
-- (service_role) ou acesso direto ao banco, e nenhum dos dois esta ao alcance
-- de quem tem apenas a anon key.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Sessao sem JWT: acesso administrativo, nao passa pela checagem.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

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

REVOKE EXECUTE ON FUNCTION public.protect_profile_columns() FROM PUBLIC, anon, authenticated;

-- Promove o primeiro usuario a platform_admin quando ainda nao existe nenhum.
-- Idempotente: uma vez que exista um, a funcao nao faz nada. Pensada para o
-- bootstrap manual, nao para uso pela aplicacao.
CREATE OR REPLACE FUNCTION public.bootstrap_platform_admin(p_email TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id    UUID;
    v_atual INT;
BEGIN
    SELECT count(*) INTO v_atual FROM public.profiles WHERE role = 'platform_admin';
    IF v_atual > 0 THEN
        RETURN format('Ja existem %s platform_admin. Promova pelo painel da plataforma.', v_atual);
    END IF;

    SELECT id INTO v_id FROM public.profiles WHERE lower(email) = lower(p_email);
    IF v_id IS NULL THEN
        RETURN format('Nenhum perfil com o e-mail %s. Cadastre-se pelo app antes de promover.', p_email);
    END IF;

    UPDATE public.profiles SET role = 'platform_admin' WHERE id = v_id;
    UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = v_id;

    RETURN format('%s promovido a platform_admin.', p_email);
END;
$$;

-- Bootstrap e operacao de dono do banco: nem anon nem authenticated executam.
REVOKE EXECUTE ON FUNCTION public.bootstrap_platform_admin(TEXT) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.bootstrap_platform_admin(TEXT) IS
'Promove o primeiro platform_admin. Rode no SQL Editor: select public.bootstrap_platform_admin(''voce@exemplo.com''); Nao faz nada se ja houver um.';
