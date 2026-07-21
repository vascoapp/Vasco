// =============================================================================
// FINANCIAL REPORT SERVICE
// =============================================================================
// P&L statements, quarterly summaries, CSV + PDF export.
// Leverages financialAnalysisService for all calculations.
// =============================================================================

import { formatMoney } from '../i18n/formatting';
import { Share, Platform } from 'react-native';
import { analyzeFinancials, type FinancialSummary, type MonthlyBucket } from './financialAnalysisService';
import type { Invoice, Quote } from '../domain/documents';

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

  // P&L lines
  revenue: number;
  costOfMaterials: number;
  grossProfit: number;
  operatingExpenses: number;
  netIncome: number;
  profitMargin: number;

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

function calculatePeriodFinancials(
  invoices: Invoice[],
  quotes: Quote[],
): { revenue: number; costOfMaterials: number; grossProfit: number; operatingExpenses: number; netIncome: number; profitMargin: number; invoiceCount: number; paidCount: number; overdueAmount: number; outstandingAmount: number } {
  const paid = invoices.filter(i => i.status === 'paid');
  const revenue = paid.reduce((s, i) => s + (i.total || i.amount || 0), 0);
  const costOfMaterials = Math.round(revenue * 0.25); // 25% material costs heuristic
  const grossProfit = revenue - costOfMaterials;
  const operatingExpenses = Math.round(revenue * 0.10); // 10% operating expenses heuristic
  const netIncome = grossProfit - operatingExpenses;
  const profitMargin = revenue > 0 ? Math.round((netIncome / revenue) * 100) : 0;

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

function buildLineItems(
  L: ReportLabels,
  current: { revenue: number; costOfMaterials: number; grossProfit: number; operatingExpenses: number; netIncome: number },
): PLLineItem[] {
  return [
    { label: L.revenue, amount: current.revenue, isSubtotal: true },
    { label: L.paidInvoices, amount: current.revenue, indent: 1 },
    { label: L.costOfMaterials, amount: -current.costOfMaterials },
    { label: L.grossProfit, amount: current.grossProfit, isSubtotal: true },
    { label: L.operatingExpenses, amount: -current.operatingExpenses },
    { label: L.netIncome, amount: current.netIncome, isTotal: true },
  ];
}

export function generateMonthlyReport(
  month: number,
  year: number,
  invoices: Invoice[],
  quotes: Quote[],
  labels: ReportLabels = DEFAULT_LABELS,
): FinancialReport {
  const currentInvoices = filterInvoicesByMonth(invoices, month, year);
  const current = calculatePeriodFinancials(currentInvoices, quotes);

  // Previous month for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevInvoices = filterInvoicesByMonth(invoices, prevMonth, prevYear);
  const prev = calculatePeriodFinancials(prevInvoices, quotes);

  const revenueChange = prev.revenue > 0
    ? Math.round(((current.revenue - prev.revenue) / prev.revenue) * 100)
    : 0;
  const netIncomeChange = prev.netIncome > 0
    ? Math.round(((current.netIncome - prev.netIncome) / prev.netIncome) * 100)
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
    previousNetIncome: prev.netIncome,
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
): FinancialReport {
  const currentInvoices = filterInvoicesByQuarter(invoices, quarter, year);
  const current = calculatePeriodFinancials(currentInvoices, quotes);

  // Previous quarter for comparison
  const prevQuarter = quarter === 1 ? 4 : quarter - 1;
  const prevYear = quarter === 1 ? year - 1 : year;
  const prevInvoices = filterInvoicesByQuarter(invoices, prevQuarter, prevYear);
  const prev = calculatePeriodFinancials(prevInvoices, quotes);

  const revenueChange = prev.revenue > 0
    ? Math.round(((current.revenue - prev.revenue) / prev.revenue) * 100)
    : 0;
  const netIncomeChange = prev.netIncome > 0
    ? Math.round(((current.netIncome - prev.netIncome) / prev.netIncome) * 100)
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
    previousNetIncome: prev.netIncome,
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
  lines.push(`"Generated","${new Date(report.generatedAt).toLocaleDateString()}"`);
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
  <div class="footer">Generated by Vasco on ${new Date(report.generatedAt).toLocaleDateString()}</div>
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
