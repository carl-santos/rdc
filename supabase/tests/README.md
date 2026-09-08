# Testes de banco (RLS / pgTAP)

Testes de segurança que validam o **isolamento multi-tenant** das policies de RLS
independentemente do código da aplicação. É a defesa real de um SaaS
multi-tenant: se a policy estiver errada, nenhuma checagem no frontend salva.

## Arquivos

- `rls_tenant_isolation_test.sql` — isolamento por tenant em `clients`: a equipe
  de um tenant não lê nem altera dados de outro, e anônimo não vê nada.

## Pré-requisitos

1. **Banco com as migrations aplicadas.** A baseline cria o schema inteiro, então
   um banco limpo basta (`supabase db push` ou `supabase start`).
2. **Extensão pgTAP:** `create extension if not exists pgtap;`

Rode contra um banco local ou de staging. O teste faz `ROLLBACK` no final e não
persiste nada, mas não há motivo para apontá-lo para produção.

## Como rodar

```bash
# a) Supabase CLI (procura supabase/tests/*.sql)
supabase test db

# b) psql contra um banco local ou de staging
psql "$DATABASE_URL" -f supabase/tests/rls_tenant_isolation_test.sql

# c) SQL Editor: cole o conteúdo do .sql e execute
#    (o arquivo já tem BEGIN/ROLLBACK — nada é persistido)
```

## Saída esperada

7 asserts `ok`. Qualquer `not ok` indica vazamento de isolamento — investigue a
policy citada antes de seguir.

## O que ainda vale cobrir

- **Isolamento do portal** (role `client`): o cliente final só enxerga o próprio
  registro e não lê outros clientes do mesmo tenant.
- **Escalação de privilégio**: `protect_profile_columns` deve barrar um usuário
  que tente mudar o próprio `role` ou `tenant_id`, e `update_team_member` deve
  recusar alvos fora do tenant de quem chama.
- **Cota**: `increment_operation_usage` sob concorrência não pode ultrapassar o
  limite do plano somado aos créditos extras.
- **Storage**: um usuário não deve conseguir assinar URL de arquivo cujo
  primeiro segmento do caminho seja o tenant de outro.
- `usage_tracking`, `notifications`, `support_tickets` e `ticket_messages`.
