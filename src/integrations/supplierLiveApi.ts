// =============================================================================
// SUPPLIER LIVE API (R285) — pluggable adapter for real supplier price feeds
// =============================================================================
// The procurement agent + searchCatalog in suppliers.ts have always returned
// data assembled from static baselines (`getAllMaterialBaselines`) overlaid
// with user scan history. That's enough to power UI but it is NOT the same as
// reading live prices from a supplier's actual catalog API.
//
// This module is the seam where a real adapter slots in, gated by env. Two
// behaviors:
//   - When no provider is configured: every fn returns null and the caller
//     keeps using its baseline path. Cost: zero. Risk: zero.
//   - When configured: provider returns live results; baseline becomes
//     fallback only.
//
// Adding a real provider requires three things:
//   1. Implement LiveSupplierClient (one fn, two methods)
//   2. Register it in `loadConfiguredClient()` keyed by env flag
//   3. Set the env var(s) listed below
//
// Currently shipped adapters: NONE (scaffolding only). Hornbach (DE) and
// Bouwmaat (NL) both have public B2B APIs but require contractor accounts
// to obtain credentials — see LAUNCH.md §2.7.
// =============================================================================

import type { CatalogItem, PriceCheck } from './suppliers';

export interface LiveSupplierClient {
  /** Return null when this provider can't fulfill the query (caller falls back). */
  searchCatalog(query: string, trade?: string, country?: string): Promise<CatalogItem[] | null>;
  /** Return null when no live data — caller falls back to baseline. */
  comparePrices(query: string, country?: string): Promise<PriceCheck | null>;
  /** Provider id, used in logs + telemetry. */
  readonly id: string;
}

let cachedClient: LiveSupplierClient | null | undefined;

/**
 * Resolve the configured live client, or null if the platform should fall
 * back to baselines. Memoized — first call wins for the lifetime of the JS
 * runtime (the env doesn't change at runtime).
 */
export function loadConfiguredClient(): LiveSupplierClient | null {
  if (cachedClient !== undefined) return cachedClient;

  // Master switch — opt-in. Without this, supplier APIs stay dormant even
  // if individual provider keys are present. Lets us ship the scaffold to
  // production without surprising any contractor by accident.
  if (process.env.EXPO_PUBLIC_LIVE_SUPPLIER_API !== '1') {
    cachedClient = null;
    return null;
  }

  // Provider registry. As real adapters land, they get added here. Each
  // adapter MUST self-check its required env vars and short-circuit to null
  // if anything is missing.
  // Example shape (intentionally not implemented — placeholder for the
  // first real adapter):
  //
  //   if (process.env.EXPO_PUBLIC_HORNBACH_API_KEY) {
  //     cachedClient = createHornbachClient(...);
  //     return cachedClient;
  //   }

  cachedClient = null;
  return null;
}

/**
 * Test/boot reset — clears the memoized client. Don't call from app code.
 */
export function __resetLiveSupplierClient(): void {
  cachedClient = undefined;
}
