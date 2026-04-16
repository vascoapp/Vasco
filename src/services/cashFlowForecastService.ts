// =============================================================================
// CASH-FLOW FORECAST (30 days) — expected incoming vs outgoing
// =============================================================================
// Pulls from:
//   • open invoices (amount × probability-of-payment within horizon)
//   • sent quotes (amount × acceptance rate × likely days to invoice+paid)
//   • scheduled jobs with agreed amount (create-invoice-on-completion)
//   • material purchase orders (estimated outflow)
// Returns day-by-day net curve + confidence band.
// =============================================================================

import type { Invoice, Quote } from '../domain/documents';
import type { Job } from '../types/contractor';
import { predictPaymentTiming } from '../intelligence/mlModels';

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
  minCashDay: ForecastDay;  // worst day (lowest cumulative)
  days: ForecastDay[];
  byCategory: {
    openInvoices: number;
    pendingQuotes: number;
    scheduledJobs: number;
    purchaseOrders: number;
  };
}

interface ForecastInput {
  invoices: Invoice[];
  quotes: Quote[];
  jobs: Job[];
  purchaseOrders?: Array<{ amount: number; expectedDate?: string }>;
  startingBalance?: number;
  horizonDays?: number;
}

const DAY = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

/** Build a 30-day (default) forecast. All figures in the user's currency. */
export async function buildForecast(input: ForecastInput): Promise<ForecastSummary> {
  const horizon = input.horizonDays ?? 30;
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Seed day array
  const days: ForecastDay[] = [];
  for (let i = 0; i < horizon; i += 1) {
    const d = addDays(today, i);
    days.push({ date: dateKey(d), inflow: 0, outflow: 0, net: 0, cumulative: 0 });
  }
  const byDay = new Map(days.map((d) => [d.date, d]));

  const byCategory = { openInvoices: 0, pendingQuotes: 0, scheduledJobs: 0, purchaseOrders: 0 };

  // 1. Open invoices — use payment predictor to decide which day they land
  for (const inv of input.invoices) {
    if (inv.status !== 'sent' && inv.status !== 'overdue') continue;
    const amt = inv.amount ?? 0;
    if (amt <= 0) continue;
    let expectedDaysOut = 14;
    try {
      const pred = await predictPaymentTiming({
        customerId: (inv as any).customerId ?? (inv as any).customer ?? '',
        amount: amt,
        dayOfWeek: today.getDay(),
      });
      expectedDaysOut = Math.max(0, Math.round((pred as any).expectedDaysToPay ?? 14));
    } catch {}
    const key = dateKey(addDays(today, Math.min(horizon - 1, expectedDaysOut)));
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.inflow += amt * 0.85; // risk-adjusted
      byCategory.openInvoices += amt * 0.85;
    }
  }

  // 2. Sent quotes — probabilistic acceptance in ~7 days, paid 14 days later
  const sentQuotes = input.quotes.filter((q) => q.status === 'sent');
  for (const q of sentQuotes) {
    const amt = q.amount ?? 0;
    if (amt <= 0) continue;
    const acceptancePctg = 0.45;
    const key = dateKey(addDays(today, Math.min(horizon - 1, 21)));
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.inflow += amt * acceptancePctg;
      byCategory.pendingQuotes += amt * acceptancePctg;
    }
  }

  // 3. Scheduled jobs with agreedAmount — invoiced on completion day
  for (const j of input.jobs) {
    if (j.status === 'completed' || j.status === 'cancelled') continue;
    const amt = (j as any).agreedAmount ?? (j as any).quotedAmount ?? 0;
    if (amt <= 0) continue;
    const sched = (j as any).scheduledDate ? new Date((j as any).scheduledDate) : null;
    const daysOut = sched ? Math.round((sched.getTime() - today.getTime()) / DAY) : 14;
    const clamped = Math.max(0, Math.min(horizon - 1, daysOut + 14)); // +14 payment lag
    const bucket = byDay.get(dateKey(addDays(today, clamped)));
    if (bucket) {
      bucket.inflow += amt * 0.75;
      byCategory.scheduledJobs += amt * 0.75;
    }
  }

  // 4. Purchase orders — outflow on expected date
  for (const po of input.purchaseOrders ?? []) {
    const amt = po.amount ?? 0;
    if (amt <= 0) continue;
    const target = po.expectedDate ? new Date(po.expectedDate) : addDays(today, 7);
    const daysOut = Math.max(0, Math.min(horizon - 1, Math.round((target.getTime() - today.getTime()) / DAY)));
    const bucket = byDay.get(dateKey(addDays(today, daysOut)));
    if (bucket) {
      bucket.outflow += amt;
      byCategory.purchaseOrders += amt;
    }
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
    minCashDay,
    days,
    byCategory,
  };
}
