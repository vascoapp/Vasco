-- Intelligence Layer: Supabase persistence for Vasco's agentic moat
-- Tables: data_events, entities, entity_relationships, feedback_weights,
--         calibration_entries, training_examples, model_predictions,
--         price_observations, material_catalog, suppliers

-- ============================================================
-- 1. Data Events (core event stream)
-- ============================================================

create table if not exists data_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  session_id text,
  context jsonb not null default '{}',
  payload jsonb not null default '{}',
  entities jsonb not null default '[]',
  outcome jsonb,
  embedding_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_data_events_user_type on data_events(user_id, event_type);
create index if not exists idx_data_events_created on data_events(user_id, created_at desc);

-- ============================================================
-- 2. Entities (knowledge graph nodes)
-- ============================================================

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  name text not null,
  aliases text[] not null default '{}',
  attributes jsonb not null default '{}',
  stats jsonb not null default '{}',
  confidence numeric(3,2) not null default 1.0,
  sources text[] not null default '{}',
  embedding_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entities_user_type on entities(user_id, entity_type);
create index if not exists idx_entities_name on entities(user_id, lower(name));

-- ============================================================
-- 3. Entity Relationships (knowledge graph edges)
-- ============================================================

create table if not exists entity_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_entity_id uuid not null references entities(id) on delete cascade,
  target_entity_id uuid not null references entities(id) on delete cascade,
  relationship_type text not null,
  strength numeric(3,2) not null default 0.5,
  attributes jsonb not null default '{}',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  occurrences int not null default 1
);

create index if not exists idx_entity_rel_source on entity_relationships(source_entity_id);
create index if not exists idx_entity_rel_target on entity_relationships(target_entity_id);

-- ============================================================
-- 4. Feedback Weights (per-user learned model weights)
-- ============================================================

create table if not exists feedback_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null,
  segment_key text not null,
  observations jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (user_id, feedback_type, segment_key)
);

create index if not exists idx_feedback_user_type on feedback_weights(user_id, feedback_type);

-- ============================================================
-- 5. Calibration Entries (prediction accuracy tracking)
-- ============================================================

create table if not exists calibration_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generator_id text not null,
  predicted_at timestamptz not null default now(),
  prediction text not null,
  predicted_value numeric,
  actual_value numeric,
  resolved_at timestamptz,
  accurate boolean,
  created_at timestamptz not null default now()
);

create index if not exists idx_calibration_user_gen on calibration_entries(user_id, generator_id);
create index if not exists idx_calibration_unresolved on calibration_entries(user_id, generator_id)
  where resolved_at is null;

-- ============================================================
-- 6. Training Examples (ML training data)
-- ============================================================

create table if not exists training_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_type text not null,
  features jsonb not null default '{}',
  target jsonb,
  actual_outcome jsonb,
  prediction_accuracy numeric,
  weight numeric not null default 1.0,
  source text not null default 'app',
  created_at timestamptz not null default now()
);

create index if not exists idx_training_model on training_examples(user_id, model_type);

-- ============================================================
-- 7. Model Predictions (prediction audit trail)
-- ============================================================

create table if not exists model_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_type text not null,
  model_version text not null,
  input jsonb not null default '{}',
  prediction jsonb,
  confidence numeric(3,2),
  explanation text[],
  event_id uuid references data_events(id) on delete set null,
  was_correct boolean,
  error_magnitude numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_predictions_model on model_predictions(user_id, model_type);

-- ============================================================
-- 8. Price Observations (material pricing data)
-- ============================================================

create table if not exists price_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null,
  material_name text not null,
  supplier_id uuid,
  supplier_name text,
  price numeric(12,2) not null,
  currency text not null default 'EUR',
  unit text not null default 'piece',
  source text not null default 'manual',
  confidence numeric(3,2) not null default 1.0,
  is_sale boolean default false,
  sale_end_date timestamptz,
  regular_price numeric(12,2),
  in_stock boolean,
  stock_level text,
  lead_time_days int,
  min_quantity numeric,
  bulk_pricing jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_price_obs_material on price_observations(user_id, material_id, observed_at desc);
create index if not exists idx_price_obs_supplier on price_observations(user_id, supplier_id);

-- ============================================================
-- 9. Material Catalog (material definitions + aliases)
-- ============================================================

create table if not exists material_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  category text not null default 'general',
  subcategory text,
  sku text,
  ean text,
  manufacturer_code text,
  base_unit text not null default 'piece',
  unit_conversions jsonb,
  aliases text[] not null default '{}',
  specifications jsonb,
  demand_pattern text not null default 'steady',
  avg_monthly_usage numeric,
  reorder_point numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_material_user_cat on material_catalog(user_id, category);
create index if not exists idx_material_name on material_catalog(user_id, lower(name));

-- ============================================================
-- 10. Suppliers
-- ============================================================

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_status text not null default 'active',
  credit_terms int,
  discount_tier text,
  reliability_score numeric default 50,
  avg_lead_time_days numeric,
  on_time_delivery_rate numeric,
  quality_score numeric,
  avg_price_vs_market numeric,
  price_consistency numeric,
  total_spend numeric(12,2) default 0,
  total_orders int default 0,
  last_order_date timestamptz,
  api_enabled boolean default false,
  catalog_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_user on suppliers(user_id);

-- ============================================================
-- 11. Auto-update triggers for new tables
-- ============================================================

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'entities','suppliers','material_catalog','feedback_weights'
  ])
  loop
    execute format(
      'drop trigger if exists trg_updated_at on %I; '
      'create trigger trg_updated_at before update on %I '
      'for each row execute function set_updated_at();',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- 12. RLS for all intelligence tables
-- ============================================================

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'data_events','entities','entity_relationships','feedback_weights',
    'calibration_entries','training_examples','model_predictions',
    'price_observations','material_catalog','suppliers'
  ])
  loop
    execute format('alter table %I enable row level security;', t);

    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for select using (user_id = auth.uid());',
      t || '_select', t, t || '_select', t
    );
    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for insert with check (user_id = auth.uid());',
      t || '_insert', t, t || '_insert', t
    );
    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for update using (user_id = auth.uid());',
      t || '_update', t, t || '_update', t
    );
    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for delete using (user_id = auth.uid());',
      t || '_delete', t, t || '_delete', t
    );
  end loop;
end;
$$;

-- ============================================================
-- 13. Materialized view: price references (computed benchmarks)
-- ============================================================

create or replace view price_references as
select
  po.user_id,
  po.material_id,
  mc.name as material_name,
  avg(po.price) filter (where po.observed_at > now() - interval '30 days') as avg_price_30d,
  avg(po.price) filter (where po.observed_at > now() - interval '90 days') as avg_price_90d,
  min(po.price) filter (where po.observed_at > now() - interval '30 days') as min_price_30d,
  max(po.price) filter (where po.observed_at > now() - interval '30 days') as max_price_30d,
  stddev(po.price) filter (where po.observed_at > now() - interval '90 days') as volatility,
  count(*) filter (where po.observed_at > now() - interval '90 days') as observation_count,
  max(po.observed_at) as last_observed_at
from price_observations po
left join material_catalog mc on mc.id = po.material_id and mc.user_id = po.user_id
group by po.user_id, po.material_id, mc.name;
