// =============================================================================
// ACCOUNTING SYNC SERVICE — Polls connected accounting provider for updates
// =============================================================================
// Calls existing syncPaymentStatus() from the unified accounting integration
// to detect invoices marked paid in the accounting system, then returns them
// so the caller can update local invoice statuses.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccountingConfig, syncPaymentStatus } from '../integrations/accounting';

/** Minimal invoice shape needed for sync matching */
interface SyncableInvoice {
  id: string;
  status: string;
  invoiceNumber?: string;
  total?: number;
  [key: string]: any;
}

const LAST_SYNC_KEY = '@vasco_accounting_sync_last';
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if enough time has passed since the last sync (>1 hour).
 */
export async function shouldSync(): Promise<boolean> {
  const config = await getAccountingConfig();
  if (!config.connected || config.provider === 'none') return false;

  const lastSync = await getLastSyncTime();
  if (!lastSync) return true;
  return Date.now() - lastSync > SYNC_INTERVAL;
}

/**
 * Get the timestamp (ms) of the last successful sync, or null if never synced.
 */
export async function getLastSyncTime(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Sync payment statuses from the connected accounting provider.
 *
 * Returns invoices that should be marked as paid locally.
 * The caller (AppState or a screen) is responsible for actually updating
 * invoice statuses — this service never mutates app state directly.
 */
export async function syncAccountingData(
  invoices: SyncableInvoice[],
): Promise<{
  updatedInvoices: SyncableInvoice[];
  paidInvoiceIds: string[];
  error?: string;
}> {
  const config = await getAccountingConfig();
  if (!config.connected || config.provider === 'none') {
    return { updatedInvoices: [], paidInvoiceIds: [], error: 'No accounting provider connected' };
  }

  try {
    // Call the unified sync which delegates to the connected provider
    const { paidInvoiceIds } = await syncPaymentStatus();

    if (paidInvoiceIds.length === 0) {
      await saveLastSyncTime();
      return { updatedInvoices: [], paidInvoiceIds: [] };
    }

    // Match external paid IDs against local invoices
    // Providers return their own IDs — match on invoiceNumber as the shared reference
    const paidSet = new Set(paidInvoiceIds);
    const updatedInvoices: SyncableInvoice[] = [];

    for (const invoice of invoices) {
      // Skip already-paid invoices
      if (invoice.status === 'paid') continue;

      // Match by invoice ID or invoice number (providers may return either)
      if (paidSet.has(invoice.id) || (invoice.invoiceNumber ? paidSet.has(invoice.invoiceNumber) : false)) {
        updatedInvoices.push({
          ...invoice,
          status: 'paid',
          amountPaid: invoice.total,
          amountDue: 0,
          paidAt: new Date().toISOString(),
        });
      }
    }

    await saveLastSyncTime();
    return { updatedInvoices, paidInvoiceIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return { updatedInvoices: [], paidInvoiceIds: [], error: message };
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function saveLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// R66r51: foreground/cold-start poll hook
// ---------------------------------------------------------------------------
// Closes the dormancy flagged in R66r50: every export above had no callers.
// Mollie/Stripe → BE webhook → realtime watcher path was wired (R37), but
// Moneybird/Xero/QuickBooks invoices marked paid in the external accounting
// system never propagated. Contractors who reconcile in their accounting
// tool first (older workflow, common with bookkeepers) saw "sent" status
// indefinitely until manual mark-paid.
//
// Call from app/_layout.tsx on cold-start + foreground. Uses the mutator
// bus (R37 pattern) since the AppStateProvider isn't reachable here.

/**
 * Poll the connected accounting provider for paid invoices and flip local
 * state via the AppState mutator bus. Throttled to 1×/hour via shouldSync().
 * Safe to call on every foreground tick — no-ops when nothing connected,
 * when last sync was recent, or when no AppState is available.
 */
export async function runAccountingPollIfDue(): Promise<{ paidCount: number; error?: string }> {
  try {
    if (!(await shouldSync())) return { paidCount: 0 };

    // Lazy-require the mutator bus to avoid circular import order issues
    // (services/* imported from app/_layout.tsx via React tree).
    const { getAppStateSnapshot, getAppStateMutators } = require('../state/appStateSnapshot');
    const snap = getAppStateSnapshot();
    const mutators = getAppStateMutators();
    if (!mutators) return { paidCount: 0 };

    const invoices = (snap?.invoices ?? []) as SyncableInvoice[];
    if (invoices.length === 0) return { paidCount: 0 };

    const result = await syncAccountingData(invoices);
    if (result.error) return { paidCount: 0, error: result.error };

    for (const inv of result.updatedInvoices) {
      try { mutators.markInvoicePaid(inv.id); } catch {}
    }
    return { paidCount: result.updatedInvoices.length };
  } catch (err) {
    return { paidCount: 0, error: err instanceof Error ? err.message : 'poll failed' };
  }
}
