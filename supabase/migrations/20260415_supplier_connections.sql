-- =============================================================================
-- Supplier Connections — OAuth tokens per user × supplier
-- =============================================================================
-- The contractor connects a supplier account once via the OAuth PKCE flow
-- (see src/integrations/supplierOAuth.ts). The resulting access_token + refresh
-- token are persisted here and used by the `place-supplier-order` Edge
-- Function to POST a real order.
-- =============================================================================

create table if not exists public.supplier_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id text not null check (supplier_id in ('hornbach','rexel_nl','bouwmaat','technische_unie','solar_nl','bauhaus')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  account_reference text,                -- supplier-side account id if returned
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, supplier_id)
);

alter table public.supplier_connections enable row level security;

create policy "users manage their own supplier connections"
  on public.supplier_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Purchase orders table add-ons for the supplier linkage (idempotent)
do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='purchase_orders') then
    create table public.purchase_orders (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      supplier_name text,
      items jsonb not null default '[]'::jsonb,
      total numeric(12,2),
      status text not null default 'draft'
        check (status in ('draft','submitted','confirmed','delivered','cancelled')),
      external_ref text,
      external_provider text,
      submitted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    alter table public.purchase_orders enable row level security;
    create policy "users manage their own POs"
      on public.purchase_orders
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  else
    alter table public.purchase_orders
      add column if not exists external_ref text,
      add column if not exists external_provider text,
      add column if not exists submitted_at timestamptz;
  end if;
end $$;
