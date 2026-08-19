-- =============================================================================
-- 20260819000009 — Column metadata, so a harness can attempt a real insert
-- =============================================================================
-- `list_public_columns()` (20260819000008) returns names, which is enough to
-- compare against database.types.ts. It is not enough to answer the harder
-- question: **can the app actually insert a row into this table?**
--
-- That question found a real defect on 2026-08-19 and only by hand.
-- `price_observations.supplier_id` was NOT NULL with no default while the
-- writer never set it, so every batch insert would have failed 23502 even
-- after nine missing columns were added. Nothing would have caught it but
-- someone reading the writer next to the schema.
--
-- To probe an insert a harness needs, per column: is it NOT NULL, does it have
-- a default (so the caller may omit it), and what type is it (so a plausible
-- value can be generated). That is what this returns. Still metadata only — no
-- row data, no anon grant.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_public_column_meta()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(jsonb_object_agg(t.table_name, t.cols), '{}'::jsonb)
  FROM (
    SELECT c.table_name,
           jsonb_agg(
             jsonb_build_object(
               'name',        c.column_name,
               'type',        c.data_type,
               'udt',         c.udt_name,
               'nullable',    (c.is_nullable = 'YES'),
               -- A column the caller may omit: it has a DEFAULT, or the
               -- database fills it (identity/generated).
               'has_default', (c.column_default IS NOT NULL
                               OR c.is_identity = 'YES'
                               OR c.is_generated <> 'NEVER')
             ) ORDER BY c.ordinal_position
           ) AS cols
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema
       AND tb.table_name   = c.table_name
       AND tb.table_type   = 'BASE TABLE'
     WHERE c.table_schema = 'public'
     GROUP BY c.table_name
  ) t;
$$;

REVOKE ALL ON FUNCTION public.list_public_column_meta() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_public_column_meta() TO authenticated, service_role;

COMMENT ON FUNCTION public.list_public_column_meta() IS
  'Per-column name/type/nullable/has_default for base tables in public. Exists so scripts/insertability.mjs can attempt a real insert and find NOT NULL columns no writer sets. Metadata only; not anon-callable.';
