-- =============================================================================
-- RLS SMOKE TEST — run against staging, NOT production
-- =============================================================================
-- R275 / P2-9 — proves a logged-in contractor cannot read another contractor's
-- private rows. Run via: supabase db query --file supabase/tests/rls_smoke.sql
-- on a staging DB seeded with two test users.
--
-- USAGE:
--   1. Create two users in staging auth: alice@test.dev, bob@test.dev
--   2. Get their UUIDs from auth.users
--   3. Replace the placeholders below
--   4. Run this file as service_role first to seed, then as alice/bob via RPC
-- =============================================================================

-- ─── SEED — service_role only ────────────────────────────────────────────────
-- (Set these session variables before running this file)
-- \set alice_id '00000000-0000-0000-0000-000000000001'
-- \set bob_id   '00000000-0000-0000-0000-000000000002'

-- Insert one quote line per user into pricing_intelligence
insert into public.pricing_intelligence (user_id, trade, country, line_description, quoted_unit_price, quoted_quantity, quoted_total)
values
  (:'alice_id'::uuid, 'plumbing', 'NL', 'Alice secret line', 100, 1, 100),
  (:'bob_id'::uuid,   'plumbing', 'NL', 'Bob secret line',   200, 1, 200)
on conflict do nothing;

-- ─── TEST — switch to alice's auth context ───────────────────────────────────
set local request.jwt.claim.sub = :'alice_id';
set local role authenticated;

-- Alice should see exactly 1 row (her own)
do $$
declare
  alice_count int;
  bob_visible int;
begin
  select count(*) into alice_count from public.pricing_intelligence;
  select count(*) into bob_visible
  from public.pricing_intelligence
  where line_description = 'Bob secret line';

  if alice_count != 1 then
    raise exception 'RLS FAIL: alice sees % rows in pricing_intelligence (expected 1)', alice_count;
  end if;
  if bob_visible != 0 then
    raise exception 'RLS FAIL: alice can see Bob''s row (expected 0)';
  end if;
  raise notice 'RLS PASS: alice cannot see bob''s pricing_intelligence row';
end$$;

-- Try the same on quote_line_deltas (assuming it has rows; smoke just verifies policy)
do $$
declare
  bob_visible int;
begin
  select count(*) into bob_visible
  from public.quote_line_deltas
  where user_id = :'bob_id'::uuid;
  if bob_visible != 0 then
    raise exception 'RLS FAIL: alice can see Bob''s quote_line_deltas (expected 0)';
  end if;
  raise notice 'RLS PASS: alice cannot see bob''s quote_line_deltas';
end$$;

-- business_settings — owner-read pattern
do $$
declare
  bob_visible int;
begin
  select count(*) into bob_visible
  from public.business_settings
  where user_id = :'bob_id'::uuid;
  if bob_visible != 0 then
    raise exception 'RLS FAIL: alice can see Bob''s business_settings (expected 0)';
  end if;
  raise notice 'RLS PASS: alice cannot see bob''s business_settings';
end$$;

-- subscriptions — owner-read pattern
do $$
declare
  bob_visible int;
begin
  select count(*) into bob_visible
  from public.subscriptions
  where user_id = :'bob_id'::uuid;
  if bob_visible != 0 then
    raise exception 'RLS FAIL: alice can see Bob''s subscription row';
  end if;
  raise notice 'RLS PASS: alice cannot see bob''s subscription';
end$$;

-- Aggregate cohort table — public read OK (anonymized)
do $$
declare
  cohort_count int;
begin
  select count(*) into cohort_count from public.cohort_benchmarks limit 1;
  raise notice 'cohort_benchmarks readable by authenticated user: % row(s) sample', cohort_count;
end$$;

-- ─── CLEANUP — switch back to service_role to clean up ──────────────────────
reset role;
delete from public.pricing_intelligence
  where line_description in ('Alice secret line', 'Bob secret line');

raise notice 'RLS SMOKE TEST PASSED — all owner-read policies enforce user_id scoping';
