// =============================================================================
// LICENSE EXPIRY SERVICE — 30-day warning for US state licenses (R79)
// =============================================================================
// Iterates BusinessProfile.licenses[], returns the rows expiring within
// `daysAhead` days. Caller is the Vandaag tab cold-start gate (warns
// before the contractor logs an estimate they can't legally fulfill)
// and the daily push digest.
//
// All time math is calendar-day based — license expiry is a date, not a
// timestamp, so hour/minute precision is irrelevant. ISO `YYYY-MM-DD`
// parses to UTC-noon to dodge timezone-edge bugs (compare with the same
// noon-anchored today).
// =============================================================================

import type { BusinessProfile, ContractorLicense } from '../domain/business';

export interface ExpiringLicense extends ContractorLicense {
  daysUntilExpiry: number;
  severity: 'expired' | 'urgent' | 'soon';
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDate(iso: string): Date {
  // Anchor at UTC-noon to avoid local-tz day flips.
  return new Date(`${iso}T12:00:00.000Z`);
}

function todayUtcNoon(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
}

/**
 * Returns licenses expiring within `daysAhead` days, including ones
 * already expired (daysUntilExpiry < 0). Sorted soonest-first so the
 * UI naturally surfaces the most urgent.
 *
 * Severity buckets:
 *   - 'expired' : daysUntilExpiry < 0
 *   - 'urgent'  : 0–7 days
 *   - 'soon'    : 8–30 days (or up to daysAhead, whichever is smaller)
 */
export function getExpiringLicenses(
  profile: Pick<BusinessProfile, 'licenses'>,
  daysAhead = 30,
): ExpiringLicense[] {
  if (!profile.licenses || profile.licenses.length === 0) return [];

  const today = todayUtcNoon();
  const cutoffMs = today.getTime() + daysAhead * MS_PER_DAY;

  return profile.licenses
    .map((l): ExpiringLicense | null => {
      if (!l.expiryDate) return null;
      const expiry = parseIsoDate(l.expiryDate);
      const daysUntilExpiry = Math.round((expiry.getTime() - today.getTime()) / MS_PER_DAY);
      if (expiry.getTime() > cutoffMs) return null; // outside window

      let severity: ExpiringLicense['severity'];
      if (daysUntilExpiry < 0) severity = 'expired';
      else if (daysUntilExpiry <= 7) severity = 'urgent';
      else severity = 'soon';

      return { ...l, daysUntilExpiry, severity };
    })
    .filter((x): x is ExpiringLicense => x !== null)
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Returns true when any license is within the warning window. Used to
 * decide whether to render the Vandaag-tab amber alert card.
 */
export function hasExpiringLicenses(
  profile: Pick<BusinessProfile, 'licenses'>,
  daysAhead = 30,
): boolean {
  return getExpiringLicenses(profile, daysAhead).length > 0;
}
