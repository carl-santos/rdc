-- ─────────────────────────────────────────────────────────────────────────────
-- Fluxo do bot (sem IA): pergunta "Como redefinir minha senha?" em Login e Acesso.
--
-- A subcategoria 'login' passou a ser atendida pela árvore automática (resolution
-- 'auto' no classificador), então garantimos o nó raiz e adicionamos um nó terminal
-- com o passo a passo real de redefinição de senha do app:
--   Login → "Esqueci minha senha" (/recuperar-senha) → e-mail → /redefinir-senha
--
-- Idempotente: pode ser executado mais de uma vez sem duplicar.
-- Execute no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_root UUID;
BEGIN
  -- Garante o nó raiz publicado do fluxo de Login e Acesso
  SELECT id INTO v_root
    FROM public.chatbot_flows
   WHERE category = 'support' AND subcategory = 'login'
     AND is_root = true AND is_published = true
   LIMIT 1;

  IF v_root IS NULL THEN
    INSERT INTO public.chatbot_flows
      (name, category, subcategory, tags, parent_id, bot_message, option_label,
       is_root, is_terminal, escalate_to_human, is_published)
    VALUES (
      'Login e Acesso — Raiz', 'support', 'login',
      ARRAY['login','senha','acesso','autenticação'],
      NULL,
      'Olá! Vi que você tem uma dúvida sobre Login e Acesso. Selecione o problema que melhor descreve sua situação:',
      NULL, true, false, false, true
    ) RETURNING id INTO v_root;
  END IF;

  -- Adiciona a pergunta de redefinição de senha (só se ainda não existir)
  IF NOT EXISTS (
    SELECT 1 FROM public.chatbot_flows
     WHERE category = 'support' AND subcategory = 'login'
       AND option_label = 'Como redefinir minha senha?'
  ) THEN
    INSERT INTO public.chatbot_flows
      (name, category, subcategory, tags, parent_id, bot_message, option_label,
       is_root, is_terminal, escalate_to_human, is_published)
    VALUES (
      'login_redefinir_senha', 'support', 'login',
      ARRAY['redefinir','senha','recuperar','esqueci','recuperação'],
      v_root,
      E'Para redefinir sua senha:\n\n1. Na tela de login, toque em "Esqueci minha senha".\n2. Informe o e-mail cadastrado e confirme.\n3. Você receberá um e-mail com o link para criar uma nova senha (confira também a caixa de spam).\n4. Abra o link e defina a nova senha.\n\nSe o e-mail não chegar em alguns minutos, confirme se o endereço está correto e tente novamente. Posso ajudar com mais alguma coisa?',
      'Como redefinir minha senha?',
      false, true, false, true
    );
  END IF;
END $$;
