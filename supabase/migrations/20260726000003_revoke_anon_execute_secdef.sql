-- =============================================================================
-- 20260726000003 — Close the anon-callable SECURITY DEFINER surface
-- =============================================================================
-- R325 part 2. Round 18 of the 2026-07 audit concluded there were "4
-- anon-executable RPCs" and verified those four. Measured against live prod on
-- 2026-07-26:
--
--     63 SECURITY DEFINER functions in public are executable by anon
--
-- The audit counted EXPLICIT grants to `anon`. It missed that PostgreSQL grants
-- EXECUTE to PUBLIC on every function by default, and `anon` is a member of
-- PUBLIC. So 59 functions nobody intended to expose were reachable with the
-- anon key — which is public by design: it ships inside the mobile bundle and
-- the web client.
--
-- Every SECURITY DEFINER function bypasses RLS. Of the 63, ELEVEN take a tenant
-- identifier as a PARAMETER and never compare it to auth.uid(), so the caller
-- chooses whose data to touch:
--
--   reads   get_credits_summary(p_user_id) · get_referral_summary(p_user_id)
--           get_contractor_calibration(p_user_id, …) · query_daily_metrics(p_user_id, …)
--           match_similar_customers(p_user_id, …)   <- customer names, PII
--   writes  consume_subscription_credits(p_user_id, …)  <- burns paid credits
--           write_training_pair(…, p_user_id, …)        <- poisons the ML moat
--           attribute_referral(p_code, p_new_user_id)
--           get_or_create_referral_code(p_user_id)
--           compute_contractor_calibration(p_user_id, …)
--           upsert_regional_preference(…, p_contractor_id)
--
-- The same shape as predict_customer_dso in 20260726000002, which was verified
-- exploitable with a live anon-key request. These are unexploitable TODAY only
-- because the tables are empty.
--
-- FIX: revoke EXECUTE from PUBLIC and anon on every SECURITY DEFINER function
-- in public, then grant it back to `authenticated` and `service_role` so the
-- app and the edge functions are unaffected. Four functions are deliberately
-- anon-callable and keep their grant — the customer portal is used by people
-- who are not logged in, and each is capability-scoped by a secret in the URL:
--
--   get_portal_by_access_code      scoped by the access code itself
--   get_customer_question_status   scoped by the tracker access token (R17)
--   write_signature_via_portal     resolves the tracker by access code + expiry
--   get_cron_health                admin cron widget; job names + timestamps
--                                  only. Documented in R18 as LOW
--                                  info-disclosure, kept until the "admin
--                                  reads with the anon key" gap is closed.
--
-- STILL OPEN after this migration — authenticated-to-authenticated IDOR. The
-- eleven functions above still trust their p_user_id argument; this migration
-- means an attacker now needs a signed-up account rather than just the public
-- anon key. Fixing it properly means an auth.uid() guard in each body (the
-- pattern applied to predict_customer_dso). Tracked; not done here because
-- rewriting eleven function bodies in the same change would make this
-- migration hard to review and hard to roll back.
--
-- Idempotent. No DDL on tables, no data change.
-- =============================================================================

do $$
declare
  fn record;
  n_revoked int := 0;
  n_kept int := 0;
  anon_ok text[] := array[
    'get_portal_by_access_code',
    'get_customer_question_status',
    'write_signature_via_portal',
    'get_cron_health'
  ];
begin
  for fn in
    select p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
     order by p.proname
  loop
    if fn.proname = any(anon_ok) then
      -- Deliberately anon-callable: make the grant EXPLICIT rather than
      -- inherited from PUBLIC, so this surface is visible in a grant query
      -- instead of hiding behind a default.
      execute format('revoke all on function public.%I(%s) from public', fn.proname, fn.args);
      execute format('grant execute on function public.%I(%s) to anon, authenticated, service_role', fn.proname, fn.args);
      n_kept := n_kept + 1;
    else
      execute format('revoke all on function public.%I(%s) from public, anon', fn.proname, fn.args);
      execute format('grant execute on function public.%I(%s) to authenticated, service_role', fn.proname, fn.args);
      n_revoked := n_revoked + 1;
    end if;
  end loop;

  raise notice 'revoked anon EXECUTE on % SECURITY DEFINER function(s); kept % deliberately anon-callable',
    n_revoked, n_kept;
end $$;

-- New functions must not silently inherit PUBLIC EXECUTE again.
alter default privileges in schema public revoke execute on functions from public;
