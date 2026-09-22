-- =============================================================================
-- grant_referral_credits — qualify the columns its OUT parameters shadow (#361)
-- =============================================================================
-- `RETURNS TABLE (attribution_id, referrer_user_id, referred_user_id, …)`
-- declares PL/pgSQL variables of those names. The loop's unqualified
-- `select id, referrer_user_id, referred_user_id from referral_attributions`
-- therefore raised 42702 "column reference … is ambiguous" on EVERY call —
-- with zero rows too, since the error is raised when the query is planned.
-- The daily cron has returned 500 since R232; pg_cron recorded each run as
-- succeeded, and only the #359 outcome check made it visible.
--
-- No credit was lost: referral_attributions is empty in production. The first
-- activated referral would never have been credited.
--
-- Body otherwise unchanged. Grants are carried by CREATE OR REPLACE.
-- =============================================================================

create or replace function public.grant_referral_credits()
returns table (
  attribution_id uuid,
  referrer_user_id uuid,
  referred_user_id uuid,
  credits_granted int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_granted int;
begin
  for r in
    select ra.id, ra.referrer_user_id, ra.referred_user_id
    from referral_attributions ra
    where ra.status = 'activated'
    order by ra.activated_at asc
  loop
    v_granted := 0;

    -- Referrer credit (ignore-if-exists via unique index).
    begin
      insert into subscription_credits (user_id, months_free, source_type, source_id, notes)
      values (r.referrer_user_id, 1, 'referral', r.id, 'Referrer bonus');
      v_granted := v_granted + 1;
    exception when unique_violation then
      -- already granted; idempotent retry.
      null;
    end;

    -- Referred credit (the new user gets a month too).
    begin
      insert into subscription_credits (user_id, months_free, source_type, source_id, notes)
      values (r.referred_user_id, 1, 'referral', r.id, 'Welcome bonus');
      v_granted := v_granted + 1;
    exception when unique_violation then
      null;
    end;

    update referral_attributions ra
    set status = 'credited', credited_at = now()
    where ra.id = r.id;

    attribution_id   := r.id;
    referrer_user_id := r.referrer_user_id;
    referred_user_id := r.referred_user_id;
    credits_granted  := v_granted;
    return next;
  end loop;
end;
$$;
