-- =============================================================================
-- Widen documents.status CHECK to accept quote lifecycle statuses
-- =============================================================================
-- BUG: FE QuoteStatus is draft|sent|accepted|rejected|expired (src/domain/
-- documents.ts) but documents.status CHECK (004_base_schema.sql) only allowed
-- draft|sent|paid. So updateDocument(quoteId, { status: 'accepted' }) — fired by
-- convertQuoteToJob and quote reject/expire flows — failed with Postgres 23514
-- every time. Caught + re-queued, but the queued write can't land either, so the
-- BE quote stayed 'sent'. On cold start the quote rehydrated as 'sent', the
-- "Convert to job" CTA reappeared, and re-converting produced a SECOND job for
-- one quote.
--
-- Fix: allow the union of quote + invoice statuses. Per MEMORY workflow rule #8,
-- drop + recreate the (auto-named) inline CHECK so the widened set takes effect.
-- =============================================================================

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'paid'));
