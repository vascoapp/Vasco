// =============================================================================
// ACTION LEDGER — the durable record of what Vasco actually did
// =============================================================================
// VascoCard is the product: AI prepares → contractor approves → action fires.
// Nothing recorded that.
//
//  - The queue store (@vasco_ai_queue) PRUNES every non-pending item after 7
//    days, and getQueueHistory() caps at 50. Approvals were deleted before any
//    monthly summary could read them.
//  - QueueItem carries no approval timestamp at all — only `createdAt`, which
//    is when the AI *prepared* the item, often days earlier and sometimes in a
//    previous month.
//
// Meanwhile the one surface claiming to report Vasco's value — the "Vasco
// saved you €X" banner on Vandaag — counted route optimisation (behind a kill
// switch), supplier discount POTENTIAL × 0.4, negotiation quick-wins × 0.5 and
// a hardcoded zero. Not one of its six categories was a VascoCard approval, so
// the mechanism the product is built around contributed exactly nothing to the
// number reporting its worth.
//
// This ledger is append-only and counts only what happened:
//   - one entry per approval, stamped at APPROVAL time
//   - `executed` attached by queueItemExecutor — an approval that fired
//     nothing (an informational alert) is not work done and is not counted
//   - `outcome` attached by recordOutcome — a customer reply is the only
//     evidence the message actually landed
//
// It states no euro figure, deliberately. "Chased € 800" is not "saved € 800",
// and a realisation fraction chosen to make a number look good is the
// fabrication class this replaces (learnings #103 / #158). The honest unit is
// a count of named, concrete actions.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import type { QueueItemType } from './aiActionQueueService';
import { logWarn } from '../utils/errorHandler';

const LEDGER_KEY = '@vasco_action_ledger';
/** Enough for a heavy user's full retention window; oldest are dropped first. */
const MAX_ENTRIES = 500;
/** 13 months so a same-month-last-year comparison stays possible. */
const RETENTION_MONTHS = 13;

export type ExecutionVia = 'navigate' | 'share' | 'link' | 'inform' | 'noop';

export type LedgerFamily =
  | 'invoicing'
  | 'chasing'
  | 'quoting'
  | 'customer'
  | 'purchasing'
  | 'compliance'
  | 'planning'
  /** Only for a type this build does not know — see familyOf. */
  | 'other';

export interface LedgerEntry {
  /** Queue item id — the join key for attachExecution / attachOutcome. */
  id: string;
  type: QueueItemType;
  /** ISO timestamp of the APPROVAL, not of the AI's preparation. */
  at: string;
  /**
   * Human handle (customer name, invoice reference). NEVER a raw entity id:
   * this text is rendered to the contractor, and the raw-id class has four
   * documented producers already (learnings #452).
   */
  label?: string;
  via?: ExecutionVia;
  /**
   * undefined = the executor never reported back. Not counted — absence of
   * evidence is not evidence of work. This fails safe by UNDER-counting, which
   * is the correct direction for a number whose whole purpose is to be
   * believed.
   */
  executed?: boolean;
  outcome?: 'positive' | 'negative' | 'neutral';
}

/**
 * Compiler-enforced classification. Typed against the union rather than
 * `Record<string, …>` so a newly added QueueItemType cannot ship unclassified
 * and silently vanish from the ledger — the exact rot that left nine
 * trade-keyed tables stuck at 6 of 15 trades (learnings #163).
 */
const FAMILY: Record<QueueItemType, LedgerFamily> = {
  draft_invoice: 'invoicing',
  batch_invoices: 'invoicing',
  invoice_regenerate: 'invoicing',
  einvoice_submit: 'invoicing',
  accounting_export: 'invoicing',

  draft_reminder: 'chasing',
  late_payment_risk_alert: 'chasing',

  draft_quote: 'quoting',
  draft_followup: 'quoting',
  quote_expiry: 'quoting',
  low_win_alert: 'quoting',

  progress_note: 'customer',
  satisfaction_survey: 'customer',
  decision_reminder: 'customer',
  customer_question: 'customer',
  job_handover: 'customer',
  job_quality_feedback: 'customer',

  reorder_materials: 'purchasing',
  bulk_purchase: 'purchasing',
  price_alert: 'purchasing',
  supplier_comparison: 'purchasing',

  cert_renewal: 'compliance',
  permit_check: 'compliance',
  permit_renewal: 'compliance',
  safety_checklist: 'compliance',
  tax_prep: 'compliance',

  schedule_suggestion: 'planning',
  maintenance_due: 'planning',
};

export function familyOf(type: QueueItemType): LedgerFamily {
  // A ledger persisted by a newer build (or read after an OTA rollback) can
  // hold a type this build does not know. Dropping it would silently shrink
  // the contractor's tally; filing it under a real family would MISLABEL the
  // work — "3 customer updates" for something that was not one. Both are
  // small lies, so unknowns get their own honest bucket.
  return FAMILY[type] ?? 'other';
}

// ---------------------------------------------------------------------------
// Change notification — mirrors aiActionQueueService so a mounted summary
// re-reads when an approval lands, instead of going stale until remount.
// ---------------------------------------------------------------------------

type LedgerListener = () => void;
const listeners = new Set<LedgerListener>();
let notifyScheduled = false;

function notifyLedgerChanged(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    for (const l of [...listeners]) {
      try { l(); } catch { /* one bad subscriber must not break the rest */ }
    }
  }, 150);
}

