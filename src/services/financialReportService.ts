// =============================================================================
// FINANCIAL REPORT SERVICE
// =============================================================================
// P&L statements, quarterly summaries, CSV + PDF export.
// Leverages financialAnalysisService for all calculations.
// =============================================================================

import { formatMoney, formatDateShortAuto } from '../i18n/formatting';
import { Share, Platform } from 'react-native';
import { analyzeFinancials, type FinancialSummary, type MonthlyBucket } from './financialAnalysisService';
import type { Invoice, Quote } from '../domain/documents';
import type { JobMaterial } from '../domain/materials';
import type { Expense } from './expenseService';

// =============================================================================
// TYPES
// =============================================================================

export interface PLLineItem {
  label: string;
  amount: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

export interface FinancialReport {
  title: string;
  period: string;
  generatedAt: string;
  type: 'monthly' | 'quarterly';

  // P&L lines.
  //
  // `null` means NOT KNOWN and must render as an omitted row — never as 0, and
  // never as a guess. Only `revenue` is always measurable (paid invoices).
  //
  // Every one of these was previously a percentage of revenue:
  //   costOfMaterials  = revenue * 0.25
  //   operatingExpenses = revenue * 0.10
  // …with grossProfit, netIncome and profitMargin derived from those. So a
  // report titled "Profit & Loss" — exported to the contractor's accountant as
  // PDF and CSV — carried four invented figures and one real one.
  revenue: number;
  /** Real, summed from the job materials behind the paid invoices. */
  costOfMaterials: number | null;
  /** revenue - costOfMaterials. Null when material cost is unknown. */
  grossProfit: number | null;
  /** Real, summed from recorded expenses in the period. Null when none exist. */
  operatingExpenses: number | null;
  /** revenue - materials - operating expenses. Null unless BOTH costs are known. */
  netIncome: number | null;
  /** GROSS margin (grossProfit/revenue). Null when material cost is unknown. */
  profitMargin: number | null;

  // Comparison
  previousRevenue: number;
  previousNetIncome: number;
  revenueChange: number;   // percentage
  netIncomeChange: number; // percentage

  // Detail breakdown
  lineItems: PLLineItem[];

