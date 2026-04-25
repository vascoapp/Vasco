-- ============================================================
-- Extracted Documents — ingestion pipeline persistence
-- ============================================================

create table if not exists extracted_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('pdf','camera','paste','excel','csv')),
  source_uri text,
  doc_type text not null check (doc_type in ('invoice','quote','receipt','unknown')),
  supplier_name text,
  supplier_id text,
  document_number text,
  document_date date,
  total_amount numeric(12,2),
  vat_amount numeric(12,2),
  currency text default 'EUR',
  confidence numeric(3,2),
  raw_text text,
  extracted_json jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','reviewed','imported','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_extracted_docs_user on extracted_documents(user_id);
create index idx_extracted_docs_status on extracted_documents(user_id, status);

alter table extracted_documents enable row level security;
create policy "Users see own docs" on extracted_documents
  for all using (auth.uid() = user_id);

-- ============================================================
-- Extracted Line Items
-- ============================================================

create table if not exists extracted_line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references extracted_documents(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(12,2),
  total_price numeric(12,2),
  unit text,
  brand text,
  category text,
  article_number text,
  confidence numeric(3,2),
  created_at timestamptz not null default now()
);

create index idx_extracted_items_doc on extracted_line_items(document_id);
