-- ============================================================
-- Isolamento RLS multi-tenant (pgTAP)
--
-- Valida, independente do codigo da aplicacao, que as policies isolam os
-- clientes por tenant: um membro da equipe de um tenant NAO le nem altera
-- dados de outro tenant, e anonimo nao ve nada.
--
-- PRE-REQUISITOS:
--   1) Banco com as migrations deste repo aplicadas. A baseline
--      20260101000000_baseline.sql cria o schema inteiro, entao um banco
--      limpo basta -- nao ha dependencia de schema criado fora das migrations.
--   2) Extensao pgTAP:  create extension if not exists pgtap;
--
-- COMO RODAR:
--   a) Supabase CLI:  supabase test db
--   b) psql:          psql "$DATABASE_URL" -f supabase/tests/rls_tenant_isolation_test.sql
--   c) SQL Editor:    cole o conteudo (o BEGIN/ROLLBACK garante que nada persiste).
-- ============================================================

begin;

-- create extension if not exists pgtap;  -- descomente se ainda nao instalada

select plan(7);

-- ─── Seed (roda como superuser: bypassa RLS e os triggers protect_*) ───
insert into auth.users (id, email, aud, role) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'equipeA@test.local', 'authenticated', 'authenticated'),
    ('bbbbbbbb-0000-0000-0000-000000000002', 'equipeB@test.local', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.tenants (id, nome_fantasia, status) values
    ('11111111-0000-0000-0000-000000000001', 'Tenant A (test)', 'active'),
    ('22222222-0000-0000-0000-000000000002', 'Tenant B (test)', 'active')
on conflict (id) do nothing;

-- O trigger on_auth_user_created pode ter criado o profile antes; o ON CONFLICT cobre.
insert into public.profiles (id, email, nome, tenant_id, role) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'equipeA@test.local', 'Equipe A', '11111111-0000-0000-0000-000000000001', 'tenant_admin'),
    ('bbbbbbbb-0000-0000-0000-000000000002', 'equipeB@test.local', 'Equipe B', '22222222-0000-0000-0000-000000000002', 'tenant_admin')
on conflict (id) do update
    set tenant_id = excluded.tenant_id, role = excluded.role, nome = excluded.nome;

insert into public.clients (id, tenant_id, nome) values
    ('a1a1a1a1-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Cliente A'),
    ('b1b1b1b1-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Cliente B')
on conflict (id) do nothing;

-- ─── Como equipe do Tenant A ───
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
    (select count(*)::int from public.clients),
    1,
    'Equipe A enxerga apenas 1 cliente (do proprio tenant)'
);
select is(
    (select count(*)::int from public.clients where tenant_id = '22222222-0000-0000-0000-000000000002'),
    0,
    'Equipe A NAO enxerga clientes do Tenant B'
);
select is(
    public.get_my_tenant_id()::text,
    '11111111-0000-0000-0000-000000000001',
    'get_my_tenant_id() resolve o tenant de Equipe A'
);
with upd as (
    update public.clients set nome = 'HACKED' where tenant_id = '22222222-0000-0000-0000-000000000002' returning 1
)
select is(
    (select count(*)::int from upd),
    0,
    'Equipe A NAO consegue UPDATE em cliente de outro tenant (RLS bloqueia)'
);

reset role;

-- ─── Como equipe do Tenant B ───
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(
    (select count(*)::int from public.clients),
    1,
    'Equipe B enxerga apenas 1 cliente (do proprio tenant)'
);
select is(
    (select count(*)::int from public.clients where tenant_id = '11111111-0000-0000-0000-000000000001'),
    0,
    'Equipe B NAO enxerga clientes do Tenant A'
);

reset role;

-- ─── Como anonimo ───
set local role anon;
select set_config('request.jwt.claims', '', true);

select is(
    (select count(*)::int from public.clients),
    0,
    'Anonimo NAO enxerga nenhum cliente'
);

reset role;

select * from finish();
rollback;
