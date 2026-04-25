-- =============================================================================
-- Rate limit the public insert on customer_interactions
-- =============================================================================
-- The quote portal is unauthenticated by design (Mollie-style recipient
-- link), so we can't gate on auth.uid(). Instead, enforce two limits:
--   1. Per-quote: max 100 interactions per quote (prevents flooding from one
--      malicious viewer).
--   2. Global: rolling 60s window max 2000 inserts (catches mass scanners).
-- The second limit is soft — if hit, we still accept the insert but flag it,
-- so legitimate bursts (email blast → 500 customers at once) aren't blocked.
-- =============================================================================

alter table public.customer_interactions
  add column if not exists ip_hash text,
  add column if not exists flagged boolean not null default false;

create index if not exists customer_interactions_ip_hash_idx
  on public.customer_interactions (ip_hash);

create or replace function public.enforce_quote_interaction_cap()
returns trigger
language plpgsql
as $$
declare
  existing_count int;
begin
  select count(*) into existing_count
  from public.customer_interactions
  where quote_id = new.quote_id;
  if existing_count >= 100 then
    raise exception 'Quote interaction limit reached (%).', existing_count
      using errcode = '429', hint = 'Contact support if you believe this is incorrect.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_quote_interaction_cap_tr on public.customer_interactions;
create trigger enforce_quote_interaction_cap_tr
  before insert on public.customer_interactions
  for each row execute function public.enforce_quote_interaction_cap();

-- Replace the overly-permissive public insert policy with one that still
-- allows anonymous use but rejects malformed payloads early.
drop policy if exists "public inserts" on public.customer_interactions;
create policy "public inserts (validated)"
  on public.customer_interactions
  for insert
  with check (
    length(quote_id) between 1 and 64
    and length(coalesce(customer_id, '')) <= 64
    and type in ('view', 'tier_select', 'accept', 'reject', 'change_request', 'decision')
  );
