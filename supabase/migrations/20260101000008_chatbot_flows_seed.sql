-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: fluxos do chatbot por categoria / subcategoria
-- Cada subcategoria tem 1 nó raiz + N nós filhos terminais (Q&A)
-- Execute no Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- ── SUPPORT / login ──────────────────────────────────────────────────────
  r_login            UUID;
  -- ── SUPPORT / upload ─────────────────────────────────────────────────────
  r_upload           UUID;
  -- ── SUPPORT / lentidao ───────────────────────────────────────────────────
  r_lentidao         UUID;
  -- ── SUPPORT / erro_sim ───────────────────────────────────────────────────
  r_erro_sim         UUID;
  -- ── SUPPORT / travando ───────────────────────────────────────────────────
  r_travando         UUID;
  -- ── SUPPORT / mobile ─────────────────────────────────────────────────────
  r_mobile           UUID;
  -- ── SUPPORT / pagamento ──────────────────────────────────────────────────
  r_pagamento        UUID;
  -- ── CONTA / email ────────────────────────────────────────────────────────
  r_email            UUID;
  -- ── CONTA / assinatura ───────────────────────────────────────────────────
  r_assinatura       UUID;
  -- ── CONTA / cancelamento ─────────────────────────────────────────────────
  r_cancelamento     UUID;
  -- ── CONTA / reembolso ────────────────────────────────────────────────────
  r_reembolso        UUID;
  -- ── CONTA / lgpd ─────────────────────────────────────────────────────────
  r_lgpd             UUID;
  -- ── FEEDBACK / funcionalidade ────────────────────────────────────────────
  r_funcionalidade   UUID;
  -- ── FEEDBACK / ux ────────────────────────────────────────────────────────
  r_ux               UUID;
  -- ── FEEDBACK / bug_percebido ─────────────────────────────────────────────
  r_bug_percebido    UUID;
  -- ── FEEDBACK / feedback_geral ────────────────────────────────────────────
  r_feedback_geral   UUID;

