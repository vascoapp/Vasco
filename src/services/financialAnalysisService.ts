// =============================================================================
// FINANCIAL ANALYSIS SERVICE
// =============================================================================
// Real financial engine: revenue, outstanding, pipeline, cashflow, trends.
// Consumes AppState invoices + quotes, produces FinancialSummary.
// =============================================================================

import { useMemo } from 'react';
import i18n from '../i18n/i18n';
import { useAppState } from '../state/AppState';
import type { Invoice, Quote } from '../domain/documents';
import { useExpenses, type Expense } from './expenseService';
import { MS_PER_DAY } from '../utils/timeConstants';
import { findDocumentCustomer } from '../domain/customers';
import { daysOverdue as invoiceDaysOverdue } from '../utils/invoiceDue';
import { getEffectiveVatRate } from '../domain/business';

/** Decided quotes (accepted/rejected/expired) before a win rate means anything. */
export const MIN_DECIDED_QUOTES = 5;
/** Paid invoices before customer concentration is a finding rather than arithmetic. */
export const MIN_PAID_INVOICES_FOR_CONCENTRATION = 5;

// =============================================================================
// TYPES
// =============================================================================

export interface MonthlyBucket {
  month: string;       // YYYY-MM
  label: string;       // "Jan", "Feb" etc.
  revenue: number;     // paid invoices
  invoiced: number;    // all invoices created
  expenses: number;    // REAL recorded expenses for the month (0 when none recorded)
}

export interface CustomerConcentration {
  customer: string;
  customerId?: string;
  revenue: number;
  percentage: number;  // 0-100
  invoiceCount: number;
}

export interface OverdueDetail {
  invoiceId: string;
  customer: string;
  amount: number;
  daysOverdue: number;
  dueDate: string;
}

export interface FinancialSummary {
  // Revenue
  totalRevenue: number;
  monthlyRevenue: MonthlyBucket[];
  avgMonthlyRevenue: number;
  revenueGrowth: number;          // % change last 2 months with data

  // Outstanding
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
  overdueDetails: OverdueDetail[];
  avgDaysToPayment: number;       // DSO

  // Pipeline
  quotePipeline: number;          // sent + draft quotes
  quoteWinRate: number;           // accepted / (accepted + rejected + expired) %
  avgQuoteValue: number;

  // Profit. `null` = NOT KNOWN and must render as an omitted value, never 0.
  //
  // These were `invoiced * 0.30` — a hardcoded fraction of revenue, so the Geld
  // tab reported "KOSTEN 660,00 € · GEWINN 100,00 € · 13%" that no stored field
  // backed. It also disagreed with the P&L on the same month, which fabricated
  // differently (25% + 10%). Both are now summed from the real expense ledger.
  totalExpenses: number | null;
  netIncome: number | null;
  profitMargin: number | null;    // 0-100, GROSS of nothing — see costs above

  // Cash Flow
  monthlyInflows: number[];       // last 6 months payments received
  monthlyOutflows: number[];      // last 6 months RECORDED expenses (0 if none)
  netCashflow: number[];          // inflows - outflows
  projectedCashflow: number;      // next month estimate — see projectedIsNet
  /**
   * Whether `projectedCashflow` is a NET figure.
   *
   * False when no expenses have been recorded: outflows are then 0, so the
   * projection is of money coming IN, not of what is left after costs. The
   * number is real either way — what changes is what it may be called, and a
   * gross figure labelled "projected next month" quietly promises profit.
   */
  projectedIsNet: boolean;

  // Trends
  bestMonth: { month: string; amount: number } | null;
  worstMonth: { month: string; amount: number } | null;
  seasonalPattern: string;

  // Customer concentration
  topCustomers: CustomerConcentration[];
  concentrationRisk: boolean;     // true if top customer > 50%
}

// =============================================================================
// HELPERS
// =============================================================================

// Locale-aware, not a hardcoded English array: these labels go straight onto
// the Geld cashflow chart, where "May"/"Mar"/"Oct" are simply not Dutch.
function monthShort(monthIndex0: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short' })
      .format(new Date(2000, monthIndex0, 1));
  } catch {
    return new Intl.DateTimeFormat('en', { month: 'short' })
      .format(new Date(2000, monthIndex0, 1));
  }
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const m = parseInt(key.split('-')[1], 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return key;
  return monthShort(m - 1, i18n.language);
}

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Build an array of the last N month keys ending at `now` */
function lastNMonths(n: number, now: Date): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(getMonthKey(d));
  }
  return keys;
}

