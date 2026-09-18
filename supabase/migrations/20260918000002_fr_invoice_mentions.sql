-- =============================================================================
-- 20260918000002 — what a French invoice must say from 1 September 2026
-- =============================================================================
-- The French e-invoicing reform adds four mentions to every invoice. Three of
-- them are DATA the app has never held, which is why this was deferred rather
-- than half-written: a partial legal block on an invoice is worse than an
-- absent one, because it looks complied-with (#339 L14).
--
--   1. the buyer's SIREN — derivable from a French TVA number (FR + 2 check
--      digits + the 9-digit SIREN), so no column: `customers.vat_id` already
--      exists and the PDF derives it.
--   2. the NATURE of the operation — livraison de biens, prestation de
--      services, or mixte. Only the contractor knows; a trade invoice is
--      commonly mixte (labour + materials) and guessing it is a statement to
--      the tax authority.
--   3. the DELIVERY address, when it differs from the billing address.
--   4. a mention when the seller has opted for TVA SUR LES DÉBITS — a fact
--      about the seller, so it belongs on business_settings.
--
-- All nullable and additive. NULL means "not stated", and the PDF omits the
-- line rather than inventing one.
alter table public.documents
  add column if not exists operation_nature text
    check (operation_nature is null or operation_nature in ('goods', 'services', 'mixed')),
  add column if not exists delivery_address text;

comment on column public.documents.operation_nature is
  'FR 2026 mention: livraison de biens (goods) / prestation de services (services) / mixte (mixed). NULL = not stated, and the PDF omits the line.';
comment on column public.documents.delivery_address is
  'FR 2026 mention: the delivery address when it differs from the buyer address. NULL = same as the buyer address.';

alter table public.business_settings
  add column if not exists tva_sur_les_debits boolean;

comment on column public.business_settings.tva_sur_les_debits is
  'FR: the seller has opted to account for VAT on debits (sur les débits). When true the invoice must say so. NULL/false = the default (encaissements for services).';
