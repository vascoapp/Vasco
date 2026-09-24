-- =============================================================================
-- analytics_events hardening (review 2026-09-24 of 20260924000001).
--
-- 1. get_analytics_summary: service_role ONLY. It was EXECUTE for every
--    signed-in contractor — platform-wide totals to the wrong audience — while
--    the PIN-gated admin page (anon, no session) could not call it at all.
-- 2. Size limits. Only `name` was bounded: one signed-in user could insert
--    arbitrarily large `properties`, and on the free tier a full database goes
--    read-only for everyone.
-- 3. The privacy screen promises "Usage analytics: anonymized and aggregated
--    after 12 months". Nothing did it. age_analytics_events() strips the
--    identity (user, session, country, role) from events older than 12 months
--    and deletes them after 25; run daily by cron job vasco-analytics-aging.
-- =============================================================================

revoke execute on function public.get_analytics_summary(integer) from authenticated;
grant execute on function public.get_analytics_summary(integer) to service_role;

alter table public.analytics_events
  add constraint analytics_events_properties_size check (pg_column_size(properties) <= 4096),
  add constraint analytics_events_text_sizes check (
    coalesce(length(user_role), 0) <= 40 and coalesce(length(country), 0) <= 8
    and coalesce(length(session_id), 0) <= 80 and coalesce(length(platform), 0) <= 20
    and coalesce(length(platform_version), 0) <= 40 and length(id) <= 80
  );

create or replace function public.age_analytics_events()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_anon integer; v_deleted integer;
begin
  update public.analytics_events
     set user_id = null, session_id = null, country = null, user_role = null
   where "timestamp" < now() - interval '12 months'
     and (user_id is not null or session_id is not null or country is not null or user_role is not null);
  get diagnostics v_anon = row_count;
  delete from public.analytics_events where "timestamp" < now() - interval '25 months';
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('anonymised', v_anon, 'deleted', v_deleted);
end;
$$;

revoke all on function public.age_analytics_events() from public, anon, authenticated;
grant execute on function public.age_analytics_events() to service_role;
