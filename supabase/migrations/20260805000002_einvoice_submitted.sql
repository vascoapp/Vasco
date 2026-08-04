-- =============================================================================
-- documents.einvoice_submitted
-- =============================================================================
-- Invoice.einvoiceSubmitted was declared on the domain type and read by exactly
-- one filter — the EVE queue's e-invoice proposal for DE/FR/IT/ES — but written
-- by nothing anywhere, not even a fixture.
--
-- The queue proposes "submit XRechnung / Factur-X / FatturaPA / Facturae" for
-- every invoice with status 'sent' and no submission recorded. Its dedupe only
-- matches items still PENDING, so once the contractor approves and exports, the
-- item leaves pending, the flag never flips, and the same invoice is proposed
-- again on the next regeneration — repeatedly asking them to file something
-- they already filed, on a legal-compliance surface.
--
-- Timestamp rather than a boolean: "when did I file this" is the question a tax
-- authority asks, and a boolean cannot answer it.
--
-- NOTE ON SCOPE. This records that an e-invoice was GENERATED AND SHARED from
-- this device. It is deliberately not called `accepted`: for SDI (IT) and FACe
-- (ES) a submission can be rejected downstream, and a rejected FatturaPA is a
-- legal non-event. Modelling that properly is submissionLifecycle.ts, which
-- exists and is unwired. Until it is, this flag must not be read as proof of
-- acceptance.
-- =============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS einvoice_submitted TIMESTAMPTZ;

COMMENT ON COLUMN public.documents.einvoice_submitted IS
  'When an e-invoice XML was generated and shared for this invoice. NOT proof of acceptance by SDI/FACe/Peppol — see submissionLifecycle.ts.';