export function subscribeLedgerChanges(listener: LedgerListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export async function getLedger(): Promise<LedgerEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LEDGER_KEY);
    const entries: LedgerEntry[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(entries) ? entries : [];
  } catch (e) {
    // Loud, not silent: an empty ledger renders as "Vasco did nothing for
    // you", which reads as a broken product rather than a read error.
    logWarn('actionLedger', `read failed: ${String((e as Error)?.message ?? e)}`);
    return [];
  }
}

/**
 * Every mutation below is read-modify-write against a single AsyncStorage key.
 * Approving two cards in quick succession (two components, or a fast double
 * tap) interleaves them: B reads before A's write lands, and A is silently
 * dropped. An undercount here is indistinguishable from "Vasco did less",
 * which is precisely the thing this ledger exists to report accurately — so
 * mutations are serialised through one promise chain.
 */
let mutationChain: Promise<unknown> = Promise.resolve();
function serialise<T>(op: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(op, op);
  // Keep the chain alive after a rejection, or one failure stalls every
  // subsequent write.
  mutationChain = next.catch(() => {});
  return next;
}

async function writeLedger(entries: LedgerEntry[]): Promise<void> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const cutoffIso = cutoff.toISOString();
  const kept = entries
    .filter((e) => e.at > cutoffIso)
    .slice(-MAX_ENTRIES);
  await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(kept));
}

/**
 * Record that the contractor approved an item. Called from approveItem, so it
 * fires on every approval path including the ones that never reach the
 * executor.
 */
export async function recordApproval(entry: {
  id: string;
  type: QueueItemType;
  label?: string;
  at?: string;
}): Promise<void> {
  try {
    await serialise(async () => {
      const entries = await getLedger();
      // Re-approving the same item must not double-count it.
      if (entries.some((e) => e.id === entry.id)) return;
      entries.push({
        id: entry.id,
        type: entry.type,
        at: entry.at ?? new Date().toISOString(),
        label: entry.label,
      });
      await writeLedger(entries);
      notifyLedgerChanged();
    });
  } catch (e) {
    logWarn('actionLedger', `recordApproval failed: ${String((e as Error)?.message ?? e)}`);
  }
}

/** Attach what the executor actually did. Called from queueItemExecutor. */
export async function attachExecution(
  id: string,
  result: { executed: boolean; via: ExecutionVia },
): Promise<void> {
  try {
    await serialise(async () => {
      const entries = await getLedger();
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      entry.executed = result.executed;
      entry.via = result.via;
      await writeLedger(entries);
      notifyLedgerChanged();
    });
  } catch { /* the approval is already recorded; losing `via` is not fatal */ }
}

/** Attach the customer's response. Called from recordOutcome. */
export async function attachOutcome(
  id: string,
  outcome: 'positive' | 'negative' | 'neutral',
): Promise<void> {
  try {
    await serialise(async () => {
      const entries = await getLedger();
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      entry.outcome = outcome;
      await writeLedger(entries);
      notifyLedgerChanged();
    });
  } catch { /* non-fatal */ }
}

/** Test/dev helper. Not called from app code. */
export async function __clearLedger(): Promise<void> {
  await AsyncStorage.removeItem(LEDGER_KEY).catch(() => {});
  notifyLedgerChanged();
}

// ---------------------------------------------------------------------------
// Summary — pure, so the honesty rules are testable without AsyncStorage
// ---------------------------------------------------------------------------

export interface LedgerFamilyCount {
  family: LedgerFamily;
  count: number;
}

export interface LedgerSummary {
  /** Actions that concretely fired in the period. */
  total: number;
  /** Non-empty families, largest first. */
  byFamily: LedgerFamilyCount[];
  /** Of `total`, how many the customer demonstrably responded to. */
  confirmed: number;
  /** ISO date of the first counted action — lets a caller say "since X". */
  firstAt: string | null;
}

const EMPTY_SUMMARY: LedgerSummary = {
  total: 0,
  byFamily: [],
  confirmed: 0,
  firstAt: null,
};

/**
 * Summarise the calendar month containing `now`.
 *
 * Counts ONLY entries with `executed === true`. An informational alert returns
 * `{executed: false}` from the executor — approving "your win rate is low" did
 * no work, and counting it would inflate the one number the contractor is
 * being asked to trust.
 */
export function summariseLedger(entries: LedgerEntry[], now: Date): LedgerSummary {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const counted = entries.filter(
    (e) => e.executed === true && e.at >= start && e.at < end,
  );
  if (counted.length === 0) return EMPTY_SUMMARY;

  const byFamilyMap = new Map<LedgerFamily, number>();
  for (const e of counted) {
    const f = familyOf(e.type);
    byFamilyMap.set(f, (byFamilyMap.get(f) ?? 0) + 1);
  }

  const byFamily = [...byFamilyMap.entries()]
    .map(([family, count]) => ({ family, count }))
    // Ties broken by family name so the list does not reshuffle between reads.
    .sort((a, b) => b.count - a.count || a.family.localeCompare(b.family));

  return {
    total: counted.length,
    byFamily,
    confirmed: counted.filter((e) => e.outcome === 'positive').length,
    firstAt: counted.reduce<string>((min, e) => (e.at < min ? e.at : min), counted[0].at),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Current calendar month's summary, refreshed when an approval lands. */
export function useActionLedger(): LedgerSummary {
  const [summary, setSummary] = useState<LedgerSummary>(EMPTY_SUMMARY);

  const reload = useCallback(() => {
    getLedger()
      .then((entries) => setSummary(summariseLedger(entries, new Date())))
      .catch(() => setSummary(EMPTY_SUMMARY));
  }, []);

  useEffect(() => {
    reload();
    return subscribeLedgerChanges(reload);
  }, [reload]);

  return summary;
}
