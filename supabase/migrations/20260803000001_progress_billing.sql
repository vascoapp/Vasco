-- =============================================================================
-- Progress billing (termijnfacturen) + retentie
-- =============================================================================
-- An aannemer does not invoice an EUR 80k renovation once. They bill in
-- instalments -- 30% at start, 30% at rough-in, 30% at finish, 10% at
-- oplevering -- and the customer withholds retentie (commonly 5%) until the
-- waarborgtermijn expires.
--
-- Before this, `projects.milestones` held SCHEDULE milestones only
-- ({title, weekNumber, completed, jobIds}) with no amount and no invoice link,
-- and documents had no project reference at all. An aannemer could not bill a
-- project with the app.
--
-- Additive only. Every existing project gets `billing_terms = []`, which means
-- "bill as a single invoice" -- the current behaviour, unchanged.
--
-- SCHEMA_LOCK v1.12
-- =============================================================================

-- ── projects: the instalment schedule ────────────────────────────────────────
-- Kept separate from `milestones`: a milestone is a point in the schedule, a
-- term is money. A project can have five milestones and three terms; a term
-- may reference a milestone as its trigger.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS billing_terms jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Percent of each instalment withheld until oplevering. 0 = no retention.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS retention_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_retention_percent_range;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_retention_percent_range
  CHECK (retention_percent >= 0 AND retention_percent <= 100);

-- ── documents: which project + term an invoice belongs to ────────────────────
-- New direction of travel. Projects already carried invoice ids, but nothing
-- linked an invoice back to its project, and progress billing has to walk that
-- way to answer "how much of this contract has been billed".
--
-- ON DELETE SET NULL, not CASCADE: deleting a project must never delete
-- invoices. NL Belastingdienst Art. 52 AWR requires 7-year retention.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- The ProjectBillingTerm this instalment was raised for. Text, not a FK: terms
-- live inside the projects.billing_terms JSONB array and have no table.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS billing_term_id text;

-- Retentie withheld from THIS invoice.
--
-- total_amount stays the FULL term value and VAT is charged on the full amount
-- -- retentie is withheld from payment, not deducted from the invoice. What the
-- customer pays now is (total_amount - retention_amount), derived at read time
-- so it cannot drift from the two columns it comes from. Storing a discounted
-- total instead would under-report VAT and produce an e-invoice whose total
-- disagrees with the contract.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS retention_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_retention_amount_nonneg;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_retention_amount_nonneg CHECK (retention_amount >= 0);

-- The final invoice that releases everything withheld. Withholds nothing itself.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_retention_release boolean NOT NULL DEFAULT false;

-- Progress billing always asks "which invoices belong to this project", never
-- the reverse, so index that direction. Partial: most documents are not
-- project-billed.
CREATE INDEX IF NOT EXISTS documents_project_id_idx
  ON public.documents (project_id)
  WHERE project_id IS NOT NULL;

-- No new GRANT or RLS policy needed: these are columns on existing tables and
-- inherit the row-level policies already in force. (Learnings #87: a new TABLE
-- would need an explicit GRANT; new COLUMNS do not.)
