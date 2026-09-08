-- ============================================================
-- update_team_member / revoke_team_member: alvo deve ser apenas
-- membro de equipe (tenant_admin ou collaborator). Antes a função
-- só excluía platform_admin, então um tenant_admin malicioso
-- poderia chamar diretamente via /rest/v1/rpc e alterar role/cargo
-- de um cliente do próprio tenant — promovendo-o a collaborator
-- e dando acesso ao painel profissional.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_team_member(member_id uuid, new_cargo text, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    IF new_role NOT IN ('collaborator', 'tenant_admin') THEN
        RAISE EXCEPTION 'Role inválido para membro de equipe: %', new_role
            USING HINT = 'Use collaborator ou tenant_admin.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('tenant_admin', 'platform_admin')
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem editar membros.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = member_id
        AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND id <> auth.uid()
        AND role IN ('tenant_admin', 'collaborator')  -- restrição: somente membros de equipe
    ) THEN
        RAISE EXCEPTION 'Membro de equipe não encontrado no seu tenant.';
    END IF;

    UPDATE profiles
    SET cargo = new_cargo, role = new_role
    WHERE id = member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_team_member(member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('tenant_admin', 'platform_admin')
    ) THEN
        RAISE EXCEPTION 'Apenas administradores podem revogar acesso.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = member_id
        AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
        AND id <> auth.uid()
        AND role IN ('tenant_admin', 'collaborator')  -- restrição: somente membros de equipe
    ) THEN
        RAISE EXCEPTION 'Membro de equipe não encontrado no seu tenant.';
    END IF;

    UPDATE profiles
    SET tenant_id = NULL, role = 'collaborator'
    WHERE id = member_id;
END;
$function$;
