// =============================================================================
// PUSH DIGEST POLICY (R226)
// =============================================================================
// Pure function: given a user's current state (overdue invoice count,
// staling quote count, waiting queue items, jobs tomorrow), decide what
// SINGLE money-relevant push to send them today — or nothing.
//
// The matching Edge Function (`daily-push-digest`) mirrors this logic
// against live DB state. Kept in sync by hand; drift is caught by the
// jest suite here.
//
// Priority order (money first): overdue > queue > staling quotes > jobs.
// Only one push per user per day.
// =============================================================================

export type PushType =
  | 'overdue_invoices'
  | 'queue_waiting'
  | 'staling_quotes'
  | 'jobs_tomorrow';

export interface PushDigestInput {
  overdueInvoiceCount: number;
  overdueInvoiceAmount: number;      // rounded euros
  queuePendingCount: number;
  stalingQuoteCount: number;         // quotes past cohort p75 accept-lag, not yet decided
  jobsTomorrowCount: number;
}

export interface PushDecision {
  type: PushType;
  title: string;
  body: string;
  entityKey: string;
}

// Threshold floors — below these, the signal is too thin to interrupt the
// contractor's evening. They still see it in-app; we just don't push.
const MIN_OVERDUE_COUNT = 1;
const MIN_OVERDUE_AMOUNT = 200;
const MIN_QUEUE = 2;
const MIN_STALING = 1;
const MIN_JOBS_TOMORROW = 1;

/**
 * Pick exactly one notification or return null. English-only for v1 —
 * localization ships in a follow-up round; the Edge Function will
 * swap in the user's locale-specific string table at send time.
 */
export function pickDailyPush(input: PushDigestInput): PushDecision | null {
  // 1. Overdue invoices — highest priority (real money at stake).
  if (
    input.overdueInvoiceCount >= MIN_OVERDUE_COUNT
    && input.overdueInvoiceAmount >= MIN_OVERDUE_AMOUNT
  ) {
    const plural = input.overdueInvoiceCount > 1 ? 's' : '';
    return {
      type: 'overdue_invoices',
      title: `€${input.overdueInvoiceAmount.toLocaleString()} overdue`,
      body: `${input.overdueInvoiceCount} invoice${plural} past due. Send a reminder in 2 taps.`,
      entityKey: `overdue:${input.overdueInvoiceCount}:${input.overdueInvoiceAmount}`,
    };
  }

  // 2. Queue items waiting — EVE has drafts ready for approval.
  if (input.queuePendingCount >= MIN_QUEUE) {
    return {
      type: 'queue_waiting',
      title: `${input.queuePendingCount} actions waiting`,
      body: `Vasco prepared ${input.queuePendingCount} things for you. Approve or skip.`,
      entityKey: `queue:${input.queuePendingCount}`,
    };
  }

  // 3. Staling quotes — past the cohort p75 accept-lag with no customer reply.
  if (input.stalingQuoteCount >= MIN_STALING) {
    const plural = input.stalingQuoteCount > 1 ? 's' : '';
    return {
      type: 'staling_quotes',
      title: `${input.stalingQuoteCount} quote${plural} going stale`,
      body: `Cohort usually accepts within a week. A nudge often unsticks them.`,
      entityKey: `staling:${input.stalingQuoteCount}`,
    };
  }

  // 4. Jobs tomorrow — softer, schedule-oriented.
  if (input.jobsTomorrowCount >= MIN_JOBS_TOMORROW) {
    const plural = input.jobsTomorrowCount > 1 ? 's' : '';
    return {
      type: 'jobs_tomorrow',
      title: `${input.jobsTomorrowCount} job${plural} tomorrow`,
      body: `Materials ready? Route planned? Tap to prep in 30 seconds.`,
      entityKey: `tomorrow:${input.jobsTomorrowCount}`,
    };
  }

  return null;
}

export const __internal = {
  MIN_OVERDUE_COUNT,
  MIN_OVERDUE_AMOUNT,
  MIN_QUEUE,
  MIN_STALING,
  MIN_JOBS_TOMORROW,
};
