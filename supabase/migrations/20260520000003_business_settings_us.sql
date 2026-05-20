-- =============================================================================
-- 20260520000003 — Business settings US support (R83 audit fix)
-- =============================================================================
-- E2E audit of the R74-R82 US expansion work found two real bugs:
--
--   1. business_settings.country CHECK constraint was added in
--      20260415000001 with the locked list ('NL','DE','FR','ES','IT','UK').
--      US wasn't appended in any later migration, so every UPDATE/INSERT
--      with country='US' silently fails the CHECK and rolls back.
--
--   2. R74 added BusinessProfile.{state, routingNumber, bankAccountNumber}
--      on the FE but no corresponding ALTER TABLE landed. Even if the
--      mapper wrote these (which it didn't — fixed in the FE code), the
--      columns don't exist.
--
-- This migration:
--   - Widens the country CHECK to include 'US'
--   - Adds the 3 missing columns (state, routing_number, bank_account_number)
--   - All ADD COLUMN IF NOT EXISTS — schema-stable on re-apply.
-- =============================================================================

-- 1. Widen country CHECK ──────────────────────────────────────────────────
ALTER TABLE public.business_settings
  DROP CONSTRAINT IF EXISTS business_settings_country_check;

ALTER TABLE public.business_settings
  ADD CONSTRAINT business_settings_country_check
  CHECK (country IS NULL OR country IN ('NL','DE','FR','ES','IT','UK','US'));

-- 2. US-specific fields ──────────────────────────────────────────────────
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS state text,
  -- US ACH bank fields. routing_number = 9-digit ABA, bank_account_number
  -- = 4-17 digits. Both stored as text to preserve leading zeros (a
  -- routing # like "021000021" mustn't become 21000021 via numeric coercion).
  ADD COLUMN IF NOT EXISTS routing_number text,
  ADD COLUMN IF NOT EXISTS bank_account_number text;

-- Sanity: a state value should be 2 uppercase letters when set. Soft check —
-- not enforced strictly so we can accept legacy/manual data, but DOC'd.
COMMENT ON COLUMN public.business_settings.state IS
  'R83: US state code (2 letters). Required when country = ''US''. Drives sales-tax routing + state-licensing flow.';

COMMENT ON COLUMN public.business_settings.routing_number IS
  'R83: US ACH routing number (9 digits, leading zeros preserved). Rendered on US invoice PDFs in lieu of IBAN/BIC.';

COMMENT ON COLUMN public.business_settings.bank_account_number IS
  'R83: US ACH account number (4-17 digits). Co-rendered with routing_number on US invoice PDFs.';
