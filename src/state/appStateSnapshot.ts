// =============================================================================
// APP STATE SNAPSHOT — module-level reference for non-hook consumers
// =============================================================================
// The scheduler and other non-React callers need read-only access to the
// current AppState without calling `useAppState()`. AppStateProvider updates
// this ref on every render so the scheduler always sees fresh data.
// =============================================================================

// Loose types: the snapshot is opaque read-only metadata for the scheduler.
type Job = any;
type Quote = any;
type Invoice = any;
type Customer = any;

export interface AppStateSnapshot {
  jobs: Job[];
  quotes: Quote[];
  invoices: Invoice[];
  customers: Customer[];
  /**
   * What the contractor last entered — which outranks the account (CLAUDE.md).
   *
   * Readers existed with no writer: workflowPackService read
   * `businessProfile.phone` for the {{phone}} in the maintenance reminder a
   * CUSTOMER receives, so it always resolved to '' and the message read "call
   * or message me at to book". The `country`/`trade` fields that used to sit
   * here were never written either. The purchasing agent fell back to
   * `'general'`, `'NL'` and Amsterdam's postcode instead.
   */
  // vatScheme: the quarter-end VAT card must not tell a KOR / Kleinunternehmer
  // contractor — who files no return — that one is due (review, 2026-09-22).
  businessProfile?: { phone?: string; trade?: string; country?: string; postcode?: string; vatScheme?: string; filingPeriod?: string };
  updatedAt: number;
}

let snapshot: AppStateSnapshot = {
  jobs: [],
  quotes: [],
  invoices: [],
  customers: [],
  updatedAt: 0,
};

export function setAppStateSnapshot(next: Omit<AppStateSnapshot, 'updatedAt'>): void {
  snapshot = { ...next, updatedAt: Date.now() };
}

export function getAppStateSnapshot(): AppStateSnapshot {
  return snapshot;
}

// ---------------------------------------------------------------------------
// R66 round 37: mutator refs for realtime watchers
// ---------------------------------------------------------------------------
// `watchInvoicePayments` and `watchUserTables` (src/services/invoicePaymentWatcher.ts)
// fire when Mollie/Stripe webhooks land or another device updates a row.
// Pre-R37 the watcher in app/_layout.tsx passed `() => {}` as the onChange
// callback — local push notifications fired but the in-app UI showed stale
// data until manual pull-to-refresh or cold start. Customer pays via the
// shared link → contractor sees push "Klant heeft betaald" → opens app →
// invoice still shows 'sent' → confusion.
//
// AppStateProvider lives above _layout.tsx's effect, so we can't pass the
// closure-bound mutators directly. Same pub-sub pattern as idRemapBus (R54):
// AppStateProvider populates these refs on mount; watchers call them.
export interface AppStateMutators {
  /** Flip an invoice to paid status when a webhook lands. Idempotent. */
  markInvoicePaid: (invoiceId: string) => void;
  /** Re-fetch core tables from BE. Use after cross-device changes. */
  refreshData: () => Promise<void> | void;
}

let mutators: AppStateMutators | null = null;

export function setAppStateMutators(next: AppStateMutators): void {
  mutators = next;
}

export function getAppStateMutators(): AppStateMutators | null {
  return mutators;
}
