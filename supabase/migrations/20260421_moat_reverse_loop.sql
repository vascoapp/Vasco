-- =============================================================================
-- MOAT REVERSE LOOP — batch RPC for per-line cohort adjustments
-- =============================================================================
-- R190: the moat's output feeds back into the AI baseline. To do that with
-- one round trip (instead of N per draft), we expose a batch RPC that takes
-- an array of descriptions and returns the cohort edit distribution for each.
--
-- SCHEMA STABILITY:
--   - No new tables, no column changes.
--   - One new RPC (CREATE OR REPLACE).
--   - Same k-anonymity (>=5 distinct users) and same 6-month window as the
--     existing get_line_item_edit_distribution RPC — so results are
--     identical to calling that RPC in a loop.
-- =============================================================================

-- Postgres-idiomatic way to pass a variable-length array of descriptions:
-- TEXT[]. Server loops and returns one row per input index, preserving order.
-- When a description has insufficient data, the row is returned with all
-- nullable columns set to NULL and sample_size=0 (so the client never has to
-- cross-reference which input got dropped).

CREATE OR REPLACE FUNCTION get_line_adjustments_batch(
  p_trade TEXT,
  p_country TEXT,
  p_descriptions TEXT[]
)
RETURNS TABLE (
  input_index INT,
  description_like TEXT,
  sample_size BIGINT,
  contractor_count BIGINT,
  median_qty_delta_pct REAL,
  median_unit_price_delta_pct REAL,
  top_reason_code TEXT,
  top_reason_share REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idx INT := 0;
  v_desc TEXT;
  v_row RECORD;
BEGIN
  IF p_descriptions IS NULL OR array_length(p_descriptions, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_desc IN ARRAY p_descriptions LOOP
    -- Reuse the existing single-row RPC so the k-anonymity logic stays in
    -- one place. Emits exactly one row per input (null-filled when thin).
    FOR v_row IN
      SELECT *
      FROM get_line_item_edit_distribution(p_trade, p_country, v_desc)
    LOOP
      input_index             := v_idx;
      description_like        := v_desc;
      sample_size             := v_row.sample_size;
      contractor_count        := v_row.contractor_count;
      median_qty_delta_pct    := v_row.median_qty_delta_pct;
      median_unit_price_delta_pct := v_row.median_unit_price_delta_pct;
      top_reason_code         := v_row.top_reason_code;
      top_reason_share        := v_row.top_reason_share;
      RETURN NEXT;
    END LOOP;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION get_line_adjustments_batch(TEXT, TEXT, TEXT[]) TO authenticated;