  // Meta
  invoiceCount: number;
  paidInvoiceCount: number;
  overdueAmount: number;
  outstandingAmount: number;
}

// =============================================================================
// HELPERS
// =============================================================================

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getMonthKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function filterInvoicesByMonth(invoices: Invoice[], month: number, year: number): Invoice[] {
  const key = getMonthKey(month, year);
  return invoices.filter(inv => {
    const dateStr = inv.paidAt || inv.createdAt || inv.sentAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return mk === key;
  });
}

function filterInvoicesByQuarter(invoices: Invoice[], quarter: number, year: number): Invoice[] {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return invoices.filter(inv => {
    const dateStr = inv.paidAt || inv.createdAt || inv.sentAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    return d.getFullYear() === year && m >= startMonth && m <= endMonth;
  });
}

/** AppState keys job materials by jobId, so this is a direct lookup. */
export type JobMaterialsByJob = Record<string, JobMaterial[]>;

/**
 * Returns null when NO material row exists for these jobs.
 *
 * Finding nothing is not the same as spending nothing. Summing an empty set to
 * 0 asserts "this work consumed no materials", which for a plumber is close to
 * never true — and it propagates: 0 cost makes gross profit equal revenue and
 * the margin exactly 100%, which is the fabrication back in a new costume.
 * The demo's paid invoice has no linked job at all, so this is the common case,
 * not an edge one.
 */

function filterExpensesByMonth(expenses: Expense[], month: number, year: number): Expense[] {
  return expenses.filter(e => {
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

function filterExpensesByQuarter(expenses: Expense[], quarter: number, year: number): Expense[] {
  const startMonth = (quarter - 1) * 3 + 1;
  return expenses.filter(e => {
    const d = e.date instanceof Date ? e.date : new Date(e.date);
    if (Number.isNaN(d.getTime())) return false;
    const m = d.getMonth() + 1;
    return d.getFullYear() === year && m >= startMonth && m <= startMonth + 2;
  });
}

function sumMaterialCostForJobs(jobMaterials: JobMaterialsByJob, jobIds: Set<string>): number | null {
  let total = 0;
  let rows = 0;
  for (const jobId of jobIds) {
    for (const m of jobMaterials[jobId] ?? []) {
      // Fall back to unitPrice*quantity so a row saved before totalPrice
      // existed still counts — 0 would understate a real cost.
      total += m.totalPrice ?? (m.unitPrice ?? 0) * (m.quantity ?? 0);
      rows++;
    }
  }
  return rows === 0 ? null : total;
}


/**
 * Recorded operating expenses, EXCLUDING the material category.
 *
 * Materials already arrive through `costOfMaterials` (job materials), so
 * counting a `materiaal` expense here would subtract the same euro twice.
 * Returns null when nothing has been recorded — an empty ledger is not proof
 * of zero spending, the same rule applied to materials above.
 */
function sumOperatingExpenses(expenses: Expense[]): number | null {
  const operating = expenses.filter(e => e.category !== 'materiaal');
  if (operating.length === 0) return null;
  return operating.reduce((s, e) => s + (e.amount || 0), 0);
}

function calculatePeriodFinancials(
  invoices: Invoice[],
  quotes: Quote[],
  jobMaterials?: JobMaterialsByJob,
  expenses?: Expense[],
): { revenue: number; costOfMaterials: number | null; grossProfit: number | null; operatingExpenses: number | null; netIncome: number | null; profitMargin: number | null; invoiceCount: number; paidCount: number; overdueAmount: number; outstandingAmount: number } {
  const paid = invoices.filter(i => i.status === 'paid');
  const revenue = paid.reduce((s, i) => s + (i.total || i.amount || 0), 0);

  // REAL material cost: sum the job materials behind the paid invoices.
  // `jobMaterials` undefined = the caller cannot supply them, which is not the
  // same as "zero" — the whole line goes unknown rather than being guessed.
  const costOfMaterials = jobMaterials
    ? sumMaterialCostForJobs(jobMaterials, new Set(paid.map(i => i.jobId).filter(Boolean) as string[]))
    : null;
  const grossProfit = costOfMaterials === null ? null : revenue - costOfMaterials;

  // REAL operating expenses: recorded via the receipt scanner or entered by
  // hand (expenseService, persisted at @vasco_expenses). Material-category
  // expenses are EXCLUDED — they are already counted in costOfMaterials above
  // via the job materials, and double-counting a cost understates profit just
  // as badly as inventing one.
  //
  // Correcting my own earlier claim: an initial pass asserted the app captures
  // no expenses and hardcoded this to null. It does capture them; it simply
  // starts empty (R26 removed the fake seed rows).
  const operatingExpenses = expenses
    ? sumOperatingExpenses(expenses)
    : null;

  // Net income needs EVERY cost. Unknown if either half is unknown.
  const netIncome = grossProfit === null || operatingExpenses === null
    ? null
    : grossProfit - operatingExpenses;

  // Net margin when net income is known, otherwise the GROSS margin — never a
  // net figure derived from a partial cost picture.
  const marginBase = netIncome ?? grossProfit;
  const profitMargin = marginBase === null || revenue <= 0
    ? null
    : Math.round((marginBase / revenue) * 100);

  const overdue = invoices.filter(i => i.status === 'overdue');
  const overdueAmount = overdue.reduce((s, i) => s + (i.total || i.amount || 0), 0);
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft');
  const outstandingAmount = outstanding.reduce((s, i) => s + (i.total || i.amount || 0), 0);

  return {
    revenue,
    costOfMaterials,
    grossProfit,
    operatingExpenses,
    netIncome,
    profitMargin,
    invoiceCount: invoices.length,
    paidCount: paid.length,
    overdueAmount,
    outstandingAmount,
  };
}

// =============================================================================
// REPORT GENERATORS
// =============================================================================

// P&L row labels + month names are display strings — the screen and the
// CSV/PDF export both read them straight off the report. Callers pass a
// localised set so the whole report renders in the app locale; the English
// defaults keep existing callers (and tests) working unchanged.
export interface ReportLabels {
  plTitle: string;         // "P&L" / "W&V" / "GuV" …
  revenue: string;
  paidInvoices: string;
  costOfMaterials: string;
  grossProfit: string;
  operatingExpenses: string;
  netIncome: string;
  monthNames: string[];    // 12 localised month names
}

const DEFAULT_LABELS: ReportLabels = {
  plTitle: 'P&L',
  revenue: 'Revenue',
  paidInvoices: 'Paid invoices',
  costOfMaterials: 'Cost of Materials',
  grossProfit: 'Gross Profit',
  operatingExpenses: 'Operating Expenses',
  netIncome: 'Net Income',
  monthNames: MONTH_NAMES,
};

/**
 * A row is OMITTED when its value is unknown, never printed as 0.
 *
 * These items are what the screen renders AND what the CSV/PDF export writes,
 * so a placeholder here becomes a zero cost line in a document that goes to an
 * accountant. Operating expenses are always unknown today (no expense capture
 * exists), so the statement legitimately ends at gross profit.
 */
function buildLineItems(
  L: ReportLabels,
  current: { revenue: number; costOfMaterials: number | null; grossProfit: number | null; operatingExpenses: number | null; netIncome: number | null },
): PLLineItem[] {
  const rows: PLLineItem[] = [
    { label: L.revenue, amount: current.revenue, isSubtotal: true },
    { label: L.paidInvoices, amount: current.revenue, indent: 1 },
  ];
  if (current.costOfMaterials !== null) {
    rows.push({ label: L.costOfMaterials, amount: -current.costOfMaterials });
  }
  if (current.grossProfit !== null) {
    rows.push({ label: L.grossProfit, amount: current.grossProfit, isTotal: current.netIncome === null });
  }
  if (current.operatingExpenses !== null) {
    rows.push({ label: L.operatingExpenses, amount: -current.operatingExpenses });
  }
  if (current.netIncome !== null) {
    rows.push({ label: L.netIncome, amount: current.netIncome, isTotal: true });
  }
  return rows;
}

export function generateMonthlyReport(
  month: number,
  year: number,
  invoices: Invoice[],
  quotes: Quote[],
  labels: ReportLabels = DEFAULT_LABELS,
  jobMaterials?: JobMaterialsByJob,
  expenses?: Expense[],
): FinancialReport {
  const currentInvoices = filterInvoicesByMonth(invoices, month, year);
  const current = calculatePeriodFinancials(currentInvoices, quotes, jobMaterials, expenses && filterExpensesByMonth(expenses, month, year));

  // Previous month for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevInvoices = filterInvoicesByMonth(invoices, prevMonth, prevYear);
  const prev = calculatePeriodFinancials(prevInvoices, quotes, jobMaterials, expenses && filterExpensesByMonth(expenses, prevMonth, prevYear));

  const revenueChange = prev.revenue > 0
    ? Math.round(((current.revenue - prev.revenue) / prev.revenue) * 100)
    : 0;
  // Both periods must be KNOWN for a change to mean anything. With net income
  // unknown (no expense capture) this is 0 = "no claim", matching the omitted
  // row rather than inventing a trend.
  const netIncomeChange = (prev.netIncome ?? 0) > 0 && current.netIncome !== null
    ? Math.round(((current.netIncome - prev.netIncome!) / prev.netIncome!) * 100)
    : 0;

  const lineItems = buildLineItems(labels, current);
  const monthName = labels.monthNames[month - 1] ?? MONTH_NAMES[month - 1];

  return {
    title: `${labels.plTitle} — ${monthName} ${year}`,
    period: `${monthName} ${year}`,
    generatedAt: new Date().toISOString(),
    type: 'monthly',
    revenue: current.revenue,
    costOfMaterials: current.costOfMaterials,
    grossProfit: current.grossProfit,
    operatingExpenses: current.operatingExpenses,
    netIncome: current.netIncome,
    profitMargin: current.profitMargin,
    previousRevenue: prev.revenue,
    previousNetIncome: prev.netIncome ?? 0,
    revenueChange,
    netIncomeChange,
    lineItems,
    invoiceCount: current.invoiceCount,
    paidInvoiceCount: current.paidCount,
    overdueAmount: current.overdueAmount,
    outstandingAmount: current.outstandingAmount,
  };
}

export function generateQuarterlyReport(
  quarter: number,
  year: number,
  invoices: Invoice[],
  quotes: Quote[],
  labels: ReportLabels = DEFAULT_LABELS,
  jobMaterials?: JobMaterialsByJob,
  expenses?: Expense[],
): FinancialReport {
  const currentInvoices = filterInvoicesByQuarter(invoices, quarter, year);
  const current = calculatePeriodFinancials(currentInvoices, quotes, jobMaterials, expenses && filterExpensesByQuarter(expenses, quarter, year));

  // Previous quarter for comparison
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevYear = quarter === 1 ? year - 1 : year;
  const prevInvoices = filterInvoicesByQuarter(invoices, prevQuarter, prevYear);
  const prev = calculatePeriodFinancials(prevInvoices, quotes, jobMaterials, expenses && filterExpensesByQuarter(expenses, prevQuarter, prevYear));

  const revenueChange = prev.revenue > 0
    ? Math.round(((current.revenue - prev.revenue) / prev.revenue) * 100)
    : 0;
  // Both periods must be KNOWN for a change to mean anything. With net income
  // unknown (no expense capture) this is 0 = "no claim", matching the omitted
  // row rather than inventing a trend.
  const netIncomeChange = (prev.netIncome ?? 0) > 0 && current.netIncome !== null
    ? Math.round(((current.netIncome - prev.netIncome!) / prev.netIncome!) * 100)
    : 0;

  const startMonth = (quarter - 1) * 3;
  const mn = (i: number) => labels.monthNames[i] ?? MONTH_NAMES[i];
  const monthRange = `${mn(startMonth)} - ${mn(startMonth + 2)}`;

  const lineItems = buildLineItems(labels, current);

  return {
    title: `${labels.plTitle} — Q${quarter} ${year}`,
    period: `Q${quarter} ${year} (${monthRange})`,
    generatedAt: new Date().toISOString(),
    type: 'quarterly',
    revenue: current.revenue,
    costOfMaterials: current.costOfMaterials,
    grossProfit: current.grossProfit,
    operatingExpenses: current.operatingExpenses,
    netIncome: current.netIncome,
    profitMargin: current.profitMargin,
    previousRevenue: prev.revenue,
    previousNetIncome: prev.netIncome ?? 0,
    revenueChange,
    netIncomeChange,
    lineItems,
    invoiceCount: current.invoiceCount,
    paidInvoiceCount: current.paidCount,
    overdueAmount: current.overdueAmount,
    outstandingAmount: current.outstandingAmount,
  };
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

export function exportToCSV(report: FinancialReport): string {
  const lines: string[] = [];
  lines.push(`"${report.title}"`);
  lines.push(`"Period","${report.period}"`);
  lines.push(`"Generated","${formatDateShortAuto(new Date(report.generatedAt))}"`);
  lines.push('');
  lines.push('"Category","Amount"');

  for (const item of report.lineItems) {
    const prefix = item.indent ? '  ' : '';
    lines.push(`"${prefix}${item.label}","${item.amount.toFixed(2)}"`);
  }

  lines.push('');
  lines.push('"Summary"');
  lines.push(`"Profit Margin","${report.profitMargin}%"`);
  lines.push(`"Invoices","${report.invoiceCount}"`);
  lines.push(`"Paid Invoices","${report.paidInvoiceCount}"`);
  lines.push(`"Overdue Amount","${report.overdueAmount.toFixed(2)}"`);
  lines.push(`"Outstanding Amount","${report.outstandingAmount.toFixed(2)}"`);

  if (report.previousRevenue > 0) {
    lines.push('');
    lines.push('"Period Comparison"');
    lines.push(`"Revenue Change","${report.revenueChange}%"`);
    lines.push(`"Net Income Change","${report.netIncomeChange}%"`);
  }

  return lines.join('\n');
}

export function exportToPDFHtml(
  report: FinancialReport,
  businessName: string = 'My Business',
  formatAmount: (n: number) => string = (n) => `${formatMoney(n)}`,
): string {
  const lineItemsHtml = report.lineItems.map(item => {
    const cls = item.isTotal ? 'total' : item.isSubtotal ? 'subtotal' : '';
    const indent = item.indent ? 'padding-left: 24px;' : '';
    const amountStr = item.amount < 0
      ? `(${formatAmount(Math.abs(item.amount))})`
      : formatAmount(item.amount);
    return `<tr class="${cls}"><td style="${indent}">${item.label}</td><td class="amount">${amountStr}</td></tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 40px; color: #1A1A1A; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .period { color: #666; font-size: 14px; margin-bottom: 24px; }
  .business { font-size: 18px; color: #F26522; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  td { padding: 10px 0; border-bottom: 1px solid #E8E5E1; font-size: 14px; }
  .amount { text-align: right; font-variant-numeric: tabular-nums; }
  .subtotal td { font-weight: 600; }
  .total td { font-weight: 700; font-size: 16px; border-top: 2px solid #1A1A1A; border-bottom: 2px solid #1A1A1A; }
  .summary { margin-top: 32px; }
  .summary td { border-bottom: none; color: #666; font-size: 13px; }
  .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
</style>
</head>
<body>
  <div class="business">${businessName}</div>
  <h1>${report.title}</h1>
  <div class="period">${report.period}</div>
  <table>
    ${lineItemsHtml}
  </table>
  <table class="summary">
    <tr><td>Profit Margin</td><td class="amount">${report.profitMargin}%</td></tr>
    <tr><td>Invoices (total / paid)</td><td class="amount">${report.invoiceCount} / ${report.paidInvoiceCount}</td></tr>
    <tr><td>Overdue</td><td class="amount">${formatAmount(report.overdueAmount)}</td></tr>
    <tr><td>Outstanding</td><td class="amount">${formatAmount(report.outstandingAmount)}</td></tr>
    ${report.previousRevenue > 0 ? `
    <tr><td>Revenue vs previous period</td><td class="amount">${report.revenueChange > 0 ? '+' : ''}${report.revenueChange}%</td></tr>
    <tr><td>Net income vs previous period</td><td class="amount">${report.netIncomeChange > 0 ? '+' : ''}${report.netIncomeChange}%</td></tr>
    ` : ''}
  </table>
  <div class="footer">Generated by Vasco on ${formatDateShortAuto(new Date(report.generatedAt))}</div>
</body>
</html>`;
}

export async function shareCSV(report: FinancialReport): Promise<void> {
  const csv = exportToCSV(report);
  await Share.share({
    message: csv,
    title: report.title,
  });
}

export async function sharePDFHtml(
  report: FinancialReport,
  businessName?: string,
  formatAmount?: (n: number) => string,
): Promise<void> {
  const html = exportToPDFHtml(report, businessName, formatAmount);
  // expo-print would be used here for actual PDF generation
  // For now, share the HTML content
  await Share.share({
    message: html,
    title: `${report.title}.pdf`,
  });
}
