-- =============================================================================
-- import_catalog_prices, review fixes (2026-10-01) — see 20261001000002.
-- =============================================================================
-- - The dedupe compares within the same UNIT (the price watch groups by it).
-- - Two articles sharing one canonical key: the written one is deterministic.
-- Live check: `npm run check:catalog-import`.
-- =============================================================================

create or replace function public.import_catalog_prices(
  p_supplier_id text,
  p_supplier_name text,
  p_trade text,
  p_country text,
  p_currency text,
  -- [{ "a": article number, "n": name, "u": unit, "p": price excl. VAT,
  --    "k": canonical key }]
  p_items jsonb
)
returns table (imported integer, skipped integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_written integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if coalesce(trim(p_supplier_id), '') = '' then
    raise exception 'supplier required' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(p_items);
  if v_total > 5000 then
    raise exception 'batch too large (% items, max 5000)', v_total using errcode = '22023';
  end if;

  -- Two imports at once (two devices, a double tap) would both see "no row
  -- yet" and both insert. One import per contractor at a time.
  perform pg_advisory_xact_lock(hashtextextended('import_catalog_prices:' || v_uid::text, 0));

  -- One statement: the valid rows (one per article — the LAST occurrence in
  -- the file wins, as the app's map did), the catalogue rows and the price
  -- rows. Invalid rows are counted as skipped.
  with batch as (
    select distinct on (x.a) x.a, left(x.n, 200) as n, nullif(trim(x.u), '') as u, x.p::real as p, x.k
      from (
        select trim(e->>'a') as a, coalesce(nullif(trim(e->>'n'), ''), trim(e->>'a')) as n,
               e->>'u' as u, (e->>'p')::numeric as p, nullif(trim(e->>'k'), '') as k, ord
          from jsonb_array_elements(p_items) with ordinality as t(e, ord)
         where jsonb_typeof(e) = 'object'
           and coalesce(trim(e->>'a'), '') <> ''
           and (e->>'p') ~ '^[0-9]+(\.[0-9]+)?$'
      ) x
     where x.p > 0 and x.k is not null
     order by x.a, x.ord desc
  ),
  -- The material picker's rows: once per article code. (A data-modifying
  -- CTE runs to completion whether or not it is referenced.)
  cat as (
    insert into material_catalog (user_id, name, manufacturer_code, base_unit, category)
    select v_uid, b.n, b.a, coalesce(b.u, 'piece'), coalesce(nullif(p_trade, ''), 'general')
      from batch b
     where not exists (
       select 1 from material_catalog m where m.user_id = v_uid and m.manufacturer_code = b.a
     )
    returning 1
  ),
  -- A price row only where it differs from this contractor's newest one.
  prices as (
    insert into material_price_history (
      observed_by, supplier_id, supplier_name, material_name, canonical_name,
      unit, price_excl_vat, currency, vat_rate, trade, country, source, observed_at
    )
    -- One per canonical key: two codes can share one ('ABC' / 'abc', or a
    -- code too short to be an identity, keyed by its text).
    select distinct on (b.k)
           v_uid, p_supplier_id, coalesce(nullif(p_supplier_name, ''), p_supplier_id), b.n, b.k,
           coalesce(b.u, 'piece'), b.p, coalesce(nullif(p_currency, ''), 'EUR'), null,
           coalesce(nullif(p_trade, ''), 'general'), coalesce(nullif(p_country, ''), 'NL'),
           'catalog', now()
      from batch b
     where b.p is distinct from (
       select h.price_excl_vat from material_price_history h
        where h.observed_by = v_uid and h.supplier_id = p_supplier_id and h.canonical_name = b.k
          -- Same unit too: the price watch groups by it, so a list that moves
          -- an article from m to Stk at the same price is a new observation.
          and lower(coalesce(h.unit, '')) = lower(coalesce(b.u, 'piece'))
        order by h.observed_at desc
        limit 1
     )
     -- Deterministic: two codes sharing a key would otherwise flip between
     -- imports and show the watch a price change that never happened.
     order by b.k, b.a
    returning 1
  )
  select count(*) from prices into v_written;

  return query select v_written, v_total - v_written;
end;
$$;

revoke all on function public.import_catalog_prices(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.import_catalog_prices(text, text, text, text, text, jsonb) to authenticated;
