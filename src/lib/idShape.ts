// =============================================================================
// ID SHAPE HELPERS (R59)
// =============================================================================
// Single source of truth for distinguishing temp ids from BE-generated uuids.
// Multiple subsystems (offlineWriteQueue R49, AppState refreshData R57, moat
// emit gates R59) need to reason about id shape — collocating the patterns
// here prevents drift between modules.
//
// Temp id format: `{prefix}-{Date.now()}` where prefix is one of c / j / q /
// inv / mat / sup / jm / proj. AppState mints these client-side for
// optimistic UI updates; the BE replaces them with real uuids on flush
// (offlineWriteQueue.applyWrite + R54 idRemapBus side-effect re-fire).
//
// Synthetic ids that are NEITHER temp NOR uuid (e.g. `j-rec-{ts}-{rand}` from
// recurringJobService, `j-seed-1` from onboarding seed) are deliberately
// excluded from `isTempId` so R49 doesn't try to rewrite them. They live
// outside the temp→real lifecycle.
// =============================================================================

const TEMP_ID_PATTERNS: readonly RegExp[] = [
  /^c-\d+$/,
  /^j-\d+$/,
  /^mat-\d+$/,
  /^sup-\d+$/,
  /^jm-\d+$/,
  /^proj-\d+$/,
  /^q-\d+$/,
  /^inv-\d+$/,
];

const TEMP_ID_RE_FULL = /^(c|j|q|inv|mat|sup|jm|proj)-\d+$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client-minted temp id from AppState's add-X mutators. R49 rewrites these on flush. */
export function isTempId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  return TEMP_ID_PATTERNS.some((re) => re.test(id));
}

/** Same predicate as isTempId but optimized for hot loops — single regex test. */
export function isTempIdFast(id: unknown): boolean {
  return typeof id === 'string' && TEMP_ID_RE_FULL.test(id);
}

/** Real BE-assigned uuid (RFC 4122 v4 shape). */
export function isUuid(id: unknown): boolean {
  return typeof id === 'string' && UUID_RE.test(id);
}

/**
 * R59: id is "moat-safe" if it is a real BE uuid OR a stable string used as
 * a key (docNumber like `Q-260001` for documents). Returns false for temp
 * ids so callers can early-return before writing to BE.
 *
 * Use at moat-write sites that bypass the offline queue (e.g. direct
 * Supabase inserts to pricing_intelligence, customer_portal_events,
 * job_quality_signals) where a temp id would corrupt the cohort row.
 */
export function isMoatSafeId(id: unknown): boolean {
  if (typeof id !== 'string' || !id) return false;
  return !isTempIdFast(id);
}
