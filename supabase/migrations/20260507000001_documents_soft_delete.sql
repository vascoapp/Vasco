-- =============================================================================
-- DOCUMENTS SOFT DELETE — R66 round 8 (2026-05-07)
-- =============================================================================
-- Belastingdienst Art. 52 AWR (NL) requires 7-year retention of invoices and
-- supporting documents. GoBD §147 HGB (DE) requires 10 years. Hard-deleting
-- invoices from `documents` violates both. Quotes (pre-acceptance) are not tax
-- records and may still be hard-deleted.
--
-- This migration:
--   1. Adds `deleted_at timestamptz` to documents (default null = active)
--   2. Updates the existing user-scoped RLS SELECT policy to filter deleted
--      rows so the FE never sees them in normal queries
--   3. Adds a partial index on (user_id, deleted_at) for fast soft-deleted
--      lookups during compliance exports
--
-- The FE soft-deletes via update; admins / compliance exports can include
-- deleted rows via service_role bypass.
-- =============================================================================

alter table public.documents
  add column if not exists deleted_at timestamptz default null;

create index if not exists documents_user_active_idx
  on public.documents (user_id, doc_type)
  where deleted_at is null;

-- Refresh SELECT policy: active rows only on the standard SELECT path. The
-- existing RLS policy from 004_base_schema.sql is `documents_select_own` and
-- only checks user_id; we add the deleted_at filter without losing the
-- ownership constraint.
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='documents' and policyname='documents_select_own') then
    drop policy documents_select_own on public.documents;
  end if;
end$$;

create policy documents_select_own
  on public.documents
  for select
  using (auth.uid() = user_id and deleted_at is null);

-- DELETE policy: keep allowing the row owner to delete (we use this only for
-- quotes; FE routes invoice deletes to soft-delete via update).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='documents' and policyname='documents_delete_own') then
    create policy documents_delete_own
      on public.documents
      for delete
      using (auth.uid() = user_id);
  end if;
end$$;

-- UPDATE policy: ensure owners can set deleted_at (covers soft-delete path).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='documents' and policyname='documents_update_own') then
    create policy documents_update_own
      on public.documents
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;
