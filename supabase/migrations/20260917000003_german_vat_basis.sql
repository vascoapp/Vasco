-- =============================================================================
-- 20260917000003 — how a German contractor actually files
-- =============================================================================
-- `GermanTaxSettings` has declared `istVersteuerung` and
-- `voranmeldungszeitraum` since the German compliance types were written, and
-- nothing ever wrote or read either: every VAT return was prepared as
-- Soll-Versteuerung (tax due when the invoice is ISSUED) and quarterly.
--
-- Both are wrong for a large share of the beachhead market. A small trade under
-- §20 UStG may account on receipts (Ist-Versteuerung) — tax falls due when the
-- customer PAYS, which for a trade that waits 45 days is a materially different
-- return — and a newly founded business commonly files MONTHLY.
--
-- Nullable and additive: NULL means "not stated", which the app reads as the
-- German default (Soll, quarterly) exactly as before.
alter table public.business_settings
  add column if not exists vat_basis text
    check (vat_basis is null or vat_basis in ('soll', 'ist')),
  add column if not exists filing_period text
    check (filing_period is null or filing_period in ('monthly', 'quarterly', 'yearly'));

comment on column public.business_settings.vat_basis is
  'When VAT falls due: soll = on invoice issue (Soll-Versteuerung, the default), ist = on payment receipt (Ist-Versteuerung, §20 UStG). NULL = not stated.';
comment on column public.business_settings.filing_period is
  'How often the VAT return is filed: monthly (common in the first two years), quarterly (default), yearly. NULL = not stated.';
