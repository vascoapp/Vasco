-- Job Materials: links materials to jobs with quantities, pricing, and status
-- Depends on: jobs, material_catalog, suppliers (from schema.sql + intelligence_schema.sql)

create table if not exists job_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  material_id uuid not null references material_catalog(id) on delete cascade,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'piece',
  unit_price numeric(12,2),
  total_price numeric(12,2),
  supplier_id uuid references suppliers(id) on delete set null,
  status text not null default 'planned',  -- planned | ordered | delivered | installed
  notes text,
  ordered_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_job_materials_job on job_materials(job_id);
create index if not exists idx_job_materials_material on job_materials(material_id);
create index if not exists idx_job_materials_user on job_materials(user_id);

-- Auto-update trigger (reuses set_updated_at() from schema.sql)
drop trigger if exists trg_updated_at on job_materials;
create trigger trg_updated_at before update on job_materials
  for each row execute function set_updated_at();

-- RLS
alter table job_materials enable row level security;

create policy job_materials_select on job_materials
  for select using (user_id = auth.uid());

create policy job_materials_insert on job_materials
  for insert with check (user_id = auth.uid());

create policy job_materials_update on job_materials
  for update using (user_id = auth.uid());

create policy job_materials_delete on job_materials
  for delete using (user_id = auth.uid());
