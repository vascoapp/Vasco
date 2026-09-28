// =============================================================================
// The contractor's OWN hourly charge rate — or undefined. Never a default.
// =============================================================================
// Pricebook first (the most-used hourly entry with a price), then the profile's
// hourlyRate. Lifted out of AppState's invoice-from-job path so every screen
// that values hours uses the same number: the timesheet multiplied by a
// literal €55 (emulator walk 2026-09-28) — an invented rate presented as the
// value of the contractor's time (#207's shape).
import type { BusinessProfile } from '../domain/business';

export async function resolveHourlyChargeRate(profile: BusinessProfile | undefined | null): Promise<number | undefined> {
  let rate = (profile as { hourlyRate?: number } | undefined | null)?.hourlyRate;
  try {
    const { loadPricebook } = await import('./pricebookService');
    const hourly = (await loadPricebook())
      .filter((e) => e.pricingType === 'hourly' && (e.basePrice ?? 0) > 0)
      .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))[0];
    if (hourly) rate = hourly.basePrice;
  } catch {
    // Price list unreadable — fall through to the profile rate.
  }
  return rate && rate > 0 ? rate : undefined;
}
