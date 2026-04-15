-- =============================================================================
-- Job Photos bucket + job_photos table
-- =============================================================================
-- Contractors shoot before/during/after photos. Binary lives in the
-- `job-photos` storage bucket; the DB table tracks metadata + job link.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  storage_path text not null,        -- `<user_id>/<job_id>/<uuid>.jpg`
  caption text,
  kind text default 'during' check (kind in ('before','during','after','defect','handover')),
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists job_photos_job_idx on public.job_photos (user_id, job_id, taken_at desc);

alter table public.job_photos enable row level security;

create policy "users manage their own photos"
  on public.job_photos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage RLS: only owning user can read/write their folder
create policy "job-photos read own"
  on storage.objects for select
  using (bucket_id = 'job-photos' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "job-photos write own"
  on storage.objects for insert
  with check (bucket_id = 'job-photos' and (auth.uid())::text = (storage.foldername(name))[1]);

create policy "job-photos delete own"
  on storage.objects for delete
  using (bucket_id = 'job-photos' and (auth.uid())::text = (storage.foldername(name))[1]);
