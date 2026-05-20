-- =============================================================================
-- 20260520000001 — Contractor state-licensing tracker (R79 US Phase 2)
-- =============================================================================
-- US trades carry per-state operating licenses (Master Plumber, Master
-- Electrician, HVAC license, General Contractor, etc.) that expire on a
-- 1–3 year cycle and require timely renewal. Letting one lapse can void
-- the contractor's insurance and trigger fines per job worked.
--
-- This migration adds a `licenses` JSONB column to `business_settings`
-- so each contractor row carries an array of:
--   { type: 'master_plumber', state: 'TX', number: 'M-12345', expiryDate: '2027-06-30' }
--
-- The 30-day-before-expiry warning fires from
-- `complianceGatingService.checkLicenseExpiry()` (client side) on every
-- Vandaag tab cold-start.
--
-- Schema-stability: additive only. ADD COLUMN IF NOT EXISTS. No renames,
-- no drops, no type changes. Pre-existing rows get `licenses = '[]'`.
-- =============================================================================

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS licenses JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN business_settings.licenses IS
  'R79 US Phase 2: array of {type, state, number, expiryDate, issueDate?, issuingAuthority?} for state contractor licenses. Empty array for non-US contractors. checkLicenseExpiry() fires 30d-before-expiry warnings client-side.';

-- Owner-only read/write — same RLS as the rest of business_settings.
-- (No new policy needed; column inherits from the table-level policy.)

-- Helper RPC for the upcoming-renewals digest. Returns licenses
-- expiring in the next N days for the calling user. Used by the
-- daily push digest cron + the Vandaag tab cold-start gate.
CREATE OR REPLACE FUNCTION get_expiring_licenses(p_days_ahead integer DEFAULT 30)
RETURNS TABLE (
  license_type text,
  state text,
  license_number text,
  expiry_date date,
  days_until_expiry integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (license ->> 'type')::text AS license_type,
    (license ->> 'state')::text AS state,
    (license ->> 'number')::text AS license_number,
    (license ->> 'expiryDate')::date AS expiry_date,
    ((license ->> 'expiryDate')::date - CURRENT_DATE)::integer AS days_until_expiry
  FROM business_settings bs,
       jsonb_array_elements(COALESCE(bs.licenses, '[]'::jsonb)) AS license
  WHERE bs.user_id = auth.uid()
    AND (license ->> 'expiryDate') IS NOT NULL
    AND (license ->> 'expiryDate')::date <= CURRENT_DATE + p_days_ahead
    AND (license ->> 'expiryDate')::date >= CURRENT_DATE
  ORDER BY (license ->> 'expiryDate')::date ASC;
$$;

GRANT EXECUTE ON FUNCTION get_expiring_licenses(integer) TO authenticated;
