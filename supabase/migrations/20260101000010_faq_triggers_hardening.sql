-- ============================================================
-- Limpeza de warnings do Supabase Advisor (categoria SECURITY, baixo risco)
--
-- Alvo: as duas trigger functions de FAQ. Ambas são disparadas pelo
-- mecanismo de trigger (BEFORE INSERT/UPDATE em faq_articles) e NÃO
-- precisam ser chamáveis diretamente via /rest/v1/rpc — revogar EXECUTE
-- não afeta o disparo por trigger.
--
-- (1) function_search_path_mutable (lint 0011):
--     public.faq_articles_search_vector_update() estava sem search_path
--     fixo (todas as demais funções já têm). Fixar evita search-path hijack.
--
-- (2) authenticated_security_definer_function_executable (lint 0029):
--     public.touch_faq_article() é SECURITY DEFINER e estava exposta como
--     RPC para o role authenticated. Revogar EXECUTE remove a exposição.
--
-- A search_vector_update também tem o EXECUTE revogado por higiene (é
-- trigger, não RPC — embora não seja SECURITY DEFINER, não flagged no 0029).
--
-- Idempotente: ALTER seta o mesmo valor e REVOKE de privilégio já ausente
-- é no-op. Execute no Supabase SQL Editor (ou `supabase db push`).
-- ============================================================

-- (1) search_path fixo na trigger function que estava mutable
ALTER FUNCTION public.faq_articles_search_vector_update() SET search_path = public;

-- (2) remove a exposição RPC das trigger functions (revoga o grant default a PUBLIC)
REVOKE EXECUTE ON FUNCTION public.faq_articles_search_vector_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_faq_article() FROM PUBLIC;

-- Verificação: rode novamente Advisor → Security. Devem sumir os warnings de
--   • faq_articles_search_vector_update  (search_path mutable)
--   • touch_faq_article                  (security definer executável)
