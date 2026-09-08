-- ============================================================
-- LGPD: adiciona 'grant_consent' aos tipos de solicitação LGPD.
-- Usado quando o titular reativa um consentimento previamente revogado.
-- LGPD Art. 8 §5º: o consentimento pode ser revogado a qualquer momento
-- e, de modo simétrico, pode ser concedido novamente.
-- ============================================================

ALTER TABLE public.support_tickets
    DROP CONSTRAINT IF EXISTS support_tickets_lgpd_type_check;

ALTER TABLE public.support_tickets
    ADD CONSTRAINT support_tickets_lgpd_type_check
    CHECK (lgpd_type IS NULL OR lgpd_type IN (
        'data_access',
        'data_portability',
        'revoke_consent',
        'data_delete',
        'grant_consent'
    ));
