-- =============================================================================
-- Seven RPCs that failed on EVERY call, found by probing all of them (#361)
-- =============================================================================
-- Found while running down the grant_referral_credits 500. Every PL/pgSQL
-- RETURNS TABLE function in public was called once in production inside a
-- rolled-back transaction; these raised on planning, before any argument value
-- mattered:
--
--   42702 ambiguous (an OUT column shadows a table column):
--     get_quote_win_training_data  -> weekly-retrain-models, quoteWinModelService
--     get_material_drift           -> materialDriftService
--     get_seasonal_pattern         -> seasonalityMoatService
--     get_signup_cohort_retention  -> admin retention dashboard
--     match_similar_customers      -> embeddingService
--     match_similar_materials      -> semanticSearch, AddJobMaterialModal
--   42804 result type (1 - (a <=> b) is double precision, declared real):
--     match_similar_jobs           -> embeddingService
--   ...and the two match_similar_* above carry the same 42804 behind the 42702.
--
-- Fix 1: `#variable_conflict use_column`. It changes ONLY references that are
-- ambiguous, and every such reference raised before — so it cannot alter any
-- query that worked. Each ambiguous reference was read and names the column.
-- Fix 2: `::real` on similarity.
--
-- Bodies are the LIVE definitions (pg_get_functiondef), not the migration
-- sources, so no later hand edit is reverted. CREATE OR REPLACE keeps grants.
-- =============================================================================

-- get_quote_win_training_data
CREATE OR REPLACE FUNCTION public.get_quote_win_training_data(p_trade text, p_country text, p_months integer DEFAULT 12)
 RETURNS TABLE(total_amount real, customer_type text, month_num integer, contractor_segment text, line_count integer, was_accepted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_contractor_count INT := 0;
  v_quote_count INT := 0;
BEGIN
  -- K-anonymity: count distinct contractors and quotes in the window.
  SELECT
    COUNT(DISTINCT user_id),
    COUNT(DISTINCT quote_id)
  INTO v_contractor_count, v_quote_count
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND was_accepted IS NOT NULL
    AND quoted_at > now() - (p_months || ' months')::INTERVAL
    AND quote_id IS NOT NULL;

  IF v_contractor_count < 5 OR v_quote_count < 20 THEN
    RETURN; -- empty set
  END IF;

  RETURN QUERY
  SELECT
    SUM(pi.quoted_total)::REAL                             AS total_amount,
    MIN(pi.customer_type)                                  AS customer_type,
    EXTRACT(MONTH FROM MIN(pi.quoted_at))::INT             AS month_num,
    MIN(pi.contractor_segment)                             AS contractor_segment,
    COUNT(*)::INT                                          AS line_count,
    BOOL_OR(pi.was_accepted)                               AS was_accepted
  FROM pricing_intelligence pi
  WHERE pi.trade = p_trade
    AND pi.country = p_country
    AND pi.was_accepted IS NOT NULL
    AND pi.quoted_at > now() - (p_months || ' months')::INTERVAL
    AND pi.quote_id IS NOT NULL
  GROUP BY pi.quote_id;
END;
$function$;

-- get_material_drift
CREATE OR REPLACE FUNCTION public.get_material_drift(p_trade text, p_country text, p_recent_days integer DEFAULT 30, p_baseline_days integer DEFAULT 90, p_min_drift_pct real DEFAULT 5.0)
 RETURNS TABLE(material_name text, material_category text, unit text, supplier_id text, supplier_name text, baseline_price real, recent_price real, drift_pct real, recent_sample_size bigint, baseline_sample_size bigint, recent_observer_count bigint, is_market_wide boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH baseline AS (
    SELECT
      mph.trade,
      mph.country,
      LOWER(mph.material_name)      AS material_name,
      mph.material_category,
      mph.unit,
      mph.supplier_id,
      MIN(mph.supplier_name)        AS supplier_name,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mph.price_excl_vat)::REAL
                                    AS median_price,
      COUNT(*)                      AS sample_size,
      COUNT(DISTINCT mph.observed_by) AS observer_count
    FROM material_price_history mph
    WHERE mph.trade = p_trade
      AND mph.country = p_country
      AND mph.observed_at <  now() - (p_recent_days  || ' days')::INTERVAL
      AND mph.observed_at >= now() - (p_baseline_days || ' days')::INTERVAL
    GROUP BY mph.trade, mph.country, LOWER(mph.material_name), mph.material_category, mph.unit, mph.supplier_id
  ),
  recent AS (
    SELECT
      mph.trade,
      mph.country,
      LOWER(mph.material_name)      AS material_name,
      mph.material_category,
      mph.unit,
      mph.supplier_id,
      MIN(mph.supplier_name)        AS supplier_name,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY mph.price_excl_vat)::REAL
                                    AS median_price,
      COUNT(*)                      AS sample_size,
      COUNT(DISTINCT mph.observed_by) AS observer_count
    FROM material_price_history mph
    WHERE mph.trade = p_trade
      AND mph.country = p_country
      AND mph.observed_at >= now() - (p_recent_days || ' days')::INTERVAL
    GROUP BY mph.trade, mph.country, LOWER(mph.material_name), mph.material_category, mph.unit, mph.supplier_id
  ),
  joined AS (
    SELECT
      r.material_name,
      r.material_category,
      r.unit,
      r.supplier_id,
      r.supplier_name,
      b.median_price::REAL  AS baseline_price,
      r.median_price::REAL  AS recent_price,
      CASE
        WHEN b.median_price IS NULL OR b.median_price = 0 THEN NULL
        ELSE (((r.median_price - b.median_price) / b.median_price) * 100.0)::REAL
      END AS drift_pct,
      r.sample_size::BIGINT     AS recent_sample_size,
      COALESCE(b.sample_size, 0)::BIGINT  AS baseline_sample_size,
      r.observer_count::BIGINT  AS recent_observer_count
    FROM recent r
    LEFT JOIN baseline b
      ON  r.material_name = b.material_name
      AND r.supplier_id   = b.supplier_id
      AND r.unit          = b.unit
  ),
  -- Market-wide detection: for each material, count how many suppliers had
  -- drift in the same direction. If every supplier moved up OR every supplier
  -- moved down (and at least 2 suppliers contributed), it's market-wide.
  per_material AS (
    SELECT
      material_name,
      COUNT(*) FILTER (WHERE drift_pct IS NOT NULL) AS suppliers_total,
      COUNT(*) FILTER (WHERE drift_pct IS NOT NULL AND drift_pct > 0) AS suppliers_up,
      COUNT(*) FILTER (WHERE drift_pct IS NOT NULL AND drift_pct < 0) AS suppliers_down
    FROM joined
    GROUP BY material_name
  )
  SELECT
    j.material_name,
    j.material_category,
    j.unit,
    j.supplier_id,
    j.supplier_name,
    j.baseline_price,
    j.recent_price,
    j.drift_pct,
    j.recent_sample_size,
    j.baseline_sample_size,
    j.recent_observer_count,
    (
      pm.suppliers_total >= 2
      AND (
        pm.suppliers_up = pm.suppliers_total
        OR pm.suppliers_down = pm.suppliers_total
      )
    ) AS is_market_wide
  FROM joined j
  JOIN per_material pm ON pm.material_name = j.material_name
  WHERE j.drift_pct IS NOT NULL
    AND ABS(j.drift_pct) >= p_min_drift_pct
    AND j.recent_observer_count >= 3   -- k-anonymity on recent window
    AND j.baseline_sample_size >= 3    -- need comparable baseline
  ORDER BY ABS(j.drift_pct) DESC;
END;
$function$;

-- get_seasonal_pattern
CREATE OR REPLACE FUNCTION public.get_seasonal_pattern(p_trade text, p_country text, p_months integer DEFAULT 18)
 RETURNS TABLE(season text, median_price real, acceptance_rate real, sample_size bigint, contractor_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_total_contractors BIGINT;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO v_total_contractors
  FROM pricing_intelligence
  WHERE trade = p_trade
    AND country = p_country
    AND season IS NOT NULL
    AND quoted_at > now() - (p_months || ' months')::INTERVAL;

  IF COALESCE(v_total_contractors, 0) < 5 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pi.season,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY pi.quoted_unit_price)::REAL,
    (COUNT(*) FILTER (WHERE pi.was_accepted = true))::REAL
      / NULLIF(COUNT(*) FILTER (WHERE pi.was_accepted IS NOT NULL)::REAL, 0),
    COUNT(*),
    COUNT(DISTINCT pi.user_id)
  FROM pricing_intelligence pi
  WHERE pi.trade = p_trade
    AND pi.country = p_country
    AND pi.season IS NOT NULL
    AND pi.quoted_at > now() - (p_months || ' months')::INTERVAL
  GROUP BY pi.season;
END;
$function$;

-- get_signup_cohort_retention
CREATE OR REPLACE FUNCTION public.get_signup_cohort_retention(p_weeks_back integer DEFAULT 12, p_max_week_offset integer DEFAULT 12, p_country text DEFAULT NULL::text, p_trade text DEFAULT NULL::text)
 RETURNS TABLE(cohort_week text, cohort_size integer, weeks_since_signup integer, active_users integer, retention_pct real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH signups AS (
    SELECT DISTINCT
      be.user_id,
      to_char(date_trunc('week', be.created_at), 'IYYY-"W"IW') AS cohort_week,
      date_trunc('week', be.created_at) AS cohort_start
    FROM business_events be
    WHERE be.event_type = 'signup_completed'
      AND be.created_at >= now() - (p_weeks_back || ' weeks')::INTERVAL
      AND (p_country IS NULL OR be.country = p_country)
      AND (p_trade   IS NULL OR be.trade   = p_trade)
  ),
  cohort_sizes AS (
    SELECT cohort_week, cohort_start, COUNT(DISTINCT user_id)::INT AS cohort_size
    FROM signups
    GROUP BY cohort_week, cohort_start
  ),
  activity AS (
    -- For each signup-user, find the distinct ISO weeks they had activity.
    SELECT
      s.user_id,
      s.cohort_week,
      s.cohort_start,
      GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM date_trunc('week', be.created_at) - s.cohort_start) / 604800)
      )::INT AS weeks_since_signup
    FROM signups s
    JOIN business_events be
      ON be.user_id = s.user_id
     AND be.created_at >= s.cohort_start
     AND be.created_at <  s.cohort_start + ((p_max_week_offset + 1) || ' weeks')::INTERVAL
  )
  SELECT
    a.cohort_week,
    cs.cohort_size,
    a.weeks_since_signup,
    COUNT(DISTINCT a.user_id)::INT AS active_users,
    (COUNT(DISTINCT a.user_id)::REAL / NULLIF(cs.cohort_size, 0)::REAL) AS retention_pct
  FROM activity a
  JOIN cohort_sizes cs ON cs.cohort_week = a.cohort_week
  WHERE a.weeks_since_signup <= p_max_week_offset
  GROUP BY a.cohort_week, cs.cohort_size, a.weeks_since_signup
  ORDER BY a.cohort_week DESC, a.weeks_since_signup ASC;
