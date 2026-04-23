-- =============================================================================
-- R229 — REFERRAL LOOP
-- =============================================================================
-- Per-user unique referral code minted lazily on first request. When a
-- new user signs up referencing a code, we record the pair. Credit
-- redemption logic (free month, cash bonus, etc.) ships in a later
-- round — this migration just wires the data model + attribution.
--
-- Schema:
--   referral_codes — one row per user, stable code value, minted on demand
--   referral_attributions — pairings (referrer, referred) with status
--
-- Credit lifecycle (future): pending → activated (referred user does
-- first monetary action) → credited (both sides receive the reward).
-- =============================================================================

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists referral_codes_code_idx
  on public.referral_codes (code);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'activated', 'credited', 'void')),
  attributed_at timestamptz not null default now(),
  activated_at timestamptz,
  credited_at timestamptz,
  -- A given new user can only be attributed once. Prevents double-credit.
  unique (referred_user_id)
);

create index if not exists referral_attrib_referrer_idx
  on public.referral_attributions (referrer_user_id, status);

alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;

-- Users read their own code.
create policy "users read their own code"
  on public.referral_codes for select
  using (auth.uid() = user_id);

-- Users read attributions where they're the referrer (to show "you've
-- referred N people"). Not where they're the referred user — that's
-- surfaced differently (e.g. in their welcome modal) without exposing
-- the referrer's identity here.
create policy "users read their own attributions"
  on public.referral_attributions for select
  using (auth.uid() = referrer_user_id);

-- No user INSERT/UPDATE/DELETE policies: mint + attribute go through
-- SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------------------
-- get_or_create_referral_code(user_id) — idempotent code mint
-- ---------------------------------------------------------------------------
-- Generates a 6-char alphanumeric code (A-Z, 2-9; no 0/O/1/I for clarity).
-- Retries up to 5× on collision. First caller for a user wins; subsequent
-- calls return the existing code.

create or replace function public.get_or_create_referral_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempt int := 0;
begin
  -- Fast path — already minted.
  select code into v_code from referral_codes where user_id = p_user_id;
  if v_code is not null then
    return v_code;
  end if;

  while v_attempt < 5 loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::int, 1);
    end loop;
    begin
      insert into referral_codes (user_id, code) values (p_user_id, v_code);
      return v_code;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
    end;
  end loop;

  raise exception 'could not mint referral code after 5 attempts';
end;
$$;

grant execute on function public.get_or_create_referral_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- attribute_referral(code, new_user_id) — called on signup
-- ---------------------------------------------------------------------------
-- Records the pairing if:
--   a) code exists
--   b) new_user_id is NOT the code owner (no self-refer)
--   c) new_user_id has never been attributed before (unique constraint)
-- Returns the attribution row or null.

create or replace function public.attribute_referral(
  p_code text,
  p_new_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_id uuid;
begin
  select user_id into v_referrer from referral_codes where code = p_code;
  if v_referrer is null then return null; end if;
  if v_referrer = p_new_user_id then return null; end if;

  begin
    insert into referral_attributions (referrer_user_id, referred_user_id, code)
    values (v_referrer, p_new_user_id, p_code)
    returning id into v_id;
    return v_id;
  exception when unique_violation then
    -- Already attributed — silently ignore.
    return null;
  end;
end;
$$;

grant execute on function public.attribute_referral(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_referral_summary(user_id) — admin-friendly per-user stats
-- ---------------------------------------------------------------------------

create or replace function public.get_referral_summary(p_user_id uuid)
returns table (
  code text,
  total_referrals int,
  pending_count int,
  activated_count int,
  credited_count int
)
language sql
security definer
set search_path = public
as $$
  select
    (select code from referral_codes where user_id = p_user_id),
    count(*)::int,
    count(*) filter (where status = 'pending')::int,
    count(*) filter (where status = 'activated')::int,
    count(*) filter (where status = 'credited')::int
  from referral_attributions
  where referrer_user_id = p_user_id;
$$;

grant execute on function public.get_referral_summary(uuid) to authenticated, service_role;
