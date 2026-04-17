-- =============================================================================
-- Affiliate click tracking — supplier backlink commission ledger
-- =============================================================================
-- Every outbound tap on a supplier affiliate URL writes a row here. Suppliers
-- post conversions back via their partner webhooks (handled elsewhere) which
-- flip `converted=true` + fill `order_value` + `commission`. The admin
-- revenue dashboard aggregates this for monthly commission reconciliation.
-- =============================================================================

create table if not exists public.affiliate_clicks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id text not null,
  supplier_name text,
  clicked_at timestamptz not null default now(),
  converted boolean not null default false,
  order_value numeric(10, 2),
  commission numeric(10, 2),
  estimated_commission numeric(10, 2),
  created_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_user_idx on public.affiliate_clicks (user_id, clicked_at desc);
create index if not exists affiliate_clicks_supplier_idx on public.affiliate_clicks (supplier_id, converted, clicked_at desc);

alter table public.affiliate_clicks enable row level security;

create policy "users read their own clicks"
  on public.affiliate_clicks for select
  using (auth.uid() = user_id);

create policy "users insert their own clicks"
  on public.affiliate_clicks for insert
  with check (auth.uid() = user_id);

-- Service role (or supplier postback worker) handles conversion flips.
-- No user UPDATE/DELETE policies — immutable audit ledger from user's view.
