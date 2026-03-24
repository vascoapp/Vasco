// =============================================================================
// PERIOD-END FINANCE SERVICE — Quarter-end aggregation for contractors
// =============================================================================
// Aggregates timesheets → payroll, invoices → VAT summary, expenses → tax prep.
// Produces a review package that can be exported to the accountant.
// =============================================================================

import i18n from '../i18n/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PeriodEndPackage {
  quarter: string; // e.g. "Q1 2026"
  period: { start: string; end: string };
  // Revenue
  revenue: {
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    invoiceCount: number;
    paidCount: number;
    overdueCount: number;
  };
  // VAT
  vat: {
    vatCollected: number;     // VAT on outgoing invoices
    vatDeductible: number;    // VAT on expenses (estimated)
    vatPayable: number;       // vatCollected - vatDeductible
    vatRate: number;           // primary rate
    country: string;
  };
  // Labor
  labor: {
    totalHours: number;
    jobCount: number;
    avgHoursPerJob: number;
    hourlyRate: number;        // implied from revenue / hours
  };
  // Expenses
  expenses: {
    totalMaterialCost: number;
    totalExpenses: number;
    expenseCount: number;
  };
  // Profitability
  profitability: {
    grossRevenue: number;
    totalCosts: number;
    grossProfit: number;
    marginPercent: number;
  };
  // Missing data alerts
  alerts: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// VAT rates by country
// ---------------------------------------------------------------------------

const VAT_RATES: Record<string, number> = {
  NL: 21, DE: 19, FR: 20, ES: 21, IT: 22, UK: 20,
};

// ---------------------------------------------------------------------------
// Generate period-end package
// ---------------------------------------------------------------------------