END;
$function$;

-- match_similar_customers
CREATE OR REPLACE FUNCTION public.match_similar_customers(p_user_id uuid, p_query_text text, p_limit integer DEFAULT 5)
 RETURNS TABLE(customer_id text, similarity real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_query vector(1536);
begin
  -- The embedding for p_query_text is expected to have been written by
  -- embed-text under key '__query__' just before this call. The service
  -- wrapper findSimilarCustomersByText handles that flow.
  select embedding into v_query
    from public.customer_embeddings
   where customer_id = '__query__'
     and user_id = p_user_id
   order by embedded_at desc
   limit 1;

  if v_query is null then
    return;
  end if;

  return query
  select ce.customer_id,
         (1 - (ce.embedding <=> v_query))::real AS similarity
  from public.customer_embeddings ce
  where ce.user_id = p_user_id
    and ce.customer_id != '__query__'
  order by ce.embedding <=> v_query
  limit p_limit;
end; $function$;

-- match_similar_materials
CREATE OR REPLACE FUNCTION public.match_similar_materials(p_query_key text, p_limit integer DEFAULT 5)
 RETURNS TABLE(material_key text, similarity real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  v_query vector(1536);
begin
  select embedding into v_query
    from public.material_embeddings
   where material_key = p_query_key
   limit 1;

  if v_query is null then
    return;
  end if;

  return query
  select me.material_key,
         (1 - (me.embedding <=> v_query))::real AS similarity
  from public.material_embeddings me
  where me.material_key != p_query_key
  order by me.embedding <=> v_query
  limit p_limit;
end; $function$;

-- match_similar_jobs
CREATE OR REPLACE FUNCTION public.match_similar_jobs(query_embedding vector, match_trade text, match_country text DEFAULT 'NL'::text, match_threshold real DEFAULT 0.7, match_count integer DEFAULT 5)
 RETURNS TABLE(job_id text, job_description text, job_type text, actual_cost real, actual_hours real, margin_percent real, similarity real)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    je.job_id,
    je.job_description,
    je.job_type,
    je.actual_cost,
    je.actual_hours,
    je.margin_percent,
    (1 - (je.embedding <=> query_embedding))::real AS similarity
  FROM job_embeddings je
  WHERE je.trade = match_trade
    AND je.country = match_country
    AND je.actual_cost IS NOT NULL
    AND 1 - (je.embedding <=> query_embedding) > match_threshold
  ORDER BY je.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;
