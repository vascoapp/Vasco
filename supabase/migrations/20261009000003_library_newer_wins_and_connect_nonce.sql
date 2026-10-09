-- Two review items from 2026-10-09 (decisions 1a / 2a).
--
-- 1. user_library: an OLDER write must not overwrite a newer row.
--    The app pushes each item with its edit time (data.updatedAt). Offline,
--    the push waits in the write queue and is replayed later as a plain
--    upsert — after which a phone that was offline for a day could replace an
--    edit made since on another phone. The app heals on its next sync, but the
--    account copy was wrong until then (and wrong for every other device).
--    Only the database sees the current row at write time, so the rule lives
--    here: an update whose incoming edit time is OLDER than the stored one
--    keeps the stored row. Same edit time, or no time on either side: the
--    write goes through (nothing to compare — the old behaviour).
--
-- 2. Stripe Connect: the OAuth `state` is single-use.
--    The state was signed and expired after 30 minutes but could be used any
--    number of times within them. stripe-connect now stores its nonce here and
--    stripe-connect-callback consumes it (one delete … returning): a second
--    use, a state for another user, or an expired one connects nothing.
--    Written and read by the service role ONLY — no grant to the app or anon.

-- ── 1 ──────────────────────────────────────────────────────────────────────
create or replace function public.user_library_edit_time(d jsonb)
returns timestamptz
language plpgsql
immutable
as $$
begin
  return nullif(d->>'updatedAt', '')::timestamptz;
exception when others then
  -- A malformed time is "no time": the write is not blocked on it.
  return null;
end;
$$;

create or replace function public.user_library_keep_newer()
returns trigger
language plpgsql
as $$
declare
  old_at timestamptz := public.user_library_edit_time(old.data);
  new_at timestamptz := public.user_library_edit_time(new.data);
begin
  if old_at is not null and new_at is not null and new_at < old_at then
    -- Keep the stored, newer row. Returning NULL skips this update; under
    -- `insert … on conflict do update` the statement still succeeds.
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists user_library_keep_newer on public.user_library;
create trigger user_library_keep_newer
  before update on public.user_library
  for each row
  execute function public.user_library_keep_newer();

-- ── 2 ──────────────────────────────────────────────────────────────────────
create table if not exists public.stripe_connect_states (
  nonce text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists stripe_connect_states_expires on public.stripe_connect_states (expires_at);

alter table public.stripe_connect_states enable row level security;
-- No policy: with RLS on and no policy, only the service role (which bypasses
-- RLS) can touch it — and the explicit revokes make that the grant too.
revoke all on public.stripe_connect_states from anon;
revoke all on public.stripe_connect_states from authenticated;
grant all on public.stripe_connect_states to service_role;
