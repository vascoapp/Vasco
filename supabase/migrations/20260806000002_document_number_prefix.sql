-- =============================================================================
-- DOCUMENT NUMBERING — honour the contractor's own series
-- =============================================================================
-- `business_settings.invoice_prefix` and `quote_prefix` have existed as columns
-- since the base schema, are declared on BusinessProfile, and are carried by
-- BOTH mappers and the AppState write mapper. Nothing has ever read them, and
-- no screen has ever set them: `next_document_number` hardcoded
-- `case when p_doc_type = 'quote' then 'Q' else 'I' end`.
--
-- So every contractor's invoices are I0001, I0002 … regardless. That is the
-- dead-field class from learnings #109/#110 again — a complete FE↔BE↔DB chain
-- with nothing at either end — but here it blocks a real user:
--
--   A CONTRACTOR SWITCHING TO VASCO MID-YEAR CANNOT CONTINUE THEIR SERIES.
--   They invoiced 2026-0001 … 2026-0087 in their old system; Vasco restarts at
--   I0001. Sequential, uniquely-identifiable invoice numbering is expected by
--   the Belastingdienst and by GoBD (§14 UStG) — and this app already keeps a
--   GoBD audit trail, so it plainly cares. It is also simply what their
--   accountant will ask for.
--
-- Two changes, both minimal:
--   1. next_document_number reads the caller's prefix, defaulting to the old
--      'I'/'Q' so existing users see no change whatsoever.
--   2. set_document_counter lets them continue an existing series — and REFUSES
--      to move the counter backwards.
--
-- ⚠️ CREATE OR REPLACE DROPS function-level SET clauses, so `search_path` is
-- re-pinned below. Migration 20260711000004 added it precisely because a
-- SECURITY DEFINER function with a mutable search_path is a privilege-escalation
-- primitive; replacing the function without it would silently undo that fix.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mint the next number, using the contractor's prefix
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_document_number(p_doc_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_num bigint;
  prefix text;
  v_user_id uuid := auth.uid();
BEGIN
  IF p_doc_type NOT IN ('quote', 'invoice') THEN
    RAISE EXCEPTION 'Invalid document type: %', p_doc_type;
  END IF;

  INSERT INTO document_counters (user_id, doc_type, current_number)
  VALUES (v_user_id, p_doc_type, 0)
  ON CONFLICT (user_id, doc_type) DO NOTHING;

  UPDATE document_counters
  SET current_number = current_number + 1,
      updated_at = now()
  WHERE user_id = v_user_id AND doc_type = p_doc_type
  RETURNING current_number INTO next_num;

  SELECT CASE WHEN p_doc_type = 'quote' THEN bs.quote_prefix ELSE bs.invoice_prefix END
    INTO prefix
  FROM business_settings bs
  WHERE bs.user_id = v_user_id;

  -- Fall back to the historic default when unset, blank, or not a shape that is
  -- safe downstream. An invoice number ends up in e-invoice XML, in filenames
  -- and in URLs, so a prefix carrying spaces or punctuation would not fail here
  -- — it would fail later, somewhere far less obvious. Defaulting is the right
  -- answer over raising: the contractor is trying to issue an invoice, and
  -- refusing to number it would block the sale over a settings typo.
  IF prefix IS NULL
     OR btrim(prefix) = ''
     OR length(prefix) > 12
     OR prefix !~ '^[A-Za-z0-9/_-]+$' THEN
    prefix := CASE WHEN p_doc_type = 'quote' THEN 'Q' ELSE 'I' END;
  END IF;

  RETURN prefix || lpad(next_num::text, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Continue an existing series — forwards only
-- ---------------------------------------------------------------------------
-- p_next_number is the number the contractor wants their NEXT document to
-- carry, because that is the question they can actually answer ("my last
-- invoice was 87"). The counter stores the LAST issued, so it lands on n-1.
--
-- MOVING BACKWARDS IS REFUSED, and this is the whole point of the function
-- rather than a plain UPDATE. Lowering the counter re-mints numbers that have
-- already been issued, and two invoices sharing one number is a compliance
-- problem — the same reason regulated_submissions carries a UNIQUE idempotency
-- key rather than an index. A contractor who mistypes 8 for 88 would otherwise
-- silently duplicate eighty invoice numbers.
--
-- Returns the number the next document will actually get, so the caller can
-- show what happened instead of assuming its request was honoured.
CREATE OR REPLACE FUNCTION public.set_document_counter(
  p_doc_type text,
  p_next_number bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'set_document_counter requires an authenticated session'
      USING errcode = '42501';
  END IF;
  IF p_doc_type NOT IN ('quote', 'invoice') THEN
    RAISE EXCEPTION 'Invalid document type: %', p_doc_type;
  END IF;
  -- Upper bound keeps lpad's 4-digit assumption meaningful and stops a fat
  -- finger from parking the series in the billions, which cannot be undone
  -- (the counter only moves forwards, by design).
  IF p_next_number IS NULL OR p_next_number < 1 OR p_next_number > 9999999 THEN
    RAISE EXCEPTION 'next number out of range: %', p_next_number
      USING errcode = '22003';
  END IF;

  INSERT INTO document_counters (user_id, doc_type, current_number)
  VALUES (v_user_id, p_doc_type, 0)
  ON CONFLICT (user_id, doc_type) DO NOTHING;

  SELECT current_number INTO v_current
  FROM document_counters
  WHERE user_id = v_user_id AND doc_type = p_doc_type;

  IF (p_next_number - 1) < v_current THEN
    RAISE EXCEPTION 'refusing to lower the % counter: % numbers already issued, next would be %',
      p_doc_type, v_current, p_next_number
      USING errcode = '23505';
  END IF;

  UPDATE document_counters
  SET current_number = p_next_number - 1,
      updated_at = now()
  WHERE user_id = v_user_id AND doc_type = p_doc_type;

  RETURN p_next_number;
END;
$$;

REVOKE ALL ON FUNCTION public.set_document_counter(text, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.set_document_counter(text, bigint) TO authenticated, service_role;
-- anon deliberately absent: this mutates a contractor's numbering series.

-- ---------------------------------------------------------------------------
-- 3. Read the current position, so a settings screen can show it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peek_document_counter(p_doc_type text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT current_number + 1 FROM document_counters
     WHERE user_id = auth.uid() AND doc_type = p_doc_type),
    1
  );
$$;

REVOKE ALL ON FUNCTION public.peek_document_counter(text) FROM public;
GRANT EXECUTE ON FUNCTION public.peek_document_counter(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.next_document_number(text) IS
  'Mints the next quote/invoice number using business_settings.quote_prefix / '
  'invoice_prefix, falling back to Q/I when unset or unsafe. Counter is '
  'monotonic; use set_document_counter to continue a series from another system.';
