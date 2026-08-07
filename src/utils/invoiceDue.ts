// =============================================================================
// HOW LATE IS THIS INVOICE — one answer, derived, not stored
// =============================================================================
// `Invoice.dueInDays` is a STORED SNAPSHOT of a derived value. It is written
// once (`dueInDays: 14` when an invoice is sent, or a fixed constant in the
// demo seed) and never recomputed, so it silently decays: an invoice sent 40
// days ago still claims it is due in 14.
//
// That produced two screens disagreeing about the same invoice on the same
// day. The Meldingen inbox read `dueInDays` and said Hotel NH was "14 dagen
// achterstallig"; the Geld tab computed from `dueDate` and said 32. Geld was
// right — the invoice was due 2026-07-06.
//
// It is not only cosmetic. `attentionEngine` ranks what the contractor should
// look at next by this number, and `customerPaymentHistoryGenerator` averages
// it into a payment-behaviour signal, so a frozen field quietly biases both.
//
// The date is the fact; the day-count is a view of it. Derive from `dueDate`
// whenever it exists and fall back to the stored value only when it does not.
// =============================================================================

const MS_PER_DAY = 86_400_000;

/** Shape shared by the several invoice representations in the app. */
export interface DueLike {
  dueDate?: string | null;
  dueInDays?: number | null;
}

/**
 * Days until due. Negative means overdue.
 *
 * Uses calendar days from local midnight, not elapsed milliseconds: an invoice
 * due yesterday is "1 day late" all of today, rather than flipping to 2 partway
 * through the afternoon.
 *
 * Returns null when neither a date nor a stored count is available — callers
 * then omit the figure instead of printing a confident 0.
 */
export function daysUntilDue(inv: DueLike | null | undefined, now: Date = new Date()): number | null {
  if (!inv) return null;

  const raw = inv.dueDate;
  if (raw) {
    const due = new Date(raw);
    if (!Number.isNaN(due.getTime())) {
      const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
      const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return Math.round((dueMid - nowMid) / MS_PER_DAY);
    }
  }

  return typeof inv.dueInDays === 'number' ? inv.dueInDays : null;
}

/**
 * Whole days an invoice is PAST due; 0 when it is not late yet, null when
 * unknown. The value screens mean when they say "X dagen achterstallig".
 */
export function daysOverdue(inv: DueLike | null | undefined, now: Date = new Date()): number | null {
  const d = daysUntilDue(inv, now);
  if (d === null) return null;
  return d < 0 ? -d : 0;
}

/** True when the due date has passed. Says nothing about payment status. */
export function isPastDue(inv: DueLike | null | undefined, now: Date = new Date()): boolean {
  const d = daysUntilDue(inv, now);
  return d !== null && d < 0;
}
