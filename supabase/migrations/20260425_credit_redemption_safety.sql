-- =============================================================================
-- Credit redemption safety primitives (R235)
-- =============================================================================
-- Two pieces required before billing webhooks can safely redeem credits:
--   1. webhook_idempotency table  — prevents double-consumption on retries
--   2. restore_subscription_credits  — un-consumes if a downstream step fails
-- =============================================================================

-- 1. Webhook idempotency ----------------------------------------------------

create table if not exists public.webhook_idempotency (
  provider     text        not null,
  event_id     text        not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table public.webhook_idempotency enable row level security;

-- Service-role only — webhooks run with service_role; clients must never read this.
revoke all on public.webhook_idempotency from anon, authenticated;
grant  all on public.webhook_idempotency to   service_role;

-- 2. Restore (undo a consumption) ------------------------------------------
-- Takes the consumed_id values returned by consume_subscription_credits and
-- nulls out their redeemed_at. Idempotent — restoring an already-active row
-- is a no-op. Service-role only.

create or replace function public.restore_subscription_credits(
  p_consumed_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.subscription_credits
     set redeemed_at = null
   where id = any(p_consumed_ids)
     and redeemed_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.restore_subscription_credits(uuid[]) from public, anon, authenticated;
grant  execute on function public.restore_subscription_credits(uuid[]) to service_role;

comment on function public.restore_subscription_credits(uuid[]) is
  'Un-redeem credits previously consumed via consume_subscription_credits. '
  'Used by billing webhooks when a downstream step (Stripe coupon apply, etc.) '
  'fails after the consume RPC succeeded. Returns count of rows restored.';
