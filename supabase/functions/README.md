# Edge Functions — autenticação e `verify_jwt`

Referência de segurança das Edge Functions do SaaS Foundation. Documenta, por função, o
valor esperado de **`verify_jwt`** e o mecanismo de autenticação/autorização que
cada uma aplica.

> **Por que este documento existe.** `verify_jwt` é uma configuração **por função**
> do gateway do Supabase, definida no dashboard (ou em `supabase/config.toml`) — e
> **não está no controle de versão**. Sem um registro, é fácil um deploy futuro
> deixar uma função pública com `verify_jwt` ligado (quebra webhook/formulário) ou
> o contrário. Este README é a fonte da verdade até que os valores sejam versionados
> em `config.toml` (ver "Endurecimento opcional" no fim).

## O que `verify_jwt` faz

- **`verify_jwt = true` (padrão):** o gateway do Supabase exige um JWT válido do
  projeto **antes** de invocar a função. ⚠️ A **anon key é um JWT válido** e é
  **pública** (embutida no bundle do frontend) — portanto `verify_jwt = true`
  **não é autorização de verdade**: só barra requisições sem nenhuma chave do
  projeto. A autorização real é feita **dentro** da função (`getUser()` + checagem
  de papel/posse).
- **`verify_jwt = false`:** o gateway **não** exige JWT — a função é acessível por
  qualquer um. Necessário para endpoints chamados por sistemas externos (webhooks)
  ou por navegadores sem sessão (formulário público, relatórios de CSP). Nesses
  casos a função implementa seu **próprio** mecanismo de autenticação.

## Matriz por função

| Função | `verify_jwt` | Autenticação / Autorização |
|--------|:------------:|----------------------------|
| `admin-impersonate` | `true` | JWT + `platform_admin` + rate-limit (3/h) |
| `ai-support-chat` | `true` | JWT + posse do ticket + rate-limit |
| `asaas-checkout` | `true` | JWT + `tenant_admin` |
| `asaas-credits-checkout` | `true` | JWT + `tenant_admin` |
| `asaas-subscription-manage` | `true` | JWT + `tenant_admin` |
| **`asaas-webhook`** | **`false`** | 🔓 Público — token do ASAAS (`ASAAS_WEBHOOK_TOKEN`, comparação time-safe) + validação de valor/anti-replay |
| `check-operation-status` | `true` | JWT + posse (`request_id` de projeção do tenant) |
| **`csp-report`** | **`false`** | 🔓 Público — sem auth; recebe relatórios de violação de CSP do navegador; apenas loga |
| `estimate-body-fat` | `true` | JWT + rate-limit; ponte para o microserviço ML (envia `X-Service-Token`) |
| `generate-client-form-link` | `true` | JWT + profissional → emite link assinado (HMAC) |
| `invite-client` | `true` | JWT + profissional + posse do cliente (tenant) |
| `invite-team-member` | `true` | JWT + `tenant_admin` + whitelist de `role` |
| `log-audit` | `true` | JWT (tenant/role derivados no servidor) |
| `process-lgpd-request` | `true` | JWT + RBAC (platform/tenant admin, ou o próprio titular) |
| `run-operation` | `true` | JWT + posse do cliente + créditos + rate-limit + anti-SSRF |
| `send-form-invite` | `true` | JWT + profissional + validação do link assinado (HMAC do tenant) |
| `send-report-email` | `true` | JWT + posse (tenant) + rate-limit |
| **`submit-client-form`** | **`false`** | 🔓 Público — link assinado (HMAC) + rate-limit por IP + Turnstile |

## ⚠️ Regras que não podem regredir

1. **As 3 funções públicas DEVEM permanecer `verify_jwt = false`:**
   - `asaas-webhook` — o ASAAS não envia JWT do Supabase; ligar `verify_jwt`
     **quebra os pagamentos** (ativação de plano, créditos).
   - `submit-client-form` — o cliente preenche o formulário **sem estar logado**;
     ligar `verify_jwt` **quebra o cadastro público**.
   - `csp-report` — o navegador posta relatórios sem sessão.

   Cada uma tem **auth própria** (token do webhook / HMAC / n/a) — não ficam
   desprotegidas por estarem com `verify_jwt = false`.

2. **As 14 funções autenticadas fazem sua própria checagem.** Não confie no
   `verify_jwt` como autorização — ele só exige uma chave do projeto (a anon key é
   pública). A barreira real é o `getUser()` + verificação de papel/posse dentro da
   função. Mantê-las com `verify_jwt = true` é defesa em profundidade (barra
   requisições totalmente anônimas), mas **remover a checagem interna nunca é
   aceitável**.

## Endurecimento opcional (versionar no `config.toml`)

Para eliminar o risco de reprodutibilidade (o `verify_jwt` viver só no dashboard),
adicione ao `supabase/config.toml`, por função:

```toml
[functions.asaas-webhook]
verify_jwt = false

[functions.csp-report]
verify_jwt = false

[functions.submit-client-form]
verify_jwt = false
```

As demais podem ficar sem bloco (assumem o padrão `true`) ou serem declaradas
explicitamente. Ao adotar isso, valide num ambiente de teste antes — o `supabase
functions deploy` passa a aplicar esses valores, sobrescrevendo o que estiver no
dashboard.
