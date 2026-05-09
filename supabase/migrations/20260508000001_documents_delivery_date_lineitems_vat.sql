-- =============================================================================
-- R66 round 47 — schema closure for invoice durability + per-line VAT
-- =============================================================================
-- Two adds that closed the deferred items in the R34/R38 reports:
--
-- 1. documents.delivery_date (R34 deferred)
--    R34 derives leveringsdatum FE-side from linkedJob.completedAt at PDF
--    render time. If the linked job is later deleted (job_id FK ON DELETE
--    SET NULL on documents), the invoice archive loses the leveringsdatum
--    that was on the PDF the customer received. NL Belastingdienst Art. 35
--    requires this for 7-year retention. Persisting on the document row
--    means the PDF render path can read directly from documents.delivery_date
--    instead of joining jobs.
--
-- 2. line_items.vat_rate (R38 deferred)
--    R38 made TieredQuoteBuilder + recordPricingData + Moneybird export
--    honor businessProfile.vatScheme — but per-line VAT lives in-memory on
--    AutoInvoice.lineItems[].vatRate only. Mixed-rate quotes (NL plumbing
--    typically: 9% on arbeidsuren, 21% on materials) lose the per-line
--    distinction across cold start; the PDF re-derives from the exempt
--    branch but otherwise defaults to 21%. Persisting per-line preserves
--    the contractor's exact mix.
-- =============================================================================

-- 1. delivery_date on documents
alter table public.documents
  add column if not exists delivery_date date;

comment on column public.documents.delivery_date is
  'NL Belastingdienst Art. 35 lid 1.b leveringsdatum / service performance date. Set on invoice creation from linked job''s completed_at. Required on PDF when ≠ issue_date.';

-- 2. vat_rate on line_items
alter table public.line_items
  add column if not exists vat_rate numeric;

comment on column public.line_items.vat_rate is
  'Per-line VAT rate (0/9/21 for NL). Honors businessProfile.vatScheme — KOR contractors persist 0 across all lines, mixed-rate trades store per-line.';

-- Index for cohort/aggregation reads (line items grouped by VAT rate per
-- document — used by accounting export + tax-prep totals).
create index if not exists idx_line_items_doc_vat
  on public.line_items(document_id, vat_rate);
