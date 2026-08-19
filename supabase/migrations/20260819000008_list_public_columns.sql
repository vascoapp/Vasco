-- =============================================================================
-- 20260819000008 — Let the drift check see columns on an EMPTY table
-- =============================================================================
-- `scripts/schema-drift.mjs` compares every Row type in database.types.ts to
-- the real columns. It reads them from a returned row — which works only if
-- the table has a row. Every table in this project is currently empty, so the
-- first run could only check ONE of the two directions:
--
--   ✓ a Row field that is not a column  — probed per field, PostgREST 42703s
--   ✗ a column with no Row field        — unprovable without a row
--
-- The second direction is the one that hides data: a column the backend fills
-- and the FE has no field for is invisible to the app entirely. Reporting a
-- clean check while structurally unable to see half of it is worse than
-- reporting nothing (learnings #177 — "could not check" and "checked, clean"
-- must never print the same thing).
--
-- Same shape as list_public_routines (20260819000004): names only, no data, no
-- anon grant. It returns the column list of tables, which is exactly what
-- PostgREST already reveals to any authenticated caller that reads one row.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_public_columns()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    jsonb_object_agg(t.table_name, t.cols),
    '{}'::jsonb
  )
  FROM (
    SELECT c.table_name,
           jsonb_agg(c.column_name ORDER BY c.ordinal_position) AS cols
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema
       AND tb.table_name   = c.table_name
       AND tb.table_type   = 'BASE TABLE'
     WHERE c.table_schema = 'public'
     GROUP BY c.table_name
  ) t;
$$;

REVOKE ALL ON FUNCTION public.list_public_columns() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_public_columns() TO authenticated, service_role;

COMMENT ON FUNCTION public.list_public_columns() IS
  'Column names per base table in public, as {table: [col, …]}. Exists so scripts/schema-drift.mjs can check BOTH drift directions on an empty database. Names only; not anon-callable.';
