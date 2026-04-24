-- =============================================================================
-- R233 — CREDIT-BALANCE PRIMITIVES
-- =============================================================================
-- Two RPCs on the subscription_credits table (created in R232):
--   - get_credits_summary — cheap read for UI (total + redeemed + available)
--   - consume_subscription_credits — atomic FIFO consume for billing hook
--
-- The consume RPC is idempotent-ish via `update … where redeemed_at is null
-- limit N`. Callers can retry after a partial failure; rows already flipped
-- stay flipped, so double-billing is impossible even under race.
--
-- No schema changes — both RPCs are CREATE OR REPLACE.
-- =============================================================================

create or replace function public.get_credits_summary(p_user_id uuid)
returns table (
  total_months int,
  redeemed_months int,
  available_months int
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(sum(months_free), 0)::int                                         as total_months,
    coalesce(sum(months_free) filter (where redeemed_at is not null), 0)::int  as redeemed_months,
    coalesce(sum(months_free) filter (where redeemed_at is null), 0)::int      as available_months
  from public.subscription_credits
  where user_id = p_user_id;
$$;

grant execute on function public.get_credits_summary(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- consume_subscription_credits — FIFO atomic consume for billing hook
-- ---------------------------------------------------------------------------
-- Flips up to `p_max_months` oldest unredeemed credits to `redeemed_at=now()`.
-- Returns rows actually consumed so the billing caller knows how many months
-- to defer the next renewal by. CTE + FOR UPDATE SKIP LOCKED so concurrent
-- invocations don't double-claim.

create or replace function public.consume_subscription_credits(
  p_user_id uuid,
  p_max_months int default 12
)
returns table (
  consumed_id uuid,
  months_free int,
  source_type text,
  source_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picks as (
    select id
    from public.subscription_credits
    where user_id = p_user_id
      and redeemed_at is null
    order by granted_at asc
    limit greatest(p_max_months, 0)
    for update skip locked
  )
  update public.subscription_credits c
  set redeemed_at = now()
  from picks
  where c.id = picks.id
  returning c.id, c.months_free, c.source_type, c.source_id;
end;
$$;

grant execute on function public.consume_subscription_credits(uuid, int) to service_role;
