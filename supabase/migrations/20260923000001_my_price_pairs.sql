drop function if exists public.get_my_price_pairs(integer);

-- =============================================================================
-- get_my_price_pairs — latest vs previous price per supplier + material + unit
-- =============================================================================
-- The personal price watch (src/services/personalPriceWatch.ts) read the
-- contractor's newest 2,000 material_price_history rows and grouped them in
-- the app. After a second import of a large DATANORM list every one of those
-- rows came from the same day, so no group had an earlier price and the watch
-- reported nothing — the rise it exists to show was below the cut (review
-- #366). Here the database does the grouping over ALL of the contractor's
-- rows and returns one pair per group.
--
-- Same grouping as computePriceRises: supplier (id, else name), material
-- (canonical key, else lower-cased name), unit (lower-cased). One price per
-- DAY (the latest that day) — rows from one import are one observation.
--
-- SECURITY INVOKER: runs as the caller, so the existing RLS policy
-- "Users read own material prices" applies, and it filters on auth.uid()
-- explicitly as well. Returns nothing without a session.
-- =============================================================================

create or replace function public.get_my_price_pairs(p_limit integer default 500)
returns table (
  supplier_id text,
  supplier_name text,
  material_name text,
  unit text,
  previous_price numeric,
  previous_day date,
  latest_price numeric,
  latest_day date,
  total_pairs bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with obs as (
    select
      coalesce(mph.supplier_id, mph.supplier_name, '?')                        as sup,
      mph.supplier_name,
      mph.material_name,
      lower(trim(coalesce(nullif(mph.canonical_name, ''), mph.material_name))) as mat,
      lower(coalesce(mph.unit, ''))                                             as u,
      mph.price_excl_vat::numeric                                               as p,
      mph.observed_at::date                                                     as d,
      mph.observed_at
    from material_price_history mph
    where mph.observed_by = auth.uid()
      and mph.price_excl_vat > 0
      and mph.observed_at is not null
  ),
  per_day as (
    select distinct on (sup, mat, u, d)
      sup, supplier_name, material_name, mat, u, p, d
    from obs
    order by sup, mat, u, d, observed_at desc
  ),
  ranked as (
    select per_day.*, row_number() over (partition by sup, mat, u order by d desc) as rn
    from per_day
  )
  -- Biggest relative rise FIRST, so a capped result can never cut off a rise
  -- while keeping flat rows; total_pairs is counted before the LIMIT, so
  -- "materials tracked" is the true number, not the cap.
  select
    a.sup, a.supplier_name, a.material_name, a.u,
    b.p, b.d, a.p, a.d,
    count(*) over () as total_pairs
  from ranked a
  join ranked b on b.sup = a.sup and b.mat = a.mat and b.u = a.u and b.rn = 2
  where a.rn = 1
  order by (a.p - b.p) / b.p desc, a.d desc
  limit greatest(1, least(coalesce(p_limit, 500), 2000));
$$;

revoke all on function public.get_my_price_pairs(integer) from public, anon;
grant execute on function public.get_my_price_pairs(integer) to authenticated;
