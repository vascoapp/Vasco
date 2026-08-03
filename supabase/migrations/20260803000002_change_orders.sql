-- =============================================================================
-- Meerwerk / minderwerk (change orders)
-- =============================================================================
-- Extra or reduced work agreed after the contract. This is where an aannemer
-- makes or loses their margin, and it is the most common source of customer
-- disputes.
--
-- LEGAL NOTE (art. 7:755 BW): a contractor may charge for meerwerk only if they
-- warned the client IN TIME that the change required a price increase. The
-- warning need not state the amount, but it must have happened -- and for
-- consumers there is an enhanced duty to explain the price and how it was
-- calculated. `warned_at` inside each change order is therefore evidence of a
-- right to payment, not workflow decoration, which is why
-- progressBillingService.canInvoiceChangeOrder refuses to bill a positive
-- order that has none.
--
-- DESIGN: change orders are billed on their OWN invoice and do NOT re-base the
-- percentage billing terms. Re-spreading them across remaining terms
-- under-bills the project: bill 30% of 80k, approve 20k of meerwerk, then bill
-- the remaining 70% of the new 100k, and you have invoiced 94k of a 100k job.
-- Keeping the schedule anchored to the original contract makes total billed
-- exactly contract + changes.
--
-- SCHEMA_LOCK v1.13
-- =============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS change_orders jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Which change order an invoice bills, when it is meerwerk rather than a
-- scheduled instalment. Text, not a FK: orders live in the projects.change_orders
-- JSONB array and have no table of their own.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS change_order_id text;

-- Negative-amount orders (minderwerk) settle as a credit; the sign lives on the
-- change order itself, so no separate column is needed here.

CREATE INDEX IF NOT EXISTS documents_change_order_id_idx
  ON public.documents (change_order_id)
  WHERE change_order_id IS NOT NULL;

-- Columns on existing tables inherit their RLS; no new GRANT needed
-- (learnings #87 applies to new TABLES, not new columns).