BEGIN

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: support  |  SUBCATEGORIA: login
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Login e Acesso — Raiz', 'support', 'login',
  ARRAY['login','senha','acesso','autenticação'],
  NULL,
  'Olá! Vi que você tem uma dúvida sobre Login e Acesso. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_login;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('login_q1', 'support', 'login', ARRAY['login','senha'], r_login,
   'Verifique se o e-mail e a senha foram digitados corretamente. Caso necessário, utilize a opção "Esqueci minha senha". Posso ajudar com mais alguma coisa?',
   'Não consigo fazer login', false, true, false, true),

  ('login_q2', 'support', 'login', ARRAY['senha','inválida','redefinir'], r_login,
   'Tente redefinir sua senha utilizando o link de recuperação enviado para o e-mail cadastrado. Posso ajudar com mais alguma coisa?',
   'O sistema informa senha inválida', false, true, false, true),

  ('login_q3', 'support', 'login', ARRAY['e-mail','recuperação','spam'], r_login,
   'Verifique a caixa de spam/lixo eletrônico e confirme se o e-mail informado está correto. Posso ajudar com mais alguma coisa?',
   'Não recebi o e-mail de recuperação de senha', false, true, false, true),

  ('login_q4', 'support', 'login', ARRAY['sessão','expirou','segurança'], r_login,
   'Por motivos de segurança, sessões inativas podem ser encerradas automaticamente. Basta realizar o login novamente. Posso ajudar com mais alguma coisa?',
   'Minha sessão expirou automaticamente', false, true, false, true),

  ('login_q5', 'support', 'login', ARRAY['dispositivo','múltiplos','acesso'], r_login,
   'Sim, porém algumas sessões podem ser encerradas automaticamente por segurança. Posso ajudar com mais alguma coisa?',
   'Posso acessar em mais de um dispositivo?', false, true, false, true),

  ('login_q6', 'support', 'login', ARRAY['carregando','cache','navegador'], r_login,
   'Atualize a página e tente novamente. Caso continue, limpe o cache do navegador. Posso ajudar com mais alguma coisa?',
   'O login fica carregando indefinidamente', false, true, false, true),

  ('login_q7', 'support', 'login', ARRAY['erro','autenticação','navegador'], r_login,
   'Tente acessar em modo anônimo ou utilizando outro navegador atualizado. Posso ajudar com mais alguma coisa?',
   'O sistema informa erro de autenticação', false, true, false, true),

  ('login_q8', 'support', 'login', ARRAY['alterar','senha','segurança'], r_login,
   'Acesse Minha Conta > Segurança e siga as instruções de alteração de senha. Posso ajudar com mais alguma coisa?',
   'Como alterar minha senha?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: support  |  SUBCATEGORIA: upload
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Upload de Imagem — Raiz', 'support', 'upload',
  ARRAY['upload','imagem','foto','arquivo'],
  NULL,
  'Olá! Percebi que você tem uma dúvida sobre Upload de Imagem. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_upload;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('upload_q1', 'support', 'upload', ARRAY['formato','jpg','png'], r_upload,
   'Atualmente aceitamos JPG, JPEG e PNG. Posso ajudar com mais alguma coisa?',
   'Quais formatos são aceitos?', false, true, false, true),

  ('upload_q2', 'support', 'upload', ARRAY['upload','conexão','formato'], r_upload,
   'Verifique sua conexão e confirme se a imagem possui formato compatível (JPG, JPEG ou PNG). Posso ajudar com mais alguma coisa?',
   'Minha imagem não faz upload', false, true, false, true),

  ('upload_q3', 'support', 'upload', ARRAY['tamanho','limite','peso'], r_upload,
   'Sim. Imagens muito grandes podem falhar no envio. Recomendamos utilizar imagens otimizadas. Posso ajudar com mais alguma coisa?',
   'Existe limite de tamanho para upload?', false, true, false, true),

  ('upload_q4', 'support', 'upload', ARRAY['trava','porcentagem','conexão'], r_upload,
   'Isso pode ocorrer por instabilidade na conexão ou tamanho excessivo da imagem. Tente reduzir o arquivo e tentar novamente. Posso ajudar com mais alguma coisa?',
   'O upload trava em determinada porcentagem', false, true, false, true),

  ('upload_q5', 'support', 'upload', ARRAY['celular','iluminação','enquadramento'], r_upload,
   'Sim. Recomendamos boa iluminação e enquadramento adequado para melhores resultados. Posso ajudar com mais alguma coisa?',
   'Posso enviar fotos tiradas no celular?', false, true, false, true),

  ('upload_q6', 'support', 'upload', ARRAY['rejeitou','qualidade','critérios'], r_upload,
   'Algumas imagens podem não atender os critérios mínimos de qualidade necessários para operação. Tente utilizar uma imagem mais nítida e bem iluminada. Posso ajudar com mais alguma coisa?',
   'O sistema rejeitou minha imagem', false, true, false, true),

  ('upload_q7', 'support', 'upload', ARRAY['fundo','complexo','resultado'], r_upload,
   'Sim, porém fundos simples geralmente produzem melhores resultados na operação. Posso ajudar com mais alguma coisa?',
   'Fotos com fundo complexo funcionam?', false, true, false, true),

  ('upload_q8', 'support', 'upload', ARRAY['múltiplas','imagens','funcionalidade'], r_upload,
   'Dependendo da funcionalidade utilizada, múltiplas imagens podem ser suportadas. Posso ajudar com mais alguma coisa?',
   'Posso enviar mais de uma imagem?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: support  |  SUBCATEGORIA: lentidao
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Lentidão — Raiz', 'support', 'lentidao',
  ARRAY['lento','lentidão','carregando','performance'],
  NULL,
  'Olá! Vi que você está com problemas de lentidão. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_lentidao;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('lentidao_q1', 'support', 'lentidao', ARRAY['operação','demora','tempo'], r_lentidao,
   'O tempo pode variar conforme a complexidade da operação e a demanda atual do sistema. Aguarde alguns instantes. Posso ajudar com mais alguma coisa?',
   'A operação está demorando muito', false, true, false, true),

  ('lentidao_q2', 'support', 'lentidao', ARRAY['celular','mobile','desempenho'], r_lentidao,
   'Alguns dispositivos móveis podem apresentar desempenho reduzido em operações complexas. Recomendamos utilizar um computador quando possível. Posso ajudar com mais alguma coisa?',
   'O sistema está lento no celular', false, true, false, true),

  ('lentidao_q3', 'support', 'lentidao', ARRAY['carregar','conexão','página'], r_lentidao,
   'Verifique sua conexão e tente atualizar a página. Caso o problema persista, tente outro navegador. Posso ajudar com mais alguma coisa?',
   'A aplicação demora para carregar', false, true, false, true),

  ('lentidao_q4', 'support', 'lentidao', ARRAY['horário','demanda','pico'], r_lentidao,
   'Em períodos de alta demanda algumas operações podem levar mais tempo. Tente novamente em alguns minutos. Posso ajudar com mais alguma coisa?',
   'Existe horário de maior lentidão?', false, true, false, true),

  ('lentidao_q5', 'support', 'lentidao', ARRAY['segundo plano','continuar','uso'], r_lentidao,
   'Sim, em muitos casos a geração ocorre em segundo plano e você pode continuar utilizando outras funcionalidades. Posso ajudar com mais alguma coisa?',
   'Posso usar a aplicação enquanto a operação gera?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: support  |  SUBCATEGORIA: erro_sim
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Erro ao Gerar Operação — Raiz', 'support', 'erro_sim',
  ARRAY['erro','operação','geração','falha'],
  NULL,
  'Olá! Vi que você está com problemas ao gerar operações. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_erro_sim;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('erro_sim_q1', 'support', 'erro_sim', ARRAY['falhou','imagem','iluminação'], r_erro_sim,
   'Tente novamente utilizando uma imagem com melhor iluminação e enquadramento adequado. Posso ajudar com mais alguma coisa?',
   'Minha operação falhou', false, true, false, true),

  ('erro_sim_q2', 'support', 'erro_sim', ARRAY['erro','processar','qualidade'], r_erro_sim,
   'Isso pode ocorrer devido à qualidade da imagem ou instabilidade momentânea do sistema. Tente novamente em alguns instantes. Posso ajudar com mais alguma coisa?',
   'O sistema informa erro ao processar a imagem', false, true, false, true),

  ('erro_sim_q3', 'support', 'erro_sim', ARRAY['interrompida','aguardar','tentar'], r_erro_sim,
   'Aguarde alguns instantes e tente novamente. Se o problema persistir, abra um chamado para nossa equipe analisar. Posso ajudar com mais alguma coisa?',
   'A geração foi interrompida', false, true, false, true),

  ('erro_sim_q4', 'support', 'erro_sim', ARRAY['recuperar','nova','operação'], r_erro_sim,
   'Em alguns casos será necessário gerar uma nova operação. Ajuste a imagem ou os parâmetros e tente novamente. Posso ajudar com mais alguma coisa?',
   'Posso recuperar uma operação com erro?', false, true, false, true),

  ('erro_sim_q5', 'support', 'erro_sim', ARRAY['tela branca','navegador','atualizar'], r_erro_sim,
   'Atualize a página e tente novamente utilizando outro navegador atualizado. Caso persista, limpe o cache do navegador. Posso ajudar com mais alguma coisa?',
   'O sistema gera tela branca após iniciar a operação', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: support  |  SUBCATEGORIA: travando
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Aplicação Travando — Raiz', 'support', 'travando',
  ARRAY['trava','travando','crash','parar'],
  NULL,
  'Olá! Vi que você está com problemas de travamento. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_travando;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('travando_q1', 'support', 'travando', ARRAY['travou','atualizar','navegador'], r_travando,
   'Atualize a página e verifique se o navegador está atualizado. Se o problema continuar, tente limpar o cache. Posso ajudar com mais alguma coisa?',
   'A aplicação travou durante o uso', false, true, false, true),

  ('travando_q2', 'support', 'travando', ARRAY['navegador','fecha','memória'], r_travando,
   'Isso pode ocorrer em dispositivos com pouca memória disponível. Feche outras abas e aplicativos e tente novamente. Posso ajudar com mais alguma coisa?',
   'O navegador fecha sozinho ao usar o SaaS Foundation', false, true, false, true),

  ('travando_q3', 'support', 'travando', ARRAY['congela','imagem','tamanho'], r_travando,
   'Recomendamos reduzir o tamanho da imagem antes do envio para evitar sobrecarga. Posso ajudar com mais alguma coisa?',
   'O sistema congela ao enviar imagens', false, true, false, true),

  ('travando_q4', 'support', 'travando', ARRAY['evitar','navegador','conexão'], r_travando,
   'Utilize navegadores atualizados (Chrome ou Firefox) e mantenha uma conexão estável para minimizar travamentos. Posso ajudar com mais alguma coisa?',
   'Como evitar travamentos?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: support  |  SUBCATEGORIA: mobile
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Problemas Mobile — Raiz', 'support', 'mobile',
  ARRAY['celular','mobile','app','smartphone'],
  NULL,
  'Olá! Vi que você tem dúvidas sobre o uso no celular. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_mobile;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('mobile_q1', 'support', 'mobile', ARRAY['celular','compatível','funciona'], r_mobile,
   'Sim. O SaaS Foundation é compatível com dispositivos móveis modernos. Recomendamos utilizar navegadores atualizados para a melhor experiência. Posso ajudar com mais alguma coisa?',
   'O sistema funciona em celular?', false, true, false, true),

  ('mobile_q2', 'support', 'mobile', ARRAY['funções','aparecem','atualizar'], r_mobile,
   'Atualize o navegador ou tente utilizar outro dispositivo. Algumas funcionalidades podem ter disponibilidade reduzida em mobile. Posso ajudar com mais alguma coisa?',
   'Algumas funções não aparecem no celular', false, true, false, true),

  ('mobile_q3', 'support', 'mobile', ARRAY['upload','mobile','permissões'], r_mobile,
   'Verifique as permissões de câmera e armazenamento do navegador nas configurações do seu dispositivo. Posso ajudar com mais alguma coisa?',
   'O upload não funciona no mobile', false, true, false, true),

  ('mobile_q4', 'support', 'mobile', ARRAY['layout','desconfigurado','chrome','safari'], r_mobile,
   'Recomendamos utilizar versões recentes do Chrome ou Safari para a melhor experiência no celular. Posso ajudar com mais alguma coisa?',
   'O layout ficou desconfigurado no celular', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: support  |  SUBCATEGORIA: pagamento
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Problemas de Pagamento — Raiz', 'support', 'pagamento',
  ARRAY['pagamento','cobrança','cartão','pix'],
  NULL,
  'Olá! Vi que você tem um problema relacionado a pagamento. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_pagamento;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('pagamento_q1', 'support', 'pagamento', ARRAY['pagamento','reprovado','dados'], r_pagamento,
   'Verifique os dados informados e tente novamente. Caso o problema persista, entre em contato com a operadora do cartão. Posso ajudar com mais alguma coisa?',
   'Meu pagamento não foi aprovado', false, true, false, true),

  ('pagamento_q2', 'support', 'pagamento', ARRAY['cobrado','plano','ativação'], r_pagamento,
   'Aguarde alguns minutos pois a ativação pode levar um tempo. Caso persista após 30 minutos, abra um ticket com o comprovante de pagamento.',
   'O pagamento foi cobrado mas o plano não ativou', false, true, true, true),

  ('pagamento_q3', 'support', 'pagamento', ARRAY['forma','pagamento','alterar'], r_pagamento,
   'Sim, dependendo da modalidade disponível em sua conta. Acesse Minha Conta > Assinatura para verificar as opções. Posso ajudar com mais alguma coisa?',
   'Posso alterar a forma de pagamento?', false, true, false, true),

  ('pagamento_q4', 'support', 'pagamento', ARRAY['duplicada','cobrança','análise'], r_pagamento,
   'Por favor, abra um ticket informando os detalhes da cobrança duplicada (data, valor e comprovante) para que nossa equipe possa analisar.',
   'Houve cobrança duplicada', false, true, true, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: conta  |  SUBCATEGORIA: email
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Alterar E-mail — Raiz', 'conta', 'email',
  ARRAY['email','e-mail','alterar','mudar'],
  NULL,
  'Olá! Vi que você tem dúvidas sobre a alteração de e-mail. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_email;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('email_q1', 'conta', 'email', ARRAY['alterar','perfil','e-mail'], r_email,
   'Acesse Minha Conta > Perfil e atualize o endereço de e-mail cadastrado. Posso ajudar com mais alguma coisa?',
   'Como alterar meu e-mail?', false, true, false, true),

  ('email_q2', 'conta', 'email', ARRAY['trocar','vinculado','outra conta'], r_email,
   'Verifique se o novo e-mail já não está vinculado a outra conta na plataforma. Caso o problema persista, entre em contato com nosso suporte.',
   'Não consigo trocar meu e-mail', false, true, true, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: conta  |  SUBCATEGORIA: assinatura
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Assinatura — Raiz', 'conta', 'assinatura',
  ARRAY['assinatura','plano','upgrade'],
  NULL,
  'Olá! Vi que você tem dúvidas sobre sua assinatura. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_assinatura;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('assinatura_q1', 'conta', 'assinatura', ARRAY['consultar','plano','conta'], r_assinatura,
   'Acesse Minha Conta > Assinatura para visualizar os detalhes do seu plano atual. Posso ajudar com mais alguma coisa?',
   'Como consultar meu plano?', false, true, false, true),

  ('assinatura_q2', 'conta', 'assinatura', ARRAY['trocar','plano','opções'], r_assinatura,
   'Sim, dependendo das opções disponíveis para sua conta. Acesse Minha Conta > Assinatura para verificar. Posso ajudar com mais alguma coisa?',
   'Posso trocar de plano?', false, true, false, true),

  ('assinatura_q3', 'conta', 'assinatura', ARRAY['venceu','renovação','expirou'], r_assinatura,
   'Verifique as opções de renovação disponíveis em Minha Conta > Assinatura. Caso precise de ajuda, nossa equipe pode auxiliar.',
   'Minha assinatura venceu', false, true, true, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: conta  |  SUBCATEGORIA: cancelamento
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Cancelamento — Raiz', 'conta', 'cancelamento',
  ARRAY['cancelar','cancelamento','encerrar'],
  NULL,
  'Olá! Vi que você tem dúvidas sobre cancelamento. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_cancelamento;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('cancelamento_q1', 'conta', 'cancelamento', ARRAY['cancelar','assinatura','como'], r_cancelamento,
   'Acesse Minha Conta > Assinatura > Cancelar assinatura e siga as instruções. Posso ajudar com mais alguma coisa?',
   'Como cancelar minha assinatura?', false, true, false, true),

  ('cancelamento_q2', 'conta', 'cancelamento', ARRAY['dados','cancelamento','privacidade'], r_cancelamento,
   'Não necessariamente. O cancelamento encerra a assinatura ativa, mas seus dados podem ser mantidos conforme nossa política de privacidade. Posso ajudar com mais alguma coisa?',
   'O cancelamento remove meus dados?', false, true, false, true),

  ('cancelamento_q3', 'conta', 'cancelamento', ARRAY['reativar','plano','disponibilidade'], r_cancelamento,
   'Sim, dependendo da disponibilidade do plano no momento da reativação. Posso ajudar com mais alguma coisa?',
   'Posso reativar minha assinatura depois?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: conta  |  SUBCATEGORIA: reembolso
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Reembolso — Raiz', 'conta', 'reembolso',
  ARRAY['reembolso','estorno','devolver'],
  NULL,
  'Olá! Vi que você tem uma solicitação de reembolso. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_reembolso;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('reembolso_q1', 'conta', 'reembolso', ARRAY['solicitar','termos','análise'], r_reembolso,
   'Algumas solicitações de reembolso podem ser analisadas conforme nossos termos de uso. Nossa equipe irá avaliar seu caso.',
   'Posso solicitar reembolso?', false, true, true, true),

  ('reembolso_q2', 'conta', 'reembolso', ARRAY['abrir','ticket','cobrança'], r_reembolso,
   'Abra um ticket contendo os detalhes da cobrança (data, valor e comprovante) e nossa equipe irá analisar o caso.',
   'Como abrir solicitação de reembolso?', false, true, true, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: conta  |  SUBCATEGORIA: lgpd
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Privacidade/LGPD — Raiz', 'conta', 'lgpd',
  ARRAY['lgpd','privacidade','dados','exclusão'],
  NULL,
  'Olá! Vi que você tem uma solicitação relacionada à privacidade ou LGPD. Selecione o problema que melhor descreve sua situação:',
  NULL, true, false, false, true
) RETURNING id INTO r_lgpd;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('lgpd_q1', 'conta', 'lgpd', ARRAY['exclusão','dados','ticket'], r_lgpd,
   'Para solicitar a exclusão dos seus dados, abra um ticket selecionando a categoria Privacidade/LGPD. Nossa equipe irá processar sua solicitação.',
   'Como solicitar exclusão dos meus dados?', false, true, true, true),

  ('lgpd_q2', 'conta', 'lgpd', ARRAY['exportação','portabilidade','canais'], r_lgpd,
   'Sim. Utilize os canais oficiais da Central de Ajuda para solicitar a exportação dos seus dados pessoais.',
   'Posso solicitar exportação dos meus dados?', false, true, true, true),

  ('lgpd_q3', 'conta', 'lgpd', ARRAY['imagens','armazenadas','política'], r_lgpd,
   'Algumas imagens podem ser armazenadas conforme a política de privacidade da plataforma. Para mais detalhes, consulte nossa Política de Privacidade ou abra um ticket.',
   'Minhas imagens são armazenadas?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: feedback  |  SUBCATEGORIA: funcionalidade
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Nova Funcionalidade — Raiz', 'feedback', 'funcionalidade',
  ARRAY['novo','funcionalidade','recurso','feature'],
  NULL,
  'Olá! Que ótimo que você quer sugerir novas funcionalidades! Selecione o que melhor descreve sua sugestão:',
  NULL, true, false, false, true
) RETURNING id INTO r_funcionalidade;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('funcionalidade_q1', 'feedback', 'funcionalidade', ARRAY['sugerir','central','ajuda'], r_funcionalidade,
   'Utilize a categoria Sugestões na Central de Ajuda para enviar sua ideia. Sua sugestão será registrada e analisada pela equipe. Obrigado pelo feedback!',
   'Como sugerir uma nova funcionalidade?', false, true, false, true),

  ('funcionalidade_q2', 'feedback', 'funcionalidade', ARRAY['operações','sugerir','equipe'], r_funcionalidade,
   'Sim! Todas as sugestões de novas operações são analisadas pela equipe de produto. Registre sua ideia e ela será avaliada. Obrigado pela contribuição!',
   'Posso sugerir novas operações?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: feedback  |  SUBCATEGORIA: ux
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Melhorias UX — Raiz', 'feedback', 'ux',
  ARRAY['ux','interface','usabilidade','experiência'],
  NULL,
  'Olá! Seu feedback sobre a interface é muito valioso. Selecione o que melhor descreve sua sugestão:',
  NULL, true, false, false, true
) RETURNING id INTO r_ux;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('ux_q1', 'feedback', 'ux', ARRAY['interface','sugerir','feedback'], r_ux,
   'Sim! Seu feedback sobre a interface é muito importante para evolução da plataforma. Registre sua sugestão e ela será analisada. Obrigado!',
   'Posso sugerir melhorias na interface?', false, true, false, true),

  ('ux_q2', 'feedback', 'ux', ARRAY['dificuldade','uso','relatar'], r_ux,
   'Abra uma sugestão descrevendo sua experiência com a plataforma. Quanto mais detalhes você fornecer, melhor poderemos entender e resolver o problema. Obrigado!',
   'Como relatar dificuldade de uso?', false, true, false, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: feedback  |  SUBCATEGORIA: bug_percebido
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Bugs Percebidos — Raiz', 'feedback', 'bug_percebido',
  ARRAY['bug','problema','falha','erro percebido'],
  NULL,
  'Olá! Obrigado por reportar um bug. Selecione o que melhor descreve o problema:',
  NULL, true, false, false, true
) RETURNING id INTO r_bug_percebido;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('bug_q1', 'feedback', 'bug_percebido', ARRAY['bug','ticket','capturas'], r_bug_percebido,
   'Abra um ticket descrevendo o problema encontrado e, se possível, envie capturas de tela. Nossa equipe irá analisar e corrigir.',
   'Encontrei um bug. O que devo fazer?', false, true, true, true),

  ('bug_q2', 'feedback', 'bug_percebido', ARRAY['recorrente','dispositivo','navegador'], r_bug_percebido,
   'Informe detalhes do dispositivo, navegador utilizado e o comportamento observado. Quanto mais informações, mais rápido conseguimos identificar e corrigir.',
   'Como relatar falhas recorrentes?', false, true, true, true);

