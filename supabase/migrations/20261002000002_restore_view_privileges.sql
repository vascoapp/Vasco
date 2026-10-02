-- =============================================================================
-- 20261002000002 — the recreated views get back their ORIGINAL privileges
-- =============================================================================
-- 20261002000001 dropped and recreated price_references and
-- mv_winrate_by_amount. They had NO grants (owner only); a recreated relation
-- in `public` picks up the project's DEFAULT privileges — authenticated could
-- now SELECT/INSERT/UPDATE/DELETE them. price_references lists every
-- contractor's purchase prices per user_id, and a view runs with its OWNER's
-- rights (RLS of price_observations does not apply), so any signed-in
-- contractor could have read everyone's prices. Back to owner-only, exactly
-- as before (relacl was NULL). material_price_benchmarks keeps the grants it
-- had (authenticated arwd, service_role all) — restored in 000001 on purpose.
-- =============================================================================
revoke all on public.price_references from authenticated, service_role, anon;
revoke all on public.mv_winrate_by_amount from authenticated, service_role, anon;
