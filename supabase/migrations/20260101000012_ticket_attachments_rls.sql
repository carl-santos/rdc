-- Hygiene: as 3 policies de public.ticket_attachments estavam com role=public
-- (qualquer um, inclusive anônimo). Funcionalmente eram inócuas porque o qual
-- usa auth.uid()/get_user_tenant_id() (anon retorna NULL e não passa), mas é
-- prática frágil. Recriar restritas a `authenticated`.

DROP POLICY IF EXISTS "Users can insert attachments to messages in their tenant" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Platform admin can view all ticket attachments" ON public.ticket_attachments;
DROP POLICY IF EXISTS "Users can view attachments for tickets in their tenant" ON public.ticket_attachments;

CREATE POLICY ticket_attachments_tenant_select
ON public.ticket_attachments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_attachments.ticket_id
          AND st.tenant_id = public.get_user_tenant_id()
    )
);

CREATE POLICY ticket_attachments_platform_admin_select
ON public.ticket_attachments FOR SELECT TO authenticated
USING (public.is_platform_admin());

CREATE POLICY ticket_attachments_tenant_insert
ON public.ticket_attachments FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_attachments.ticket_id
          AND st.tenant_id = public.get_user_tenant_id()
    )
    AND uploaded_by = auth.uid()
);
