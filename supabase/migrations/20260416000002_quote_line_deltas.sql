-- =============================================================================
-- Quote line deltas — the pricing moat learning signal
-- =============================================================================
-- Every time a contractor edits a line that was pre-filled by an AI source
-- (photo-to-quote handoff, AI scope draft, template, or cohort suggestion),
-- we capture (original, new, reason code). Aggregating these across
-- contractors feeds `regionalWasteFactor`, labour multipliers, and price
-- corrections back into future AI drafts.
--
-- Privacy: per-contractor rows are RLS-scoped. Cross-contractor aggregation
-- is derived downstream (views, edge-function jobs) and only lands in cohort
-- stats once n ≥ 30 at the (country, trade, sku) key.
-- =============================================================================

create table if not exists public.quote_line_deltas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id text,
  line_item_id text not null,
  sku text,
  description text,

  -- Original vs edited
  original_qty numeric,
  new_qty numeric,
  original_unit_price numeric,
  new_unit_price numeric,

  -- Context
  source text not null check (source in ('photo_handoff','ai_draft','template','cohort','manual')),
  trade text,
  country text,
  postcode text,

  -- The learning signal
  reason_code text check (reason_code in (
    'waste_underestimated',
    'measurement_correction',
    'labor_underestimated',
    'customer_upgrade',
    'local_supplier_cheaper',
    'site_condition_harder',
    'other'
  )),
  free_text_reason text,

  created_at timestamptz not null default now()
);

create index if not exists quote_line_deltas_user_idx on public.quote_line_deltas (user_id, created_at desc);
create index if not exists quote_line_deltas_sku_country_idx on public.quote_line_deltas (sku, country, trade) where sku is not null;

alter table public.quote_line_deltas enable row level security;

create policy "users read their own deltas"
  on public.quote_line_deltas for select
  using (auth.uid() = user_id);

create policy "users insert their own deltas"
  on public.quote_line_deltas for insert
  with check (auth.uid() = user_id);

-- Updates are only allowed to add a reason_code / free_text_reason after the fact.
-- User can't rewrite the original_qty vs new_qty delta.
create policy "users annotate their own deltas"
  on public.quote_line_deltas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
