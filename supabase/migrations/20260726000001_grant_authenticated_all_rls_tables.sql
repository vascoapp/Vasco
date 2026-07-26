-- =============================================================================
-- 20260726000001 — Grant table access to `authenticated` on every RLS-protected
--                  table. The app could not persist ANYTHING to the backend.
-- =============================================================================
-- R324. Generalises 20260527000003, which fixed exactly this bug for `leads`
-- and `workers` and stopped there. Its own comment explains the cause:
--
--     "In a fresh Supabase Cloud project, default privileges normally cover
--      this — but they did not propagate on this project, so every
--      authenticated client hits 'permission denied for table ...' on read."
--
-- That is true of this project's ENTIRE public schema, not of two tables.
-- Measured against prod on 2026-07-26, before this migration:
--
--     88 tables in public
--      3 with any grant to `authenticated`  (leads, workers,
--                                            material_price_benchmarks)
--     19 of the 21 tables the client actually calls -> has_table_privilege
--        (authenticated, ..., 'SELECT') = false, INSERT = false
--
-- So every PostgREST read/write from a signed-in contractor to jobs,
-- customers, documents, expenses, projects, line_items, job_materials,
-- decision_* … returned 42501 "permission denied". The app did not crash: the
-- R52/R54 offline path caught the failure and queued the write, so the UI
-- looked correct and the data lived only in AsyncStorage. It was lost on
-- reinstall, on a new device, and on any cache clear. RLS was never the
-- problem — the policies were right all along; the GRANT under them was
-- missing, and GRANT is checked BEFORE RLS.
--
-- SAFETY — why granting here does not open anything up:
-- the loop grants ONLY to tables that both (a) have RLS enabled and (b) have
-- at least one policy. A table with RLS on and no policy denies everything, so
-- skipping those keeps a "deny all" table denied rather than accidentally
-- exposing it; a table with RLS off is never touched. Row scoping is entirely
-- the policies' job and is unchanged by this migration. Verified beforehand:
-- 0 tables in public have RLS disabled.
--
-- A loop rather than 80 literal GRANT lines because the set must stay correct
-- as tables are added. NOTE for future greps: this means `grep "grant.*jobs"`
-- will NOT find the grant for `jobs` — see learnings on dynamic do-blocks
-- hiding loop-variable tables from static search.
--
-- Idempotent, no DDL, no data change.
-- =============================================================================

do $$
declare
  r record;
  n_granted int := 0;
  n_skipped_no_policy int := 0;
begin
  for r in
    select c.relname,
           (select count(*)
              from pg_policies p
             where p.schemaname = 'public'
               and p.tablename = c.relname) as policy_count
      from pg_class c
      join pg_namespace nsp on nsp.oid = c.relnamespace
     where nsp.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity = true
     order by c.relname
  loop
    if r.policy_count = 0 then
      -- RLS on + no policy = deny all. Leave it denied; granting would not
      -- expose rows, but it would hide the fact that the table has no policy.
      n_skipped_no_policy := n_skipped_no_policy + 1;
      raise notice 'SKIP (RLS on, no policy): %', r.relname;
      continue;
    end if;

    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', r.relname);
    -- Edge functions use service_role, which bypasses RLS but still needs the
    -- base grant for direct inserts (same note as 20260527000003).
    execute format('grant all on public.%I to service_role', r.relname);
    n_granted := n_granted + 1;
  end loop;

  raise notice 'granted on % table(s); skipped % policy-less table(s)',
    n_granted, n_skipped_no_policy;
end $$;

-- Sequences: PostgREST inserts into a table with a serial/identity PK need
-- USAGE on its sequence. uuid-default PKs do not, but granting is harmless and
-- avoids a second "permission denied" of a different shape later.
do $$
declare
  s record;
begin
  for s in
    select c.relname
      from pg_class c
      join pg_namespace nsp on nsp.oid = c.relnamespace
     where nsp.nspname = 'public'
       and c.relkind = 'S'
  loop
    execute format('grant usage, select on sequence public.%I to authenticated', s.relname);
    execute format('grant all on sequence public.%I to service_role', s.relname);
  end loop;
end $$;

-- Make the next table created not repeat this. Default privileges are what
-- failed to propagate on this project in the first place.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
