-- Round 2: Wire Core Data to Supabase
-- Adds user_id to all tables, enables RLS, adds auto-updated_at trigger.

-- ============================================================
-- 0. Extensions
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- 1. Tables (idempotent create-if-not-exists)
-- ============================================================

create table if not exists business_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null,
  current_number bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, doc_type)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. Auto-update updated_at trigger
-- ============================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'business_settings','customers','jobs','documents','line_items','document_counters'
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
-- 3. RPC: atomic document numbering (scoped to user)
-- ============================================================

create or replace function next_document_number(p_doc_type text)
returns text
language plpgsql
security definer
as $$
declare
  next_num bigint;
  prefix text;
  v_user_id uuid := auth.uid();
begin
  if p_doc_type not in ('quote', 'invoice') then
    raise exception 'Invalid document type: %', p_doc_type;
  end if;

  insert into document_counters (user_id, doc_type, current_number)
  values (v_user_id, p_doc_type, 0)
  on conflict (user_id, doc_type) do nothing;

  update document_counters
  set current_number = current_number + 1,
      updated_at = now()
  where user_id = v_user_id and doc_type = p_doc_type
  returning current_number into next_num;

  prefix := case when p_doc_type = 'quote' then 'Q' else 'I' end;
  return prefix || lpad(next_num::text, 4, '0');
end;
$$;

-- ============================================================
-- 4. Row-Level Security
-- ============================================================

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'business_settings','customers','jobs','documents','line_items','document_counters'
  ])
  loop
    execute format('alter table %I enable row level security;', t);

    -- Select: own rows only
    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for select using (user_id = auth.uid());',
      t || '_select', t,
      t || '_select', t
    );

    -- Insert: must set own user_id
    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for insert with check (user_id = auth.uid());',
      t || '_insert', t,
      t || '_insert', t
    );

    -- Update: own rows only
    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for update using (user_id = auth.uid());',
      t || '_update', t,
      t || '_update', t
    );

    -- Delete: own rows only
    execute format(
      'drop policy if exists %I on %I; '
      'create policy %I on %I for delete using (user_id = auth.uid());',
      t || '_delete', t,
      t || '_delete', t
    );
  end loop;
end;
$$;
