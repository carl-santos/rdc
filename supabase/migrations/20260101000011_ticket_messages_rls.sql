-- RLS para ticket_messages
-- Problema: chatbot tenta fazer INSERT direto pelo cliente React (sem Edge Function)
-- e o usuário dono do ticket precisa poder inserir mensagens no seu próprio ticket.

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Leitura: dono do ticket, staff do tenant, platform_admin
DO $$ BEGIN
    CREATE POLICY "ticket_messages_select_owner"
        ON public.ticket_messages FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.support_tickets st
                WHERE st.id = ticket_messages.ticket_id
                  AND st.user_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "ticket_messages_select_tenant_staff"
        ON public.ticket_messages FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.support_tickets st
                JOIN public.profiles p ON p.id = auth.uid()
                WHERE st.id = ticket_messages.ticket_id
                  AND st.tenant_id = p.tenant_id
                  AND p.role IN ('tenant_admin', 'collaborator')
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "ticket_messages_select_platform_admin"
        ON public.ticket_messages FOR SELECT TO authenticated
        USING (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Inserção: dono do ticket pode inserir (mensagens do usuário e do bot via widget)
DO $$ BEGIN
    CREATE POLICY "ticket_messages_insert_owner"
        ON public.ticket_messages FOR INSERT TO authenticated
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.support_tickets st
                WHERE st.id = ticket_messages.ticket_id
                  AND st.user_id = auth.uid()
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Inserção: staff do tenant pode inserir (respostas de suporte)
DO $$ BEGIN
    CREATE POLICY "ticket_messages_insert_tenant_staff"
        ON public.ticket_messages FOR INSERT TO authenticated
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.support_tickets st
                JOIN public.profiles p ON p.id = auth.uid()
                WHERE st.id = ticket_messages.ticket_id
                  AND st.tenant_id = p.tenant_id
                  AND p.role IN ('tenant_admin', 'collaborator')
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Inserção: platform_admin sempre pode
DO $$ BEGIN
    CREATE POLICY "ticket_messages_insert_platform_admin"
        ON public.ticket_messages FOR INSERT TO authenticated
        WITH CHECK (public.is_platform_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
