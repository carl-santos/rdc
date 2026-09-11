# RDC — Representante Digital Cognitivo

Protótipo da **Plataforma de Amplificação da Comunicação Humana (HCAP)** para o
TCC: um Representante Digital Cognitivo treinado com documentos do próprio
usuário, para apoio em apresentações, aulas e reuniões.

A aplicação reaproveita a base **SaaS Foundation** (autenticação, multi-tenant
com RLS, assinatura, suporte, auditoria e LGPD) e adiciona o domínio do produto:
representantes, base de conhecimento, chat com Claude, modos de uso e histórico.

Fora do escopo deste TCC: clonagem de voz, avatares 3D, integração automática
com videoconferência e participação autônoma em reuniões.

## Stack

| Camada | Escolha | Nota |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind | Conforme o pré-projeto |
| Estado remoto | TanStack Query | |
| Backend | Supabase (Postgres + Auth + Storage) e Edge Functions | Equivale ao backend do MVP; FastAPI fica como evolução |
| IA | API Claude (Anthropic) no chat do RDC | OpenAI permanece no suporte |
| Testes | Vitest + Testing Library, pgTAP para RLS | |
| Deploy | Vercel (frontend), Supabase (functions e banco) | |

## O que o produto acrescenta

**Representante digital.** Cada tenant cria um ou mais RDCs com persona,
instruções éticas e nível de autonomia (supervisionado, assistido, autônomo).

**Base de conhecimento.** Upload privado no Storage (`cdr-documents`). Textos
(`.txt`, `.md`, `.csv`) são extraídos no navegador; PDF, DOCX e PPTX passam pela
Edge Function `cdr-extract`. Arquivos `.doc`/`.ppt` antigos pedem conversão.
Quando o texto fica pronto, um trigger parte o conteúdo em `cdr_document_chunks`
e indexa full-text em português.

**Chat e modos.** A Edge Function `cdr-chat` busca os trechos mais relevantes
com `search_cdr_knowledge`, aplica um formato de saída distinto por modo
(chat, roteiro de apresentação, aula didática, síntese de reunião), consome a
cota de operações e grava a conversa. A resposta traz as **fontes** usadas
(arquivo e trecho), persistidas em `cdr_messages.metadata`. Na interface, cada
modo tem atalhos, placeholder e aparência próprios. A sessão pode ser
**exportada** em Markdown (roteiro, plano de aula, minuta ou registro), com as
fontes no final. Se a busca não achar trechos, volta ao texto concatenado.

**Histórico e auditoria.** Conversas ficam em `cdr_conversations` /
`cdr_messages`. O histórico reabre a sessão ou exporta o artefato. Eventos do
produto usam a categoria `cdr` na trilha de auditoria.

## O que já vinha da fundação

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
assinatura não está ativa. Cada consulta ao RDC chama `increment_operation_usage`.

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
pnpm install
```

### 2. Projeto no Supabase

O projeto da aplicação é o [RDC no Supabase](https://kxzmxakwpmibgzapsufw.supabase.co)
(`kxzmxakwpmibgzapsufw`). Vincule o CLI e aplique o schema:

```bash
supabase link --project-ref kxzmxakwpmibgzapsufw
supabase db push
```

A migration `20260101000000_baseline.sql` cria o schema da fundação. A
`20260101000016_cdr_domain.sql` cria representantes, documentos, conversas,
mensagens e o bucket `cdr-documents`.

Depois de cada migration nova, regere os tipos:

```bash
pnpm types:gen
```

Esse comando exige `supabase link` e Docker, porque o CLI roda o postgres-meta
em container.

### 3. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores de
Project Settings → API. Os secrets das Edge Functions não vão em arquivo: são
configurados em Project Settings → Edge Functions → Secrets. Para o chat do RDC:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_WORKSPACE_ID` (obrigatório se a chave não for de um workspace)
- `ANTHROPIC_MODEL` (opcional; tenta `claude-sonnet-4-5` e outros se o ID não existir)

### 4. Rodar

```bash
pnpm dev
```

O Vite sobe em `http://localhost:3000`.

### 5. Primeiro administrador da plataforma

Cadastre-se primeiro pelo app, em `/cadastro`. O trigger `handle_new_user` cria
o tenant, o perfil `tenant_admin` e a linha de cota do mês. Só depois promova,
no SQL Editor:

```sql
select public.bootstrap_platform_admin('voce@exemplo.com');
```

A função confirma o e-mail e promove o perfil, e só age enquanto não existir
nenhum `platform_admin` — a partir do segundo, use o painel da plataforma.

Um `update` direto em `profiles.role` funciona pelo SQL Editor, mas é recusado
para qualquer usuário logado pela API: o trigger `protect_profile_columns`
impede que alguém eleve o próprio papel ou troque de tenant.

### 5b. Plano de entrada

O tenant criado no cadastro entra automaticamente no plano marcado com
`is_default` — na instalação limpa, o Free. Para mudar o tier de entrada:

```sql
update public.plans set is_default = (nome = 'Pro');
```

Um índice único garante no máximo um padrão por vez. Para voltar a exigir
escolha explícita no primeiro acesso, desligue todos:

```sql
update public.plans set is_default = false;
```

Aí o tenant nasce sem plano e o `DashboardLayout` abre o `PlanSelectionModal`
até que ele escolha. Usuários `platform_admin` não passam por essa parede.

### 6. Edge Functions

```bash
supabase functions deploy
```

`asaas-webhook` e `csp-report` são públicas por definição (`verify_jwt = false`
em `supabase/config.toml`); ambas validam a origem por conta própria. O
`cdr-chat` exige JWT e checa papel, posse do representante e cota. O prompt
usa trechos recuperados por `search_cdr_knowledge`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento na porta 3000 |
| `pnpm build` | Typecheck + build de produção |
| `pnpm lint` | ESLint |
| `pnpm test:run` | Testes unitários |
| `pnpm types:gen` | Regera `src/types/database.ts` do banco vinculado |
| `supabase test db` | Testes de RLS (pgTAP) |

## Estrutura

```
src/
  brand.ts        Nome e posicionamento do produto
  components/     UI compartilhada; componentes do RDC em components/cdr
  contexts/       AuthContext (sessão, perfil, tenant)
  hooks/          useUsageQuota, useTenantGate, useAuditLog, useCdr
  layouts/        DashboardLayout (equipe), ClientLayout (portal)
  pages/
    cdr/          Representantes, conhecimento, modos e histórico
    admin/        Painel da plataforma
    client/       Portal do cliente final
  utils/          Cliente Supabase, extração de documentos, storage
supabase/
  migrations/     Baseline + módulos (LGPD, FAQ, chatbot, domínio CDR)
  functions/      Edge Functions (inclui cdr-chat)
  tests/          Testes de isolamento RLS
```

## Segurança

- `supabase/.temp/` está no `.gitignore` de propósito: ele guarda o vínculo com
  um projeto real e, versionado, faria um `db push` de qualquer clone acertar o
  banco errado.
- Os buckets são privados; o acesso é sempre por URL assinada.
- O CI roda gitleaks.
- O `vercel.json` aponta os relatórios de violação de CSP para a Edge Function
  `csp-report` do projeto. Se o ref não bater com o projeto em uso, os
  relatórios se perdem em silêncio — a política continua valendo.
