# SaaS Foundation

Base para aplicações SaaS multi-tenant em React + Supabase. Extraída de um
produto em produção e podada até sobrar apenas o que se repete em todo SaaS:
autenticação, isolamento por tenant, cobrança recorrente, suporte, auditoria e
LGPD.

O que **não** está aqui é o seu produto. A ideia é começar pelo diferencial, não
pela quinta vez que você escreve uma tela de login.

## Stack

| Camada | Escolha |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind |
| Estado remoto | TanStack Query |
| Backend | Supabase (Postgres + Auth + Storage) |
| Serverless | Edge Functions em Deno |
| Testes | Vitest + Testing Library, pgTAP para RLS |
| Deploy | Vercel (frontend), Supabase (functions) |

## O que já vem pronto

**Multi-tenant com RLS.** Toda tabela tem Row Level Security habilitado. O
isolamento vive no banco, não no frontend: os helpers de policy
(`get_my_tenant_id`, `is_tenant_professional`, `is_platform_admin`) são
`SECURITY DEFINER` com `search_path` fixo, o que evita tanto recursão de policy
quanto search-path hijacking.

**Três perfis.** `platform_admin` opera a plataforma, `tenant_admin` e
`collaborator` formam a equipe do assinante, e `client` é o cliente final, que
acessa só o próprio portal. Um trigger em `profiles` impede que o usuário eleve
o próprio papel ou troque de tenant.

**Assinatura e cota.** Planos com limite mensal de operações, compra de créditos
avulsos, webhook de pagamento (Asaas) e bloqueio automático de escrita quando a
assinatura não está ativa. O `increment_operation_usage` consome a cota em uma
única instrução condicional, então duas requisições simultâneas não estouram o
limite.

**Suporte.** Chamados com classificação automática, detecção de duplicidade,
anexos, base de conhecimento com busca full-text e chatbot por fluxos. A
triagem por IA usa OpenAI, com caminho opcional para um hub de atendimento
externo.

**LGPD.** Central para os quatro tipos de solicitação (acesso, portabilidade,
revogação de consentimento e exclusão), com export em bucket privado e
anonimização que preserva as FKs de auditoria e faturamento.

**Auditoria.** Registro de acessos e ações sensíveis com categoria, severidade,
IP e user-agent, e função de limpeza por retenção.

## Começando

### 1. Dependências

```bash
npm install
```

### 2. Projeto no Supabase

Crie um projeto novo em [supabase.com](https://supabase.com), depois vincule e
aplique o schema:

```bash
supabase link --project-ref <ref-do-seu-projeto>
supabase db push
```

A migration `20260101000000_baseline.sql` cria o schema inteiro. Um banco limpo
é suficiente — não há dependência de tabela criada pelo painel.

Em seguida regere os tipos, que hoje estão mantidos à mão:

```bash
npm run types:gen
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores de
Project Settings → API. Os secrets das Edge Functions não vão em arquivo: são
configurados em Project Settings → Edge Functions → Secrets, e o `.env.example`
lista quais são.

### 4. Rodar

```bash
npm run dev
```

### 5. Primeiro administrador da plataforma

O signup cria um `tenant_admin`. Para promover alguém a `platform_admin`, rode
no SQL Editor:

```sql
update public.profiles set role = 'platform_admin' where email = 'voce@exemplo.com';
```

### 6. Edge Functions

```bash
supabase functions deploy
```

`asaas-webhook` e `csp-report` são públicas por definição (`verify_jwt = false`
em `supabase/config.toml`); ambas validam a origem por conta própria.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Typecheck + build de produção |
| `npm run lint` | ESLint |
| `npm run test:run` | Testes unitários |
| `npm run types:gen` | Regera `src/types/database.ts` do banco vinculado |
| `supabase test db` | Testes de RLS (pgTAP) |

## Estrutura

```
src/
  components/     UI compartilhada, guards de rota, chatbot, toasts
  contexts/       AuthContext (sessão, perfil, tenant)
  hooks/          useUsageQuota, useTenantGate, useTerminology, useAuditLog
  layouts/        DashboardLayout (equipe), ClientLayout (portal)
  pages/          Telas da equipe
    admin/        Painel da plataforma
    client/       Portal do cliente final
  utils/          Cliente Supabase, storage, validações
supabase/
  migrations/     Baseline + módulos (FAQ, chatbot, rate limits)
  functions/      Edge Functions
  tests/          Testes de isolamento RLS
```

## Adaptando ao seu produto

**Terminologia.** `useTerminology` traduz "cliente final" para o vocabulário do
segmento do tenant — aluno, paciente, associado. Para adicionar um segmento,
basta uma entrada em `SEGMENT_NOUNS` e uma `<option>` em Settings.

**A unidade cobrada.** A cota é medida em "operações", um nome deliberadamente
neutro. Chame `increment_operation_usage(tenant_id)` no ponto em que o seu
produto consome uma unidade, e ajuste o rótulo na interface.

**Marca.** Procure por `SaaS Foundation` em `index.html`, `Header`, `Footer` e
`Home`, e por `SEU_PROJECT_REF` em `vercel.json`.

## Segurança

- `supabase/.temp/` está no `.gitignore` de propósito: ele guarda o vínculo com
  um projeto real e, versionado, faria um `db push` de qualquer clone acertar o
  banco errado.
- Os buckets são privados; o acesso é sempre por URL assinada.
- O CI roda gitleaks. Configure `SEU_PROJECT_REF` no `vercel.json` antes do
  primeiro deploy, ou os relatórios de violação de CSP não chegam a lugar
  nenhum.
