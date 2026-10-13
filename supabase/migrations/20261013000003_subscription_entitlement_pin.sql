-- A user session could upsert its own subscriptions row with tier='contractor'
-- (RLS lets the owner insert/update it — the in-app trial needs that), so
-- anyone with the API could make themselves Pro for free. This trigger keeps
-- the two things the app legitimately does and refuses the rest:
--   • START A TRIAL: insert tier 'pro' + status 'trialing' with a trial end no
--     more than 31 days out (TRIAL_DAYS = 30 in subscriptionService).
--   • MOVE DOWN: an expired trial is written back as tier 'free'.
-- Everything else about entitlement — a paid tier, a longer trial, the period
-- end, the Stripe/Mollie ids, the billing cycle — is the server's (service
-- role: the payment webhooks). A row a payment provider owns is not touched by
-- a user session at all, so a stale device can't downgrade a paying customer.
-- SECURITY INVOKER on purpose: as DEFINER, current_user is the owner for every
-- caller (the extra_seats pin shipped that way first; learnings #422).

create or replace function public.subscriptions_pin_entitlement()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  max_trial timestamptz := now() + interval '31 days';
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  -- The server's columns, never the client's.
  new.external_id := case when tg_op = 'INSERT' then null else old.external_id end;
  new.external_provider := case when tg_op = 'INSERT' then null else old.external_provider end;
  new.current_period_ends_at := case when tg_op = 'INSERT' then null else old.current_period_ends_at end;

  if tg_op = 'INSERT' then
    if new.tier = 'pro' and new.status = 'trialing' and new.trial_ends_at is not null then
      new.trial_ends_at := least(new.trial_ends_at, max_trial);
    else
      new.tier := 'free';
      new.status := 'active';
      new.trial_ends_at := null;
    end if;
    new.billing_cycle := 'monthly';
    return new;
  end if;

  -- UPDATE. A row a payment provider manages is the provider's.
  if old.external_id is not null then
    new.tier := old.tier;
    new.status := old.status;
    new.billing_cycle := old.billing_cycle;
    new.trial_ends_at := old.trial_ends_at;
    return new;
  end if;

  -- No provider: only a move DOWN to free is the client's to make.
  if new.tier is distinct from old.tier and new.tier <> 'free' then
    new.tier := old.tier;
  end if;
  if new.tier = 'free' then
    new.status := 'active';
    new.trial_ends_at := null;
  else
    new.status := old.status;
    -- A trial may end early, never later.
    if new.trial_ends_at is null or old.trial_ends_at is null
       or new.trial_ends_at > old.trial_ends_at then
      new.trial_ends_at := old.trial_ends_at;
    end if;
  end if;
  new.billing_cycle := old.billing_cycle;
  return new;
end;
$$;

revoke all on function public.subscriptions_pin_entitlement() from public, anon, authenticated;

drop trigger if exists subscriptions_pin_entitlement on public.subscriptions;
create trigger subscriptions_pin_entitlement
  before insert or update on public.subscriptions
  for each row execute function public.subscriptions_pin_entitlement();
