-- =============================================================================
-- DOCUMENTS PAYMENT COLUMNS (R305)
-- =============================================================================
-- LAUNCH-BLOCKING fix. Both `mollie-webhook` and `stripe-webhook` edge fns
-- were trying to UPDATE `public.invoices` — a table that doesn't exist in
-- v1.0+ (invoices live as `documents` rows with `doc_type='invoice'`).
-- Every successful payment silently failed to mark the invoice paid:
-- customer paid → webhook ran → DB error swallowed → contractor never saw it.
--
-- The webhooks set status, paid_at, payment_id, payment_method, and
-- payment_provider. status + paid_at are already on documents; the three
-- payment_* columns are missing. Adding them here so the corrected webhook
-- (R305) can write all five.
-- =============================================================================

alter table public.documents
  add column if not exists payment_id text,
  add column if not exists payment_method text,
  add column if not exists payment_provider text check (payment_provider in ('mollie','stripe'));

comment on column public.documents.payment_id is
  'Provider-side payment id (Mollie tr_xxx or Stripe pi_xxx). Set by mollie-webhook / stripe-webhook on payment success.';
comment on column public.documents.payment_method is
  'Method used (card, ideal, sofort, sepa, etc.). Provider-defined string.';
comment on column public.documents.payment_provider is
  'mollie or stripe. Lets reporting filter by provider.';