-- ═════════════════════════════════════════════════════════════════════════════
-- CATEGORIA: feedback  |  SUBCATEGORIA: feedback_geral
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES (
  'Feedback Geral — Raiz', 'feedback', 'feedback_geral',
  ARRAY['feedback','opinião','sugestão','melhoria'],
  NULL,
  'Olá! Ficamos felizes em receber seu feedback. Selecione o que melhor descreve sua mensagem:',
  NULL, true, false, false, true
) RETURNING id INTO r_feedback_geral;

INSERT INTO public.chatbot_flows
  (name, category, subcategory, tags, parent_id, bot_message, option_label,
   is_root, is_terminal, escalate_to_human, is_published)
VALUES
  ('feedback_q1', 'feedback', 'feedback_geral', ARRAY['opiniões','melhoria','plataforma'], r_feedback_geral,
   'Sim! Feedbacks e opiniões ajudam a melhorar continuamente o SaaS Foundation. Agradecemos sua contribuição!',
   'Posso enviar opiniões sobre a plataforma?', false, true, false, true),

  ('feedback_q2', 'feedback', 'feedback_geral', ARRAY['sugestão','avaliação','interna'], r_feedback_geral,
   'Sim. Todas as sugestões passam por avaliação interna pela equipe de produto. Obrigado por contribuir com a evolução da plataforma!',
   'Minha sugestão será analisada?', false, true, false, true);

END $$;
