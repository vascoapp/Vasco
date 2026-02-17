-- Fixpointe/Vasco schema scaffold (Supabase/Postgres)
-- Focused on MVP: documents, line items, customers, jobs, business settings, counters.

create extension if not exists pgcrypto;

create table if not exists business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text,
  kvk_number text,
  vat_number text,
  address text,
  email text,
  phone text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_counters (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null,
  current_number bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (doc_type)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('quote', 'invoice')),
  status text not null check (status in ('draft', 'sent', 'paid')),
  customer_id uuid references customers(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  source_document_id uuid references documents(id) on delete set null,
  document_number text,
  issue_date date,
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists line_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RPC: atomic invoice/quote numbering
create or replace function next_document_number(p_doc_type text)
returns text
language plpgsql
as $$
declare
  next_num bigint;
  prefix text;
begin
  if p_doc_type not in ('quote', 'invoice') then
    raise exception 'Invalid document type: %', p_doc_type;
  end if;

  insert into document_counters (doc_type, current_number)
  values (p_doc_type, 0)
  on conflict (doc_type) do nothing;

  update document_counters
  set current_number = current_number + 1,
      updated_at = now()
  where doc_type = p_doc_type
  returning current_number into next_num;

  prefix := case when p_doc_type = 'quote' then 'Q' else 'I' end;
  return prefix || lpad(next_num::text, 4, '0');
end;
$$;
