-- =============================================================================
-- 20261003000001 — get_my_price_reference: the caller's own price reference
-- =============================================================================
-- getPriceReference (src/lib/intelligenceDataProvider.ts) read the VIEW
-- price_references, which is owner-only on purpose (20261002000002): a view
-- runs with its owner's rights, so the RLS of price_observations does not
-- apply and the view lists every contractor's purchase prices per user_id.
-- Granting it to authenticated would leak all of them; leaving it as it is
-- meant the read failed (42501) on every call — the reference was never shown.
--
-- This function returns the SAME columns with the SAME types as the view, for
-- ONE material, for the CALLER only:
--   * SECURITY INVOKER — RLS on price_observations ("Users own prices",
--     price_observations_select: user_id = auth.uid()) and material_catalog
--     (material_catalog_select) applies;
--   * and it filters on auth.uid() explicitly as well, so a future policy
--     change cannot widen it. No session → auth.uid() is null → no rows.
-- LANGUAGE sql: no plpgsql RETURNS TABLE name shadowing (42702, #361).
-- =============================================================================

create or replace function public.get_my_price_reference(p_material_id text)
returns table (
  user_id uuid,
  material_id text,
  material_name text,
  avg_price_30d double precision,
  avg_price_90d double precision,
  min_price_30d real,
  max_price_30d real,
  volatility double precision,
  observation_count bigint,
  last_observed_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select po.user_id,
         po.material_id,
         mc.name as material_name,
         (avg(po.price) filter (where po.observed_at > now() - interval '30 days'))::double precision as avg_price_30d,
         (avg(po.price) filter (where po.observed_at > now() - interval '90 days'))::double precision as avg_price_90d,
         (min(po.price) filter (where po.observed_at > now() - interval '30 days'))::real as min_price_30d,
         (max(po.price) filter (where po.observed_at > now() - interval '30 days'))::real as max_price_30d,
         (stddev(po.price) filter (where po.observed_at > now() - interval '90 days'))::double precision as volatility,
         count(*) filter (where po.observed_at > now() - interval '90 days') as observation_count,
         max(po.observed_at) as last_observed_at
    from public.price_observations po
    left join public.material_catalog mc
      on mc.id::text = po.material_id and mc.user_id = po.user_id
   where po.user_id = auth.uid()
     and po.material_id = p_material_id
   group by po.user_id, po.material_id, mc.name
   limit 1
$$;

revoke all on function public.get_my_price_reference(text) from public, anon;
grant execute on function public.get_my_price_reference(text) to authenticated;