export function generatePeriodEndPackage(context: {
  invoices: any[];
  jobs: any[];
  quotes: any[];
  country: string;
  quarter?: string;
}): PeriodEndPackage {
  const t = i18n.t.bind(i18n);
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterStr = context.quarter || `Q${currentQuarter} ${now.getFullYear()}`;

  // Determine period boundaries
  const q = parseInt(quarterStr.replace(/Q(\d).*/, '$1'), 10) || currentQuarter;
  const year = parseInt(quarterStr.replace(/Q\d\s*(\d{4})/, '$1'), 10) || now.getFullYear();
  const startMonth = (q - 1) * 3;
  const periodStart = new Date(year, startMonth, 1).toISOString().split('T')[0];
  const periodEnd = new Date(year, startMonth + 3, 0).toISOString().split('T')[0];

  // Guard against undefined arrays
  const invoices = context.invoices ?? [];
  const allJobs = context.jobs ?? [];

  // Filter data to period
  const periodInvoices = invoices.filter((inv: any) => {
    const date = inv.createdAt || inv.lastUpdated || '';
    return date >= periodStart && date <= periodEnd + 'T23:59:59';
  });
  const periodJobs = allJobs.filter((j: any) => {
    const date = j.completedAt || j.createdAt || '';
    return date >= periodStart && date <= periodEnd + 'T23:59:59';
  });

  // Revenue
  const totalInvoiced = periodInvoices.reduce((s: number, i: any) => s + (i.amount || i.total || 0), 0);
  const paidInvoices = periodInvoices.filter((i: any) => i.status === 'paid');
  const totalPaid = paidInvoices.reduce((s: number, i: any) => s + (i.amount || i.total || 0), 0);
  const overdueInvoices = periodInvoices.filter((i: any) => i.status === 'overdue');

  // VAT
  const vatRate = VAT_RATES[context.country] || 21;
  // Extract VAT from gross amounts: gross * (rate / (100 + rate))
  // This is the reverse-calculation because invoiced amounts include VAT.
  const vatCollected = Math.round(totalInvoiced * (vatRate / (100 + vatRate)));

  // Labor
  const totalHours = periodJobs.reduce((s: number, j: any) => {
    const entries = j.timeEntries ?? [];
    return s + entries.reduce((hs: number, e: any) => hs + (e.hours ?? 0), 0);
  }, 0);
  const completedJobs = periodJobs.filter((j: any) => j.status === 'completed' || j.status === 'gereed');

  // Expenses (from job materials)
  const totalMaterialCost = periodJobs.reduce((s: number, j: any) => {
    const materials = j.materials ?? [];
    return s + materials.reduce((ms: number, m: any) => ms + (m.totalCost ?? 0), 0);
  }, 0);
  const laborCost = totalHours * 45; // rough hourly cost estimate
  // Same reverse-calculation for deductible VAT on material purchases
  const vatDeductible = Math.round(totalMaterialCost * (vatRate / (100 + vatRate)));

  // Profitability
  const totalCosts = totalMaterialCost + laborCost;
  const grossProfit = totalPaid - totalCosts;

  // Alerts
  const alerts: string[] = [];
  if (totalHours === 0) alerts.push(t('finance.noTimesheets', 'No timesheets logged this quarter'));
  if (overdueInvoices.length > 0) alerts.push(t('finance.overdueAlert', { defaultValue: '{{count}} overdue invoices', count: overdueInvoices.length }));
  if (totalMaterialCost === 0 && completedJobs.length > 0) alerts.push(t('finance.noMaterialCosts', 'No material costs recorded'));

  return {
    quarter: quarterStr,
    period: { start: periodStart, end: periodEnd },
    revenue: {
      totalInvoiced,
      totalPaid,
      totalOutstanding: totalInvoiced - totalPaid,
      invoiceCount: periodInvoices.length,
      paidCount: paidInvoices.length,
      overdueCount: overdueInvoices.length,
    },
    vat: {
      vatCollected,
      vatDeductible,
      vatPayable: vatCollected - vatDeductible,
      vatRate,
      country: context.country,
    },
    labor: {
      totalHours,
      jobCount: completedJobs.length,
      avgHoursPerJob: completedJobs.length > 0 ? Math.round(totalHours / completedJobs.length * 10) / 10 : 0,
      hourlyRate: totalHours > 0 ? Math.round(totalPaid / totalHours) : 0,
    },
    expenses: {
      totalMaterialCost,
      totalExpenses: totalCosts,
      expenseCount: periodJobs.reduce((s: number, j: any) => s + (j.materials?.length ?? 0), 0),
    },
    profitability: {
      grossRevenue: totalPaid,
      totalCosts,
      grossProfit,
      marginPercent: totalPaid > 0 ? Math.round((grossProfit / totalPaid) * 100) : 0,
    },
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Format for export (plain text summary for accountant)
// ---------------------------------------------------------------------------

export function formatPeriodEndForExport(pkg: PeriodEndPackage): string {
  const lines = [
    `=== ${pkg.quarter} Financial Summary ===`,
    `Period: ${pkg.period.start} to ${pkg.period.end}`,
    '',
    '--- Revenue ---',
    `Total invoiced: €${pkg.revenue.totalInvoiced.toLocaleString()}`,
    `Total paid: €${pkg.revenue.totalPaid.toLocaleString()}`,
    `Outstanding: €${pkg.revenue.totalOutstanding.toLocaleString()}`,
    `Invoices: ${pkg.revenue.invoiceCount} (${pkg.revenue.paidCount} paid, ${pkg.revenue.overdueCount} overdue)`,
    '',
    `--- VAT (${pkg.vat.country} ${pkg.vat.vatRate}%) ---`,
    `VAT collected: €${pkg.vat.vatCollected.toLocaleString()}`,
    `VAT deductible: €${pkg.vat.vatDeductible.toLocaleString()}`,
    `VAT payable: €${pkg.vat.vatPayable.toLocaleString()}`,
    '',
    '--- Labor ---',
    `Total hours: ${pkg.labor.totalHours}h`,
    `Jobs completed: ${pkg.labor.jobCount}`,
    `Avg hours/job: ${pkg.labor.avgHoursPerJob}h`,
    `Implied hourly rate: €${pkg.labor.hourlyRate}/h`,
    '',
    '--- Profitability ---',
    `Revenue: €${pkg.profitability.grossRevenue.toLocaleString()}`,
    `Costs: €${pkg.profitability.totalCosts.toLocaleString()}`,
    `Profit: €${pkg.profitability.grossProfit.toLocaleString()} (${pkg.profitability.marginPercent}%)`,
  ];
  if (pkg.alerts.length > 0) {
    lines.push('', '--- Alerts ---', ...pkg.alerts.map(a => `⚠ ${a}`));
  }
  lines.push('', `Generated: ${pkg.generatedAt}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Payroll summary — aggregate timesheet hours per job
// ---------------------------------------------------------------------------

export interface PayrollJobSummary {
  jobId: string;
  jobTitle: string;
  totalHours: number;
  entries: number;
}

export interface PayrollSummary {
  period: { start: string; end: string };
  totalHours: number;
  totalJobs: number;
  byJob: PayrollJobSummary[];
  generatedAt: string;
}

export function generatePayrollSummary(context: {
  jobs: any[];
  quarter?: string;
}): PayrollSummary {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterStr = context.quarter || `Q${currentQuarter} ${now.getFullYear()}`;

  const q = parseInt(quarterStr.replace(/Q(\d).*/, '$1'), 10) || currentQuarter;
  const year = parseInt(quarterStr.replace(/Q\d\s*(\d{4})/, '$1'), 10) || now.getFullYear();
  const startMonth = (q - 1) * 3;
  const periodStart = new Date(year, startMonth, 1).toISOString().split('T')[0];
  const periodEnd = new Date(year, startMonth + 3, 0).toISOString().split('T')[0];

  const allJobs = context.jobs ?? [];
  const periodJobs = allJobs.filter((j: any) => {
    const date = j.completedAt || j.createdAt || '';
    return date >= periodStart && date <= periodEnd + 'T23:59:59';
  });

  const byJob: PayrollJobSummary[] = [];
  let grandTotal = 0;

  for (const job of periodJobs) {
    const entries = job.timeEntries ?? [];
    if (entries.length === 0) continue;
    const hours = entries.reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
    grandTotal += hours;
    byJob.push({
      jobId: job.id,
      jobTitle: job.title || job.id,
      totalHours: Math.round(hours * 10) / 10,
      entries: entries.length,
    });
  }

  // Sort by hours descending
  byJob.sort((a, b) => b.totalHours - a.totalHours);

  return {
    period: { start: periodStart, end: periodEnd },
    totalHours: Math.round(grandTotal * 10) / 10,
    totalJobs: byJob.length,
    byJob,
    generatedAt: new Date().toISOString(),
  };
}
