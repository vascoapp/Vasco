-- =============================================================================
-- Subscriptions — tier + billing cycle + status per user
-- =============================================================================
-- Source of truth for what a user is entitled to. Written by onboarding,
-- read by feature-gate logic in the app, updated by payment webhooks (future)
-- when the subscription is created/renewed/cancelled via Mollie or Stripe.
-- =============================================================================

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('free', 'advanced', 'pro', 'contractor')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  external_id text,                  -- Mollie/Stripe subscription id, set by webhook
  external_provider text check (external_provider in ('mollie', 'stripe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_tier_idx on public.subscriptions (tier);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
create index if not exists subscriptions_external_idx on public.subscriptions (external_id);

alter table public.subscriptions enable row level security;

create policy "users read their own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

create policy "users insert their own subscription on signup"
  on public.subscriptions
  for insert
  with check (auth.uid() = user_id);

create policy "users update their own subscription (trial/cycle changes)"
  on public.subscriptions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role (webhooks) can write anything
create policy "service role writes"
  on public.subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_subscriptions_updated_at();
