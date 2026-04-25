-- =============================================================================
-- Feature Flags — remote kill switch + gradual rollout
-- =============================================================================
-- Public read (so the app can check without auth roundtrip), service-role
-- write only. Rows are identified by a string `key` + optional `country`
-- scoping so we can disable a feature per-market without redeploying.
-- =============================================================================

create table if not exists public.feature_flags (
  key text not null,
  country text not null default 'GLOBAL',  -- 'GLOBAL' = all markets, or 'NL'/'DE'/'FR'/'ES'/'IT'/'UK'
  enabled boolean not null default false,
  rollout_percent int not null default 0 check (rollout_percent between 0 and 100),
  description text,
  updated_at timestamptz not null default now(),
  primary key (key, country)
);

alter table public.feature_flags enable row level security;

-- Anyone authenticated can read flags — needed before any feature gate
create policy "read flags"
  on public.feature_flags
  for select
  using (true);

-- Only service role writes (no client-side mutation)
create policy "service role writes"
  on public.feature_flags
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_feature_flags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_feature_flags_updated_at();

-- Seed the initial set so new installs can opt-in without a manual SQL run
insert into public.feature_flags (key, country, enabled, rollout_percent, description) values
  ('payments_mollie', 'GLOBAL', true, 100, 'Mollie payments globally'),
  ('payments_stripe_uk', 'UK', true, 100, 'Stripe payments for UK market'),
  ('eve_agent', 'GLOBAL', true, 100, 'EVE proactive AI queue'),
  ('purchasing_agent', 'GLOBAL', true, 100, 'Advanced purchasing agent (Pro tier)'),
  ('whatsapp_business', 'GLOBAL', false, 0, 'WhatsApp Business outreach'),
  ('live_tracking', 'GLOBAL', false, 0, 'GPS live tracking (requires explicit consent)')
on conflict (key, country) do nothing;