// =============================================================================
// CORE ANALYSIS
// =============================================================================

export function analyzeFinancials(
  invoices: Invoice[],
  quotes: Quote[],
  now: Date = new Date(),
  expenses?: Expense[],
  /**
   * The contractor's customers, so an invoice's customer can be resolved to a
   * NAME. `Invoice.customer` is a name on seeded rows and an id on anything
   * converted from an R13.2-era quote, and this function both GROUPS on that
   * value and renders it — so the same real customer could appear twice in
   * "Top customers", once under their name and once under `c-1787…`, and the
   * concentration percentages were computed over the split.
   */
  customers?: { id: string; name: string }[],
  /**
   * The contractor's effective VAT rate, in percent (0 for KOR /
   * Kleinunternehmer). Needed because `Invoice.amount` is GROSS while
   * `Expense.amount` is NET — the seed rows carry `amount: 125,
   * vatAmount: 26.25`, the entry form writes `vatAmount = amt * rate`, and the
   * VAT-prep screen has to re-gross it. Subtracting one from the other
   * reported a margin overstated by the whole VAT rate (€12.100 of paid
   * invoices minus €2.000 of costs read as 83% where the truth is 80%), and
   * `financialReportService` writes those figures into the P&L CSV handed to
   * the accountant (#354).
   *
   * VAT is neither income nor cost for a VAT-registered contractor: it passes
   * through. So both sides are stated NET.
   *
   * Omitted = the caller's amounts are already net. The one production caller
   * (`useFinancialAnalysis`) always passes it.
   */
  vatRatePercent?: number,
): FinancialSummary {
  // A paid invoice's GROSS back to the turnover an accountant would recognise.
  const toNet = (grossAmount: number): number =>
    vatRatePercent && vatRatePercent > 0
      ? Math.round((grossAmount / (1 + vatRatePercent / 100)) * 100) / 100
      : grossAmount;
  const customerLabel = (doc: { customerId?: string | null; customer?: string | null; customerName?: string | null }): string =>
    (doc.customerName as string | undefined)
    ?? (customers ? findDocumentCustomer(customers, doc)?.name : undefined)
    ?? doc.customer
    ?? '';
  // ---- Revenue from paid invoices ----
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalRevenue = Math.round(
    paidInvoices.reduce((s, i) => s + toNet(i.total || i.amount || 0), 0) * 100,
  ) / 100;

  // ---- Monthly buckets (last 12 months) ----
  const last12 = lastNMonths(12, now);
  const monthMap: Record<string, MonthlyBucket> = {};
  for (const mk of last12) {
    monthMap[mk] = { month: mk, label: getMonthLabel(mk), revenue: 0, invoiced: 0, expenses: 0 };
  }

  for (const inv of invoices) {
    const created = parseDate(inv.createdAt) || parseDate(inv.sentAt);
    if (created) {
      const mk = getMonthKey(created);
      if (monthMap[mk]) {
        monthMap[mk].invoiced += (inv.total || inv.amount || 0);
      }
    }
    if (inv.status === 'paid') {
      const paid = parseDate(inv.paidAt) || parseDate(inv.lastUpdated);
      if (paid) {
        const mk = getMonthKey(paid);
        if (monthMap[mk]) {
          // Net, like `totalRevenue` — the monthly chart and the headline
          // figure must be the same kind of number.
          monthMap[mk].revenue += toNet(inv.total || inv.amount || 0);
        }
      }
    }
  }

  const monthlyRevenue = last12.map(mk => monthMap[mk]);

  // REAL recorded expenses per month (receipt scanner + manual entry, via
  // expenseService). Was `invoiced * 0.30`, which is not a measurement of
  // anything — see the type above.
  for (const bucket of monthlyRevenue) {
    bucket.expenses = (expenses ?? [])
      .filter((e) => {
        const d = e.date instanceof Date ? e.date : new Date(e.date);
        return !Number.isNaN(d.getTime()) && getMonthKey(d) === bucket.month;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }
  // Nothing recorded anywhere = we do not know this contractor's costs. An
  // empty ledger is not a zero-cost business, and reporting 0 would make the
  // profit equal the revenue and the margin 100%.
  const hasExpenseData = (expenses ?? []).length > 0;

  // Average monthly revenue (only months with data)
  const monthsWithRevenue = monthlyRevenue.filter(m => m.revenue > 0);
  const avgMonthlyRevenue = monthsWithRevenue.length > 0
    ? monthsWithRevenue.reduce((s, m) => s + m.revenue, 0) / monthsWithRevenue.length
    : 0;

  // Revenue growth (compare last 2 months with data)
  let revenueGrowth = 0;
  if (monthsWithRevenue.length >= 2) {
    const curr = monthsWithRevenue[monthsWithRevenue.length - 1].revenue;
    const prev = monthsWithRevenue[monthsWithRevenue.length - 2].revenue;
    revenueGrowth = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  }

  // ---- Outstanding ----
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft');
  const totalOutstanding = unpaidInvoices.reduce((s, i) => s + (i.total || i.amount || 0), 0);

  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.total || i.amount || 0), 0);
  const overdueCount = overdueInvoices.length;

  const overdueDetails: OverdueDetail[] = overdueInvoices.map(inv => {
    // The shared calendar-day answer (utils/invoiceDue). This screen had its
    // own `Math.round(ms)` over a UTC-parsed key, so it read 15 in the German
    // afternoon and 14 in the morning, beside a queue card saying 14 (device
    // walk, 2026-09-14).
    const daysOverdue = invoiceDaysOverdue(inv, now) ?? 0;
    return {
      invoiceId: inv.id,
      customer: customerLabel(inv),
      amount: inv.total || inv.amount || 0,
      daysOverdue,
      dueDate: inv.dueDate || '',
    };
  }).sort((a, b) => b.daysOverdue - a.daysOverdue);

  // ---- DSO (Days Sales Outstanding) ----
  let totalDaysToPayment = 0;
  let dsoCount = 0;
  for (const inv of paidInvoices) {
    const sent = parseDate(inv.sentAt) || parseDate(inv.createdAt);
    const paid = parseDate(inv.paidAt);
    if (sent && paid) {
      totalDaysToPayment += Math.max(0, daysBetween(sent, paid));
      dsoCount++;
    }
  }
  const avgDaysToPayment = dsoCount > 0 ? Math.round(totalDaysToPayment / dsoCount) : 0;

  // ---- Pipeline ----
  const activeQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'draft');
  const quotePipeline = activeQuotes.reduce((s, q) => s + (q.amount || 0), 0);

  const decidedQuotes = quotes.filter(q =>
    q.status === 'accepted' || q.status === 'rejected' || q.status === 'expired'
  );
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted');
  // Below MIN_DECIDED_QUOTES a rate is noise: one accepted quote read as a
  // 100% win rate, and the projection below multiplied the whole pipeline by
  // it. 0 = unknown; every reader already gates on `> 0`. Same threshold as
  // eveLiveActionService's win-rate card (#311).
  const quoteWinRate = decidedQuotes.length >= MIN_DECIDED_QUOTES
    ? Math.round((acceptedQuotes.length / decidedQuotes.length) * 100)
    : 0;

  const avgQuoteValue = quotes.length > 0
    ? Math.round(quotes.reduce((s, q) => s + (q.amount || 0), 0) / quotes.length)
    : 0;

  // ---- Profit ----
  const totalExpenses = hasExpenseData
    ? monthlyRevenue.reduce((s, m) => s + m.expenses, 0)
    : null;
  const netIncome = totalExpenses === null ? null : totalRevenue - totalExpenses;
  const profitMargin = netIncome === null || totalRevenue <= 0
    ? null
    : Math.round((netIncome / totalRevenue) * 100);

  // ---- Cash flow arrays (last 6 months) ----
  const last6 = last12.slice(-6);
  const monthlyInflows = last6.map(mk => monthMap[mk]?.revenue || 0);
  const monthlyOutflows = last6.map(mk => monthMap[mk]?.expenses || 0);
  const netCashflow = monthlyInflows.map((inflow, i) => inflow - monthlyOutflows[i]);

  // Projected cashflow = trailing 3-month average net. With no recorded
  // expenses the "net" is just inflow, so this is an INCOME projection —
  // `projectedIsNet` tells the UI which word to use rather than letting the
  // figure imply the stronger claim.
  //
  // It USED to add `quotePipeline × winRate × 0.3 // 30% likely next month`.
  // On the German demo that was 31.840 × 100% (one decided quote) × 0.3 =
  // € 9.552 of a € 10.619 "Erwarteter Eingang" — 90% of the figure from a
  // typed-in 30% and a one-sample rate, directly under a 30-day forecast
  // saying € 5.380 (2026-09-14, learnings #327). Pipeline is its own KPI.
  const recentNet = netCashflow.slice(-3);
  const avgRecentNet = recentNet.length > 0
    ? recentNet.reduce((s, v) => s + v, 0) / recentNet.length
    : 0;
  const projectedCashflow = Math.round(avgRecentNet);

  // ---- Best / worst month ----
  let bestMonth: { month: string; amount: number } | null = null;
  let worstMonth: { month: string; amount: number } | null = null;
  for (const bucket of monthsWithRevenue) {
    if (!bestMonth || bucket.revenue > bestMonth.amount) {
      bestMonth = { month: bucket.label, amount: bucket.revenue };
    }
    if (!worstMonth || bucket.revenue < worstMonth.amount) {
      worstMonth = { month: bucket.label, amount: bucket.revenue };
    }
  }

  // Seasonal pattern description
  const q1 = monthlyRevenue.slice(0, 3).reduce((s, m) => s + m.revenue, 0);
  const q2 = monthlyRevenue.slice(3, 6).reduce((s, m) => s + m.revenue, 0);
  const q3 = monthlyRevenue.slice(6, 9).reduce((s, m) => s + m.revenue, 0);
  const q4 = monthlyRevenue.slice(9, 12).reduce((s, m) => s + m.revenue, 0);
  const quarters = [
    { label: 'Q1', total: q1 },
    { label: 'Q2', total: q2 },
    { label: 'Q3', total: q3 },
    { label: 'Q4', total: q4 },
  ].sort((a, b) => b.total - a.total);
  const peakQs = quarters.filter(q => q.total > 0).slice(0, 2).map(q => q.label).join('-');
  const dipQs = quarters.filter(q => q.total >= 0).slice(-1).map(q => q.label).join('');
  const seasonalPattern = peakQs && dipQs
    ? `${peakQs} peak, ${dipQs} dip`
    : 'Not enough data';

  // ---- Customer concentration ----
  const customerRevMap: Record<string, { revenue: number; count: number; customerId?: string }> = {};
  for (const inv of paidInvoices) {
    const name = customerLabel(inv);
    if (!customerRevMap[name]) customerRevMap[name] = { revenue: 0, count: 0, customerId: inv.customerId };
    // Net: "Top customers" and the concentration percentages are computed
    // over the same turnover the headline reports.
    customerRevMap[name].revenue += toNet(inv.total || inv.amount || 0);
    customerRevMap[name].count++;
  }
  const topCustomers: CustomerConcentration[] = Object.entries(customerRevMap)
    .map(([customer, data]) => ({
      customer,
      customerId: data.customerId,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
      invoiceCount: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // One paid invoice is 100% "concentration" by construction; the warning
  // told a contractor with a single paid job to diversify (2026-09-14).
  const concentrationRisk = paidInvoices.length >= MIN_PAID_INVOICES_FOR_CONCENTRATION
    && topCustomers.length > 0 && topCustomers[0].percentage > 50;

  return {
    totalRevenue,
    monthlyRevenue,
    avgMonthlyRevenue,
    revenueGrowth,
    totalOutstanding,
    overdueAmount,
    overdueCount,
    overdueDetails,
    avgDaysToPayment,
    quotePipeline,
    quoteWinRate,
    avgQuoteValue,
    totalExpenses,
    netIncome,
    projectedIsNet: hasExpenseData,
    profitMargin,
    monthlyInflows,
    monthlyOutflows,
    netCashflow,
    projectedCashflow,
    bestMonth,
    worstMonth,
    seasonalPattern,
    topCustomers,
    concentrationRisk,
  };
}

// =============================================================================
// REACT HOOK
// =============================================================================

export function useFinancialAnalysis(): FinancialSummary {
  const { invoices, quotes, customers, businessProfile } = useAppState();
  // Real recorded expenses — the receipt scanner and manual entry both write
  // here. Subscribed so a newly scanned receipt updates the Geld tab.
  const { expenses } = useExpenses();
  return useMemo(
    // The effective rate — 0 for KOR / Kleinunternehmer, so their gross IS
    // their net and nothing is divided.
    () => analyzeFinancials(
      invoices, quotes, new Date(), expenses,
      customers as { id: string; name: string }[],
      businessProfile ? getEffectiveVatRate(businessProfile) : 0,
    ),
    [invoices, quotes, expenses, customers, businessProfile],
  );
}
