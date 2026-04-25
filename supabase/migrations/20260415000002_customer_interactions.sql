-- =============================================================================
-- Customer Interactions — data moat for quote portal behavior
-- =============================================================================
-- Every customer event on the public quote portal is captured here so we can
-- build the pricing / conversion moat (which tier wins, which decisions stall,
-- how long to accept, etc.). Insert-only from the public portal.
-- =============================================================================

create table if not exists public.customer_interactions (
  id text primary key,
  quote_id text not null,
  customer_id text,
  type text not null check (type in ('view', 'tier_select', 'accept', 'reject', 'change_request', 'decision')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_interactions_quote_idx on public.customer_interactions (quote_id);
create index if not exists customer_interactions_customer_idx on public.customer_interactions (customer_id);
create index if not exists customer_interactions_type_idx on public.customer_interactions (type);
create index if not exists customer_interactions_created_idx on public.customer_interactions (created_at desc);

alter table public.customer_interactions enable row level security;

-- Public inserts allowed (the quote portal is unauthenticated — Mollie-style
-- recipient link). Contractor dashboards read only their own quotes via the
-- quotes table join.
create policy "public inserts"
  on public.customer_interactions
  for insert
  with check (true);

create policy "service role reads"
  on public.customer_interactions
  for select
  using (auth.role() = 'service_role');
