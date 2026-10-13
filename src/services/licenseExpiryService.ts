// =============================================================================
// LICENSE EXPIRY SERVICE — 30-day warning for US state licenses (R79)
// =============================================================================
// Iterates BusinessProfile.licenses[], returns the rows expiring within
// `daysAhead` days. Caller is the Vandaag tab cold-start gate (warns
// before the contractor logs an estimate they can't legally fulfill)
// and the daily push digest.
//
// All time math is calendar-day based — license expiry is a date, not a
// timestamp. Days are LOCAL calendar days via dateKey.daysUntil (the earlier
// UTC-noon anchors used the UTC date as "today", #424).
// =============================================================================

import { daysUntil as calendarDaysUntil } from '../utils/dateKey';
import type { BusinessProfile, ContractorLicense } from '../domain/business';

export interface ExpiringLicense extends ContractorLicense {
  daysUntilExpiry: number;
  severity: 'expired' | 'urgent' | 'soon';
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

  return profile.licenses
    .map((l): ExpiringLicense | null => {
      if (!l.expiryDate) return null;
      // LOCAL calendar days (dateKey). The UTC-noon anchors read "today" as
      // the UTC date, which is still yesterday until 01:00/02:00 in NL (#424).
      const daysUntilExpiry = calendarDaysUntil(l.expiryDate);
      if (daysUntilExpiry === null || daysUntilExpiry > daysAhead) return null; // outside window

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
