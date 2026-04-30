-- =============================================================================
-- accounting_loops — unique constraint required by FE upsert
-- =============================================================================
-- R275 — column-level audit found `cloudSync.persistAccountingLoop` does
-- `.upsert(..., { onConflict: 'user_id,job_id' })` but no matching unique
-- constraint exists. Without this, every upsert writes a new row instead of
-- updating, bloating the table and breaking idempotency on retry.
-- =============================================================================

create unique index if not exists accounting_loops_user_job_unique_idx
  on public.accounting_loops (user_id, job_id);

-- Defensive: collapse any pre-existing duplicates by keeping only the most
-- recently updated row. Idempotent — does nothing if duplicates don't exist.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, job_id
           order by updated_at desc, id desc
         ) as rn
  from public.accounting_loops
)
delete from public.accounting_loops
  where id in (select id from ranked where rn > 1);
