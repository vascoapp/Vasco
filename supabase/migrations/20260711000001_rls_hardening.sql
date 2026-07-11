-- ============================================================
-- RLS hardening — two tables were missing ENABLE ROW LEVEL SECURITY
-- (found by the 2026-07 RLS coverage audit). Under Supabase's broad
-- default grants to the `authenticated` role, a public-schema table with
-- RLS DISABLED is fully readable by any signed-in user regardless of owner.
-- ============================================================

-- ------------------------------------------------------------
-- 1. extracted_line_items (document-ingestion child rows)
-- ------------------------------------------------------------
-- The parent `extracted_documents` is user-scoped (auth.uid() = user_id,
-- migration 20260213000002) but the child table had NO RLS and NO policy,
-- so every authenticated user could read ALL contractors' extracted invoice
-- lines (descriptions, quantities, supplier prices) — a cross-tenant leak.
-- The client never queries this table directly (service-role ingestion
-- writes it and bypasses RLS), so scoping it via the parent's user_id is
-- non-breaking. SECURITY DEFINER / service-role writers are unaffected.
alter table extracted_line_items enable row level security;

drop policy if exists "Users see own extracted items" on extracted_line_items;
create policy "Users see own extracted items" on extracted_line_items
  for all
  using (
    exists (
      select 1
      from extracted_documents d
      where d.id = extracted_line_items.document_id
        and d.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 2. cohort_benchmarks (shared anonymized cross-contractor aggregates)
-- ------------------------------------------------------------
-- 001_intelligence_tables.sql created a `"Authenticated read"` SELECT policy
-- for this table but never ran ALTER TABLE ... ENABLE ROW LEVEL SECURITY, so
-- the policy was INERT (a policy has no effect until RLS is enabled). No PII
-- (no user_id — it holds anonymized cohort medians/percentiles), so this is
-- defense-in-depth rather than a private-data leak: enabling RLS makes the
-- existing read policy actually govern access and blocks non-service writes.
-- Reads: client reads via the authenticated key → allowed by the read policy.
-- Writes: only compute_cohort_benchmarks(), which is SECURITY DEFINER and
-- bypasses RLS. No authenticated-role writer exists, so this is non-breaking.
alter table cohort_benchmarks enable row level security;
