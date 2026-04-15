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
  country?: string;
  trade?: string;
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
