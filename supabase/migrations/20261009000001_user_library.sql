-- The contractor's own library, kept in the ACCOUNT (user decision 2026-10-09).
--
-- The pricebook, the contractor's own quote templates and their job forms (and
-- the forms filled in on a job), and their certificates/insurance/licences, lived only in AsyncStorage, and logout wipes
-- AsyncStorage (sessionCleanup) — so a contractor lost their price list on
-- every logout, reinstall or new phone (UK re-walk W190). The device keeps its
-- copy for offline use; this table is where it lives.
--
-- One table, one row per item: `kind` names the library, `item_id` is the
-- app's own id, `data` the item as the app holds it. Owner-only, like every
-- contractor table; deleted with the account (FK CASCADE — the erasure worker's
-- erasureReachesEveryOwnedRow guard reads authUserFks).

create table if not exists public.user_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'pricebook_item',
    'quote_template',
    'quote_template_meta',
    'job_form_template',
    'job_form_response',
    -- Certificates, insurance policies and licences with their expiry dates
    -- (decision 3a, 2026-10-09) — the compliance store was in-memory only.
    'compliance_item'
  )),
  item_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, kind, item_id)
);

create index if not exists user_library_user_kind on public.user_library (user_id, kind);

alter table public.user_library enable row level security;

drop policy if exists user_library_owner on public.user_library;
create policy user_library_owner on public.user_library
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Stated, not inherited: the contractor reads and writes their own rows; the
-- customer (anon) has nothing here.
revoke all on public.user_library from anon;
grant select, insert, update, delete on public.user_library to authenticated;
grant all on public.user_library to service_role;
