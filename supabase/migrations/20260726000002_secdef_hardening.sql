-- =============================================================================
-- 20260726000002 — SECURITY DEFINER hardening: an anon-reachable cross-tenant
--                  read, an anon-writable aggregate, and the escalation
--                  precondition under both.
-- =============================================================================
-- R325. Found by re-grading the 2026-07 audit against LIVE prod instead of the
-- migration files — the same method that found R324. R18 pinned search_path on
-- `next_document_number` and stopped there; two SECURITY DEFINER functions were
-- left with a mutable search_path, and one of them had a worse problem.
--
-- 1. predict_customer_dso — 🔴 CROSS-TENANT READ, reachable with the PUBLIC
--    anon key. SECURITY DEFINER (so RLS is bypassed) filtering on a
--    CALLER-SUPPLIED p_user_id, with EXECUTE available to anon by default:
--
--      curl -X POST .../rpc/predict_customer_dso -H "apikey: <anon>" \
--        -d '{"p_user_id":"<any uuid>","p_customer_id":"any"}'   -> HTTP 200
--
--    Verified live on 2026-07-26. It returned defaults only because
--    customer_payment_patterns is empty; with data it hands any caller another
--    contractor's per-customer payment behaviour (avg days to pay, overdue
--    rate, sample size). A SECURITY DEFINER function must NEVER trust a
--    caller-supplied identity — it has already given up RLS. It now derives the
--    tenant from auth.uid(); the parameter is kept only so the existing client
--    call site (src/intelligence/predictions.ts, which already passes
--    userData.user.id) keeps working unchanged, and is now asserted to match.
--
-- 2. compute_cohort_benchmarks — anon could INSERT. It is an aggregation
--    routine that writes rows into cohort_benchmarks, and default PUBLIC
--    EXECUTE meant anyone with the anon key could poison the pricing moat with
--    fabricated benchmark rows. It has no business being callable from a
--    client at all: restricted to service_role (cron/edge functions).
--
-- 3. CREATE on schema public was held by anon AND authenticated
--    (nspacl: anon=UC/postgres, authenticated=UC/postgres). That is the
--    precondition that turns a mutable search_path into privilege escalation:
--    create an object that shadows an unqualified reference, then call a
--    SECURITY DEFINER function owned by postgres and it resolves to yours.
--    Postgres 15+ revokes CREATE from PUBLIC by default for exactly this
--    reason. Revoked; USAGE is retained, which is all the app roles need
--    (they never issue DDL).
--
-- Idempotent. No data change.
-- =============================================================================

-- 1. -------------------------------------------------------------------------
create or replace function public.predict_customer_dso(p_user_id uuid, p_customer_id text)
returns table(predicted_dso integer, confidence real, historical_avg real, payment_count bigint, on_time_rate real)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
begin
  -- The tenant comes from the JWT, never from the argument. Callers already
  -- pass their own id, so this is a no-op for them and a wall for everyone
  -- else. Fail closed when there is no JWT at all (anon).
  if v_uid is null then
    raise exception 'predict_customer_dso requires an authenticated session'
      using errcode = '42501';
  end if;
  if p_user_id is distinct from v_uid then
    raise exception 'predict_customer_dso: p_user_id does not match the authenticated user'
      using errcode = '42501';
  end if;

  return query
  select
    coalesce(avg(cpp.days_to_payment)::int, 14),
    case
      when count(*) >= 10 then 0.9
      when count(*) >= 5 then 0.7
      when count(*) >= 2 then 0.5
      else 0.3
    end::real,
    avg(cpp.days_to_payment)::real,
    count(*),
    (count(*) filter (where not cpp.was_overdue))::real / nullif(count(*)::real, 0)
  from customer_payment_patterns cpp
  where cpp.user_id = v_uid
    and cpp.customer_id = p_customer_id
    and cpp.payment_date is not null;
end;
$function$;

revoke all on function public.predict_customer_dso(uuid, text) from public, anon;
grant execute on function public.predict_customer_dso(uuid, text) to authenticated, service_role;

-- 2. -------------------------------------------------------------------------
alter function public.compute_cohort_benchmarks(text, text, text, text)
  set search_path = public, pg_temp;

revoke all on function public.compute_cohort_benchmarks(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.compute_cohort_benchmarks(text, text, text, text) to service_role;

-- 3. -------------------------------------------------------------------------
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
