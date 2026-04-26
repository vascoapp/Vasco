-- =============================================================================
-- Quote-content recommender (R246)
-- =============================================================================
-- Surfaces "contractors with similar quotes also added X line item Y% of the
-- time." Uses quote_line_deltas (R187 reason-coded edits) + pricing_intelligence
-- (line descriptions). K-anonymity ≥5 contractors per recommendation.
-- =============================================================================

create or replace function public.get_quote_line_recommendations(
  p_trade text,
  p_country text,
  p_existing_descriptions text[],
  p_limit int default 5
)
returns table (
  recommended_description text,
  recommended_unit_price real,
  recommendation_rate real,        -- fraction of similar quotes that include this line
  contractor_count bigint,
  sample_size bigint
)
language plpgsql security definer set search_path = public as $$
declare
  v_total_quotes bigint;
begin
  -- Count distinct quotes in this cohort
  select count(distinct quote_id) into v_total_quotes
    from public.pricing_intelligence
   where trade = p_trade
     and country = p_country
     and quoted_at > now() - interval '12 months'
     and quote_id is not null;

  if coalesce(v_total_quotes, 0) < 20 then
    return;
  end if;

  return query
  with line_descriptions as (
    select
      pi.line_description,
      pi.quoted_unit_price,
      pi.quote_id,
      pi.user_id
    from public.pricing_intelligence pi
    where pi.trade = p_trade
      and pi.country = p_country
      and pi.quoted_at > now() - interval '12 months'
      and pi.line_description is not null
      and length(pi.line_description) > 5
      -- Skip lines the contractor already has
      and not (lower(pi.line_description) = any(
        array(select lower(unnest(p_existing_descriptions)))
      ))
  ),
  aggregated as (
    select
      line_description,
      avg(quoted_unit_price)::real as avg_price,
      count(distinct quote_id)::bigint as quotes_with_line,
      count(distinct user_id)::bigint as contractors_with_line
    from line_descriptions
    group by line_description
    having count(distinct user_id) >= 5
  )
  select
    a.line_description as recommended_description,
    a.avg_price as recommended_unit_price,
    (a.quotes_with_line::real / nullif(v_total_quotes, 0)::real) as recommendation_rate,
    a.contractors_with_line as contractor_count,
    a.quotes_with_line as sample_size
  from aggregated a
  where a.quotes_with_line::real / nullif(v_total_quotes, 0)::real >= 0.10  -- ≥10% adoption
  order by a.quotes_with_line desc
  limit p_limit;
end; $$;

grant execute on function public.get_quote_line_recommendations(text, text, text[], int) to authenticated, service_role;
