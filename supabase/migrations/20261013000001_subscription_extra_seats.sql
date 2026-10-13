-- Extra team members bought on top of a plan (Pro: 3 included, up to 3 more
-- at €10/mo each — user, 2026-10-13). Written ONLY by the Stripe webhook from
-- the subscription's seat line item; the app reads it into seatsPurchased.
--
-- The owner may insert/update their own subscriptions row (the in-app trial
-- needs that), so a column grant cannot protect this one: a trigger pins it
-- for every caller except the service role, so nobody can grant themselves
-- seats with their own session.

alter table public.subscriptions
  add column if not exists extra_seats integer not null default 0
    check (extra_seats >= 0 and extra_seats <= 50);

create or replace function public.subscriptions_pin_extra_seats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.extra_seats := 0;
  else
    new.extra_seats := old.extra_seats;
  end if;
  return new;
end;
$$;

revoke all on function public.subscriptions_pin_extra_seats() from public, anon, authenticated;

drop trigger if exists subscriptions_pin_extra_seats on public.subscriptions;
create trigger subscriptions_pin_extra_seats
  before insert or update on public.subscriptions
  for each row execute function public.subscriptions_pin_extra_seats();
