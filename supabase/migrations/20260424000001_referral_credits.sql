-- =============================================================================
-- R232 — REFERRAL CREDIT STATE MACHINE
-- =============================================================================
-- Two-step transition driven by business_events:
--   pending → activated  (trigger, fires on first invoice_sent by the
--                         referred user — proves genuine usage)
--   activated → credited (scheduled worker, inserts 1-month subscription
--                         credit rows for BOTH parties, flips status)
--
-- The split exists to keep a buffer between activation and actual reward
-- — if a future round adds fraud-review or refund logic, the worker is
-- the single place it hooks. For v1 the worker runs daily and grants
-- immediately; the buffer is mostly inert.
-- =============================================================================

create table if not exists public.subscription_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  months_free int not null default 1 check (months_free > 0 and months_free <= 12),
  source_type text not null default 'referral'
    check (source_type in ('referral', 'promo', 'goodwill')),
  source_id uuid,
  granted_at timestamptz not null default now(),
  redeemed_at timestamptz,
  -- The subscription renewal worker (future round) sets redeemed_at when
  -- the credit offsets a charge. Until then the credit is eligible.
  notes text
);

create index if not exists subscription_credits_user_idx
  on public.subscription_credits (user_id, redeemed_at);

-- Guard against double-granting the same attribution to the same user.
create unique index if not exists subscription_credits_ref_unique
  on public.subscription_credits (user_id, source_id)
  where source_type = 'referral' and source_id is not null;

alter table public.subscription_credits enable row level security;

create policy "users read their own credits"
  on public.subscription_credits for select
  using (auth.uid() = user_id);
-- Inserts via SECURITY DEFINER worker only.

-- ---------------------------------------------------------------------------
-- Trigger: pending → activated on first invoice_sent
-- ---------------------------------------------------------------------------
-- Fires on every business_events insert. Cheap — only does DB work when
-- the event is invoice_sent AND the user has a pending attribution.

create or replace function public.on_invoice_sent_activate_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type <> 'invoice_sent' then
    return new;
  end if;

  update public.referral_attributions
  set status = 'activated', activated_at = now()
  where referred_user_id = new.user_id
    and status = 'pending';

  return new;
end;
$$;

drop trigger if exists trg_activate_referral on public.business_events;
create trigger trg_activate_referral
after insert on public.business_events
for each row
execute function public.on_invoice_sent_activate_referral();

-- ---------------------------------------------------------------------------
-- RPC: grant_referral_credits
-- ---------------------------------------------------------------------------
-- Called by the scheduled Edge Function. Atomically flips every activated
-- attribution to credited + inserts two subscription_credits rows (one
-- for the referrer, one for the referred). Idempotent via the unique
-- index: re-running after a partial failure is safe.

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
    select id, referrer_user_id, referred_user_id
    from referral_attributions
    where status = 'activated'
    order by activated_at asc
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

    update referral_attributions
    set status = 'credited', credited_at = now()
    where id = r.id;

    attribution_id   := r.id;
    referrer_user_id := r.referrer_user_id;
    referred_user_id := r.referred_user_id;
    credits_granted  := v_granted;
    return next;
  end loop;
end;
$$;

grant execute on function public.grant_referral_credits() to service_role;
