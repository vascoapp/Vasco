-- =============================================================================
-- Scanned Invoices — supplier-receipt OCR history per user, cross-device
-- =============================================================================
-- Feeds the pricing moat. Each row is one supplier invoice / receipt scanned
-- by the contractor. Line items are stored as a single jsonb blob for
-- flexibility — richer per-line queries happen in material_price_history.
-- =============================================================================

create table if not exists public.scanned_invoices (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('invoice', 'receipt', 'delivery_note', 'quote')),
  supplier_name text,
  supplier_address text,
  supplier_vat text,
  document_number text,
  document_date date,
  subtotal numeric(12, 2),
  vat_amount numeric(12, 2),
  total numeric(12, 2),
  currency text default 'EUR',
  payment_terms text,
  confidence int,
  line_items jsonb not null default '[]'::jsonb,
  image_path text,                  -- path in `scans` storage bucket (optional)
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists scanned_invoices_user_idx on public.scanned_invoices (user_id, scanned_at desc);
create index if not exists scanned_invoices_supplier_idx on public.scanned_invoices (user_id, supplier_name);

alter table public.scanned_invoices enable row level security;

create policy "users manage their own scans"
  on public.scanned_invoices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
