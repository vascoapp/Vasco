-- 20261013000001 declared the pin SECURITY DEFINER, so inside it current_user
-- was the owner (postgres) for EVERY caller and the admin escape hatch let a
-- user session write extra_seats (caught by the live probe: a user set 9).
-- As SECURITY INVOKER, current_user is the caller's role ('authenticated'),
-- and only the service role / a real admin connection gets through.

create or replace function public.subscriptions_pin_extra_seats()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user in ('postgres', 'supabase_admin', 'service_role') then
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
