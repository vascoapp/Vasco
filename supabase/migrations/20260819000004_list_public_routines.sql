-- =============================================================================
-- 20260819000004 — Let the health check see which routines actually exist
-- =============================================================================
-- endpoint-health.mjs gained a client→RPC drift check on 2026-08-19, after
-- `update_tracker_progress` turned out to have been called after every decision
-- submission for months without existing anywhere. The equivalent check for
-- edge functions had existed since 2026-08-16; RPCs simply had no way to ask.
--
-- Asking over HTTP is the problem. A no-argument POST to /rest/v1/rpc/<name>
-- returns PGRST202 whether the routine is missing or merely has a different
-- signature, so the status carries no information. The first attempt read
-- PostgREST's `hint` field as the discriminator and reported 55 phantoms —
-- including six RPCs verified working minutes before. The hint is a
-- fuzzy-similarity suggestion, not an existence signal: a name unlike anything
-- in the schema gets no hint at all, exactly like a name that exists.
--
-- So: ask the catalog. One routine, one round-trip, returns names only — no
-- signatures, no bodies, no data. NOT granted to anon: an unauthenticated
-- caller has no reason to enumerate the schema, and the anon surface this
-- harness checks is a short hand-written list anyway.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_public_routines()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(DISTINCT p.proname ORDER BY p.proname), ARRAY[]::text[])
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public';
$$;

REVOKE ALL ON FUNCTION public.list_public_routines() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_public_routines() TO authenticated, service_role;

COMMENT ON FUNCTION public.list_public_routines() IS
  'Names of routines in the public schema. Exists so endpoint-health.mjs can check client→RPC drift exactly instead of inferring it from PostgREST error hints. Names only; not anon-callable.';
