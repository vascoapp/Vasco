-- =============================================================================
-- import_catalog_prices — a supplier price list (DATANORM) lands on the SERVER,
-- deduplicated against the contractor's own latest price per article.
-- =============================================================================
-- The app decided what was new from a map of "the price each article was last
-- imported at", kept in AsyncStorage (sweep 2026-09-23, C4). A wholesaler list
-- is 100k+ articles ≈ 3 MB of that map, and Android's AsyncStorage TOTAL is
-- ~6 MB: a full store fails EVERY setItem, the offline queue's included. The
-- map also lived on one phone, so a second device (or a reinstall) wrote the
-- whole list again as a new day. And each article cost ~5 requests (catalogue
-- lookup + insert, price insert, an event) — 500k round trips for one list.
--
-- Now the app sends the parsed list in batches and the database, which already
-- HOLDS the prices, decides: a price row is written only when it differs from
-- the newest one this contractor has for that supplier + article. One batch is
-- one transaction — the catalogue rows and the price rows land together or not
-- at all, so "import again" is always a correct retry (no half-landed article,
-- no duplicated price row; #363/#366).
--
-- Identity: the article's canonical key (`art:<supplier>:<article>`, computed by
-- canonicalMaterialKey in the app, as for every other price row), within the
-- supplier. price_excl_vat is REAL, so prices are compared as real — comparing
-- 12.34::real with 12.34::numeric says "changed" on every import.
--
-- SECURITY INVOKER: runs as the caller under the existing RLS (catalogue rows
-- user_id = auth.uid(); price rows readable when observed_by = auth.uid()),
-- and writes only rows attributed to auth.uid(). No session → an error.
-- Live check: `npm run check:catalog-import` (throwaway user, cleaned up).
-- =============================================================================

-- The dedupe lookup: newest row per contractor + supplier + article.
create index if not exists material_price_history_own_latest_idx
  on public.material_price_history (observed_by, supplier_id, canonical_name, observed_at desc);
-- The catalogue "already there?" lookup (was a full scan per article).
create index if not exists material_catalog_user_code_idx
  on public.material_catalog (user_id, manufacturer_code);

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
        order by h.observed_at desc
        limit 1
     )
     order by b.k
    returning 1
  )
  select count(*) from prices into v_written;

  return query select v_written, v_total - v_written;
end;
$$;

revoke all on function public.import_catalog_prices(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.import_catalog_prices(text, text, text, text, text, jsonb) to authenticated;
