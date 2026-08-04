-- =============================================================================
-- business_settings.enabled_payment_methods
-- =============================================================================
-- Third instance of the R66r24 / R83 class in this table: a field the settings
-- screen writes into AppState, that the write mapper silently dropped, so it
-- survived exactly one session and reverted on cold start.
--
-- Impact here is not cosmetic. app/(contractor)/facturen.tsx reads
-- enabledPaymentMethods to decide which payment methods a customer is offered
-- on an invoice. A contractor who turned off, say, credit card — because of the
-- fee — found it switched back on the next time they opened the app, and their
-- customers were offered it again.
--
-- JSONB array of method ids ('ideal', 'bancontact', 'credit_card', ...), to
-- match `licenses` above rather than inventing a second convention. NULL means
-- "not configured", which the app reads as "all methods the country supports" —
-- distinct from an empty array, which means the contractor turned them all off.
-- =============================================================================

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS enabled_payment_methods JSONB;

COMMENT ON COLUMN public.business_settings.enabled_payment_methods IS
  'Payment method ids offered on invoices. NULL = not configured (app defaults to all supported for the country); [] = contractor disabled all.';
