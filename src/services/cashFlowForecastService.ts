// =============================================================================
// CASH-FLOW FORECAST (30 days) — money already owed, on the day it is due
// =============================================================================
// Pulls from:
//   • open invoices — face amount, on the due date (overdue → today). A payment
//     prediction may move the date only when it clears
//     PREDICTION_MIN_DISPLAY_CONFIDENCE; a cold-start guess never does.
//   • purchase orders — outflow on the expected date, ONLY when the caller has
//     them. `outflowKnown` says whether an outflow figure means anything.
//
// What it deliberately does NOT count (2026-09-14, German device walk): the
// Finanzen card read "Eingang € 17.848" beside "Offen € 5,4 Tsd.", because
//   - every SENT quote was booked at a hardcoded 45% acceptance, all of it on
//     day 21 — ~€13k of the headline was quotes, some months old, and in NET
//     while invoices are GROSS (learnings #241);
//   - open invoices were scaled by an invented 0.85 "risk adjustment";
//   - their date came from `expectedDaysToPay`, a field PaymentPrediction does
//     not have, so every invoice landed on day 14 whatever its terms — a
//     60-day invoice counted inside a 30-day window (#318);
//   - "Ausgang € 0" was shown although no outflow source was ever passed in.
// A forecast figure is a claim about money; each input must be a fact the
// contractor recorded, not a rate someone typed (#103/#311/#312). Pipeline
// value is already its own KPI on the same screen.
// =============================================================================

import type { Invoice } from '../domain/documents';
import { predictPaymentTiming, PREDICTION_MIN_DISPLAY_CONFIDENCE } from '../intelligence/mlModels';
import { localDateKey, parseCalendarDay, calendarDaysBetween } from '../utils/dateKey';
import { amountPayableNow } from '../domain/documents';

export interface ForecastDay {
  date: string;             // YYYY-MM-DD
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
}

export interface ForecastSummary {
  horizonDays: number;
  totalInflow: number;
  totalOutflow: number;
  netChange: number;
  /** False when no outflow source was supplied: totalOutflow is then 0 by
   *  omission, not by measurement, and must not be shown as "€ 0 out". */
  outflowKnown: boolean;
  minCashDay: ForecastDay;  // worst day (lowest cumulative)
  days: ForecastDay[];
  byCategory: {
    openInvoices: number;
    purchaseOrders: number;
  };
}

interface ForecastInput {
  invoices: Invoice[];
  purchaseOrders?: Array<{ amount: number; expectedDate?: string }>;
  startingBalance?: number;
  horizonDays?: number;
  /** Injectable for tests; defaults to now. */
  today?: Date;
}

/** Calendar arithmetic, not milliseconds — a DST change must not skip a day. */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Days from today until an open invoice is expected in, or null when there
 *  is nothing honest to place it by (no due date, no confident prediction). */
async function expectedInvoiceOffset(inv: Invoice, today: Date): Promise<number | null> {
  const sent = inv.sentAt ? new Date(inv.sentAt) : null;
  if (sent && !Number.isNaN(sent.getTime())) {
    try {
      const pred = await predictPaymentTiming({
        customerId: inv.customerId ?? undefined,
        amount: inv.amount ?? 0,
        dayOfWeek: sent.getDay(),
      });
      if (pred.confidence >= PREDICTION_MIN_DISPLAY_CONFIDENCE && Number.isFinite(pred.predictedDays)) {
        return Math.max(0, calendarDaysBetween(today, addDays(sent, Math.round(pred.predictedDays))));
      }
    } catch {
      // fall through to the due date
    }
  }
  const due = parseCalendarDay(inv.dueDate);
  if (due) return Math.max(0, calendarDaysBetween(today, due));
  // `dueInDays` is the type's required field and what every list reads when a
  // row has no stored due date; dropping such an invoice would under-report
  // money genuinely owed.
  if (Number.isFinite(inv.dueInDays)) return Math.max(0, Math.round(inv.dueInDays));
  return inv.status === 'overdue' ? 0 : null;
}

/** Build a 30-day (default) forecast. All figures in the user's currency. */
export async function buildForecast(input: ForecastInput): Promise<ForecastSummary> {
  const horizon = input.horizonDays ?? 30;
  const base = input.today ?? new Date();
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  const days: ForecastDay[] = [];
  for (let i = 0; i < horizon; i += 1) {
    days.push({ date: localDateKey(addDays(today, i)), inflow: 0, outflow: 0, net: 0, cumulative: 0 });
  }

  const byCategory = { openInvoices: 0, purchaseOrders: 0 };

  // 1. Open invoices — what the customer will actually TRANSFER on the due
  // date. Retention withheld from an instalment is not due until the release
  // invoice, possibly months later, so booking the face value made the
  // forecast optimistic by the whole retention: a € 50.000 termijnfactuur with
  // € 2.500 held back shows € 50.000 arriving and € 47.500 does. `minCashDay`
  // — the point of this screen — then falls on the wrong day. The late-fee
  // path and the payment link already use this helper (#354).
  for (const inv of input.invoices) {
    if (inv.status !== 'sent' && inv.status !== 'overdue') continue;
    const amt = amountPayableNow(inv);
    if (amt <= 0) continue;
    const offset = await expectedInvoiceOffset(inv, today);
    if (offset === null || offset >= horizon) continue;
    days[offset].inflow += amt;
    byCategory.openInvoices += amt;
  }

  // 2. Purchase orders — outflow on expected date
  const outflowKnown = Array.isArray(input.purchaseOrders);
  for (const po of input.purchaseOrders ?? []) {
    const amt = po.amount ?? 0;
    if (amt <= 0) continue;
    const target = parseCalendarDay(po.expectedDate) ?? addDays(today, 7);
    const offset = Math.max(0, calendarDaysBetween(today, target));
    if (offset >= horizon) continue;
    days[offset].outflow += amt;
    byCategory.purchaseOrders += amt;
  }

  // Finalize
  let cumulative = input.startingBalance ?? 0;
  for (const d of days) {
    d.net = d.inflow - d.outflow;
    cumulative += d.net;
    d.cumulative = Math.round(cumulative);
    d.inflow = Math.round(d.inflow);
    d.outflow = Math.round(d.outflow);
    d.net = Math.round(d.net);
  }

  const minCashDay = days.reduce((min, d) => (d.cumulative < min.cumulative ? d : min), days[0]);
  const totalInflow = days.reduce((s, d) => s + d.inflow, 0);
  const totalOutflow = days.reduce((s, d) => s + d.outflow, 0);

  return {
    horizonDays: horizon,
    totalInflow,
    totalOutflow,
    netChange: totalInflow - totalOutflow,
    outflowKnown,
    minCashDay,
    days,
    byCategory,
  };
}
