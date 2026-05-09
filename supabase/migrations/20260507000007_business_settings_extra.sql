-- =============================================================================
-- BUSINESS SETTINGS EXTRA COLUMNS — R66 round 24 (2026-05-07)
-- =============================================================================
-- The onboarding flow (app/onboarding.tsx) writes 5 fields into AppState
-- via updateBusinessProfile(): vatScheme, businessType, teamSize, trade,
-- registrationNumber. The dbUpdates mapper in AppState had no branches for
-- these — they updated React state and were silently dropped from the BE
-- write. On cold start (production users hydrate from BE, not AsyncStorage),
-- the 5 fields reverted to undefined.
--
-- Specific user-facing impact:
--   - vatScheme: contractor onboards in NL eenmanszaak/solo → R264 advisor
--     pre-applies KOR exemption → invoice PDF should show 0% VAT + the legal
--     note. After cold start, vatScheme reverts to undefined → invoice goes
--     out at 21% VAT. KOR contractor's first invoice arrives with wrong VAT.
--   - businessType + teamSize: needed by the R264 advisor + cohort moat slicing
--     ("painters in DE solo vs FR small" are different markets).
--   - trade: load-bearing for almost every cohort RPC (postcode + trade slicing).
--   - registrationNumber: covers UK Co.no / IT Codice Fiscale / FR SIRET when
--     the country-specific reg key isn't kvk_number/vat_number.
--
-- All 5 columns are nullable text/text-typed-as-enum because the FE handles
-- their domain — keeping the BE permissive lets future business-type / team-
-- size enum changes ship without a migration.
-- =============================================================================

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS vat_scheme           text,
  ADD COLUMN IF NOT EXISTS business_type        text,
  ADD COLUMN IF NOT EXISTS team_size            text,
  ADD COLUMN IF NOT EXISTS trade                text,
  ADD COLUMN IF NOT EXISTS registration_number  text;

COMMENT ON COLUMN public.business_settings.vat_scheme IS
  'standard | small_business_NL_KOR | small_business_DE_kleinunternehmer. Drives invoice/quote PDF VAT rendering.';
COMMENT ON COLUMN public.business_settings.business_type IS
  'Free-text: eenmanszaak / einzelunternehmer / vof / bv / etc. Surfaced from onboarding step 8.';
COMMENT ON COLUMN public.business_settings.team_size IS
  'solo | small | medium | large. Drives R264 vatScheme advisor + cohort slicing.';
COMMENT ON COLUMN public.business_settings.trade IS
  'Primary contractor trade. Load-bearing for postcode + trade cohort RPCs.';
COMMENT ON COLUMN public.business_settings.registration_number IS
  'Country-specific reg id when not covered by kvk_number/vat_number (UK Co.no, IT Codice Fiscale, FR SIRET).';
