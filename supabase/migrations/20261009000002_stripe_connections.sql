-- Stripe Connect: which Stripe account belongs to which contractor
-- (decision 2a, 2026-10-09).
--
-- The Stripe screen asked a contractor to paste their SECRET key (sk_live_…)
-- into the app, which kept it on the phone and called Stripe with it. With
-- Connect the contractor signs in at Stripe instead; Stripe hands the SERVER
-- their account id, and every call is made server-side with Vasco's platform
-- key on that account (Stripe-Account header). No secret reaches the device.
--
-- Written ONLY by the service role (stripe-connect-callback / stripe-connect
-- disconnect). The contractor may read their own row (the app shows
-- "Connected"); nobody else sees it, and the customer (anon) has nothing here.
-- The webhook reads it to check that a connected-account payment really
-- belongs to the contractor its metadata names.

create table if not exists public.stripe_connections (
  -- `id` too: the data export pages every owned table by id, and a table
  -- without one fails the read — an INCOMPLETE export blocks account deletion.
  id uuid not null unique default gen_random_uuid(),
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  livemode boolean not null default false,
  scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stripe_connections enable row level security;

drop policy if exists stripe_connections_owner_read on public.stripe_connections;
create policy stripe_connections_owner_read on public.stripe_connections
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.stripe_connections from anon;
revoke all on public.stripe_connections from authenticated;
grant select on public.stripe_connections to authenticated;
grant all on public.stripe_connections to service_role;
