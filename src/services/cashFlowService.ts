// =============================================================================
// CASH FLOW FORECASTER SERVICE
// =============================================================================
// Predicts income/expenses, tracks invoices, provides payment reminders
// Analyzes seasonal patterns and invoice aging
// =============================================================================

import { formatMoney, formatMoney2 } from '../i18n/formatting';
import i18n from '../i18n/i18n';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { MS_PER_DAY } from '../utils/timeConstants';
import { daysOverdue } from '../utils/invoiceDue';

// The "low cash flow" alert used to hardcode "€5.000" into its sentence while
// the branch tested a bare `5000`, so the two could drift and the euro sign was
// wrong for any non-euro country. One constant now feeds both.
const LOW_BALANCE_THRESHOLD = 5000;

// ============================================
// TYPES
// ============================================

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  amount: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  remindersSent: number;
  lastReminderDate?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  category: 'materialen' | 'gereedschap' | 'voertuig' | 'verzekering' | 'overig';
  description: string;
  amount: number;
  date: string;
  projectId?: string;
  supplierId?: string;
  recurring: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  receiptUrl?: string;
}

export interface CashFlowForecast {
  period: string;
  expectedIncome: number;
  expectedExpenses: number;
  netCashFlow: number;
  /** null when the week expects no income -- nothing to be confident about. */
  confidence: number | null;
  breakdown: {
    invoicesDue: number;
    recurringIncome: number;
    scheduledExpenses: number;
    recurringExpenses: number;
  };
}

export interface InvoiceAging {
  current: { count: number; total: number };
  days30: { count: number; total: number };
  days60: { count: number; total: number };
  days90Plus: { count: number; total: number };
}

export interface PaymentReminder {
  id: string;
  invoiceId: string;
  customerName: string;
  amount: number;
  daysOverdue: number;
  suggestedAction: 'reminder' | 'call' | 'final_notice' | 'collection';
  messageTemplate: string;
}


export interface SeasonalPattern {
  month: string;
  /** 0-11 calendar month. Callers must not infer this from array position:
   *  months with no history are omitted, so the array is sparse. */
  monthIndex: number;
  avgIncome: number;
  avgExpenses: number;
  trend: 'high' | 'medium' | 'low';
  yearOverYear: number;
}

export interface CashFlowSummary {
  currentBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  projectedBalance30Days: number;
  healthScore: number;
  alerts: CashFlowAlert[];
}

export interface CashFlowAlert {
  id: string;
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  description: string;
  actionable: boolean;
  action?: string;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv_1',
    customerId: 'cust_1',
    customerName: 'Familie de Vries',
    projectId: 'proj_1',
    projectName: 'Schilderwerk woonkamer',
    amount: 2450,
    status: 'sent',
    issueDate: '2025-01-20',
    dueDate: '2025-02-03',
    remindersSent: 0,
  },
  {
    id: 'inv_2',
    customerId: 'cust_2',
    customerName: 'Bakkerij Jansen',
    projectId: 'proj_2',
    projectName: 'Badkamerrenovatie',
    amount: 8500,
    status: 'overdue',
    issueDate: '2025-01-05',
    dueDate: '2025-01-19',
    remindersSent: 2,
    lastReminderDate: '2025-01-26',
  },
  {
    id: 'inv_3',
    customerId: 'cust_3',
    customerName: 'Peter van den Berg',
    projectId: 'proj_3',
    projectName: 'Keukenrenovatie',
    amount: 5200,
    status: 'paid',
    issueDate: '2024-12-15',
    dueDate: '2024-12-29',
    paidDate: '2024-12-28',
    remindersSent: 0,
    paymentMethod: 'bank_transfer',
  },
  {
    id: 'inv_4',
    customerId: 'cust_4',
    customerName: 'Sandra Bakker',
    projectId: 'proj_4',
    projectName: 'Buitenschilderwerk',
    amount: 3800,
    status: 'viewed',
    issueDate: '2025-01-25',
    dueDate: '2025-02-08',
    remindersSent: 0,
  },
];

const MOCK_EXPENSES: Expense[] = [
  { id: 'exp_1', category: 'materialen', description: 'Verf en primer', amount: 485, date: '2025-01-28', projectId: 'proj_1', recurring: false },
  { id: 'exp_2', category: 'voertuig', description: 'Brandstof', amount: 180, date: '2025-01-25', recurring: true, recurringFrequency: 'weekly' },
  { id: 'exp_3', category: 'verzekering', description: 'Bedrijfsverzekering', amount: 245, date: '2025-01-01', recurring: true, recurringFrequency: 'monthly' },
  { id: 'exp_4', category: 'gereedschap', description: 'Nieuwe slijptol', amount: 189, date: '2025-01-15', recurring: false },
  { id: 'exp_5', category: 'materialen', description: 'Tegels badkamer', amount: 1250, date: '2025-01-10', projectId: 'proj_2', recurring: false },
];

// ============================================
// SERVICE CLASS
// ============================================

class CashFlowService {
  private invoices: Map<string, Invoice> = new Map();
  private expenses: Map<string, Expense> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // R26: dropped MOCK_INVOICES + MOCK_EXPENSES seed (was injecting "Familie
    // de Vries / Bakkerij Jansen / Peter van den Berg" fake customers + 5
    // fake expenses into every contractor's cashflow). Real data flows in
    // via the useCashFlow hook from AppState.invoices + useExpenses.
    // The MOCK_* exports below are kept for tests and can be re-injected via
    // __seedMockData() in test setups.
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_INVOICES.forEach((i) => this.invoices.set(i.id, i));
    MOCK_EXPENSES.forEach((e) => this.expenses.set(e.id, e));
  }

  // -----------------------------------------
  // Invoice Management
  // -----------------------------------------

  getInvoices(filter?: { status?: Invoice['status'] }): Invoice[] {
    let invoices = Array.from(this.invoices.values());
    if (filter?.status) invoices = invoices.filter((i) => i.status === filter.status);
    return invoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }

  /** @deprecated Reads the permanently-empty singleton — see computeInvoiceAging. */
  getInvoiceAging(): InvoiceAging {
    return computeInvoiceAging(this.getInvoices());
  }

  markInvoicePaid(invoiceId: string, paymentMethod: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = 'paid';
      invoice.paidDate = new Date().toISOString();
      invoice.paymentMethod = paymentMethod;
      this.notifyListeners();
      trackUserAction('invoice_paid', { invoiceId, amount: invoice.amount });

      // Record invoice outcome for intelligence calibration
      import('../intelligence/learningStorage').then(({ recordInvoiceOutcome }) => {
        recordInvoiceOutcome({
          invoiceId: invoice.id,
          amount: invoice.amount,
          issuedDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          paidDate: invoice.paidDate!,
          isOverdue: new Date(invoice.dueDate) < new Date(invoice.paidDate!),
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  sendReminder(invoiceId: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.remindersSent++;
      invoice.lastReminderDate = new Date().toISOString();
      this.notifyListeners();
      trackUserAction('invoice_reminder_sent', { invoiceId, reminderNumber: invoice.remindersSent });
    }
  }

  // -----------------------------------------
  // Expense Management
  // -----------------------------------------

  getExpenses(filter?: { category?: Expense['category']; projectId?: string }): Expense[] {
    let expenses = Array.from(this.expenses.values());
    if (filter?.category) expenses = expenses.filter((e) => e.category === filter.category);
    if (filter?.projectId) expenses = expenses.filter((e) => e.projectId === filter.projectId);
    return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  addExpense(expense: Omit<Expense, 'id'>): Expense {
    const newExpense: Expense = {
      ...expense,
      id: `exp_${Date.now()}`,
    };
    this.expenses.set(newExpense.id, newExpense);
    this.notifyListeners();
    trackUserAction('expense_added', { category: expense.category, amount: expense.amount });
    return newExpense;
  }

  // -----------------------------------------
  // Cash Flow Forecasting
  // -----------------------------------------

  getCashFlowForecast(weeks: number = 8): CashFlowForecast[] {
    return computeForecast(this.getInvoices(), this.getExpenses(), weeks);
  }

  getCashFlowSummary(): CashFlowSummary {
    const invoices = this.getInvoices();
    const pendingIncome = invoices
      .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.amount, 0);

    const pendingExpenses = this.getExpenses()
      .filter((e) => new Date(e.date) > new Date())
      .reduce((sum, e) => sum + e.amount, 0);

    const forecast = this.getCashFlowForecast(4);
    // Opens from money that actually landed. This used to start at a literal
    // 15000 -- the same invented opening balance R26 already removed from
    // `currentBalance` a few lines below, but left in place here. That made the
    // card self-contradictory: it showed a real current balance next to a
    // 30-day projection that had silently assumed EUR 15,000 in the bank.
    const paidTotal = this.getInvoices()
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);
    const projectedBalance30Days = paidTotal + forecast.reduce((sum, f) => sum + f.netCashFlow, 0);

    const overdue = invoices.filter((i) => i.status === 'overdue');
    const alerts: CashFlowAlert[] = [];

    if (overdue.length > 0) {
      const overdueTotal = overdue.reduce((sum, i) => sum + i.amount, 0);
      alerts.push({
        id: 'alert_overdue',
        type: 'warning',
        title: i18n.t('cashflow.alertOverdueTitle', { count: overdue.length }),
        description: i18n.t('cashflow.alertOverdueDesc', { amount: formatMoney(overdueTotal) }),
        actionable: true,
        action: i18n.t('cashflow.alertOverdueAction', 'Send reminders'),
      });
    }

    if (projectedBalance30Days < LOW_BALANCE_THRESHOLD) {
      alerts.push({
        id: 'alert_low_balance',
        type: 'warning',
        title: i18n.t('cashflow.alertLowCashTitle', 'Low cash flow expected'),
        // The threshold was baked into the sentence as a literal "€5.000",
        // which contradicted the actual 5000 test above for any non-euro
        // country. Format the same constant the branch compares against.
        description: i18n.t('cashflow.alertLowCashDesc', { amount: formatMoney(LOW_BALANCE_THRESHOLD) }),
        // Not actionable: this pointed at the "Financieringsopties" section,
        // which advertised credit from providers that do not exist and has
        // been removed. `actionable` only draws a chevron, and a chevron with
        // nowhere to go is a promise the screen cannot keep.
        actionable: false,
      });
    }

    const healthScore = Math.min(100, Math.max(0,
      50 +
      (overdue.length === 0 ? 20 : -overdue.length * 5) +
      (projectedBalance30Days > 10000 ? 30 : projectedBalance30Days > 5000 ? 15 : 0)
    ));

    // R26: was hardcoded 15000 — pure fiction for every contractor regardless
    // of actual finances. Now sums paid invoices (cash that's actually landed).
    const currentBalance = paidTotal;

    return {
      currentBalance,
      pendingIncome,
      pendingExpenses,
      projectedBalance30Days,
      healthScore,
      alerts,
    };
  }

  // -----------------------------------------
  // Payment Reminders
  // -----------------------------------------

  getPaymentReminders(): PaymentReminder[] {
    const now = new Date();
    return this.getInvoices()
      .filter((i) => i.status === 'overdue' || (i.status === 'sent' && new Date(i.dueDate) < now))
      .map((invoice) => {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        let suggestedAction: PaymentReminder['suggestedAction'] = 'reminder';
        if (daysOverdue > 60) suggestedAction = 'collection';
        else if (daysOverdue > 30) suggestedAction = 'final_notice';
        else if (daysOverdue > 14) suggestedAction = 'call';

        return {
          id: `rem_${invoice.id}`,
          invoiceId: invoice.id,
          customerName: invoice.customerName,
          amount: invoice.amount,
          daysOverdue,
          suggestedAction,
          messageTemplate: this.getMessageTemplate(suggestedAction, invoice),
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  private getMessageTemplate(action: PaymentReminder['suggestedAction'], invoice: Invoice): string {
    switch (action) {
      case 'reminder':
        return `Beste ${invoice.customerName}, graag herinneren wij u aan factuur #${invoice.id} van ${formatMoney2(invoice.amount)}. Wilt u deze binnen 7 dagen voldoen?`;
      case 'call':
        return `Telefonisch contact opnemen over factuur #${invoice.id} (${formatMoney2(invoice.amount)})`;
      case 'final_notice':
        return `LAATSTE HERINNERING: Factuur #${invoice.id} van ${formatMoney2(invoice.amount)} is nog niet voldaan. Betaal binnen 7 dagen om incassokosten te voorkomen.`;
      case 'collection':
        return `Incassoprocedure starten voor factuur #${invoice.id} (${formatMoney2(invoice.amount)})`;
    }
  }

  // -----------------------------------------
  // Seasonal Patterns
  // -----------------------------------------

  getSeasonalPatterns(): SeasonalPattern[] {
    // Delegates to the pure aggregator over whatever this singleton holds.
    // In practice the app uses `useCashFlow().seasonalPatterns`, which feeds
    // it the contractor's real AppState invoices and expenses.
    return computeSeasonalPatterns(this.getInvoices(), this.getExpenses());
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

export const cashFlowService = new CashFlowService();

// ============================================
// REACT HOOKS
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../state/AppState';
import { useExpenses } from './expenseService';

// ---------------------------------------------------------------------------
// Forecast — pure, so the hook can feed it the contractor's real data
// ---------------------------------------------------------------------------
// This lived on the service class and read `this.invoices`, which R26 left
// permanently empty (real invoices flow through AppState, not the singleton).
// The hook called it anyway -- with `[invoices, expenses]` in its dependency
// array but nothing in the body using them -- so the 8-week chart was computed
// from an empty invoice set for every contractor. The flat EUR 2,500/week of
// invented recurring income was the only thing making it look populated; with
// that removed the emptiness became visible as a row of zeroes despite real
// outstanding invoices sitting one tab away.
// ---------------------------------------------------------------------------
// Invoice aging — pure, for exactly the same reason as the forecast below
// ---------------------------------------------------------------------------
// This had the identical defect one line further down in the hook:
// `useMemo(() => cashFlowService.getInvoiceAging(), [invoices])` — the real
// invoices in the dependency array, the empty singleton in the body. So the
// aging table read € 0,00 / 0 facturen in all four buckets while the alert at
// the top of the SAME screen said "2 openstaande facturen · € 800 aan
// betalingen zijn verlopen". The one card whose entire job is to show how old
// the overdue invoices are was the one card that could not see them.
//
// Buckets on calendar days via the shared `daysOverdue` helper, so this screen
// and the Geld tab cannot drift on what "14 days late" means.
export function computeInvoiceAging(invoices: Invoice[], now: Date = new Date()): InvoiceAging {
  const aging: InvoiceAging = {
    current: { count: 0, total: 0 },
    days30: { count: 0, total: 0 },
    days60: { count: 0, total: 0 },
    days90Plus: { count: 0, total: 0 },
  };

  invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
    .forEach((invoice) => {
      const late = daysOverdue(invoice, now) ?? 0;
      const bucket = late <= 0 ? aging.current
        : late <= 30 ? aging.days30
        : late <= 60 ? aging.days60
        : aging.days90Plus;
      bucket.count++;
      bucket.total += invoice.amount;
    });

  return aging;
}

export function computeForecast(
  invoices: Invoice[],
  expenses: Expense[],
  weeks: number = 8,
): CashFlowForecast[] {
  const forecasts: CashFlowForecast[] = [];
  const now = new Date();

  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const inWeek = (iso: string) => {
      const d = new Date(iso);
      return d >= weekStart && d <= weekEnd;
    };

    const unpaidDue = invoices.filter((inv) => inv.status !== 'paid' && inWeek(inv.dueDate));
    const invoicesDue = unpaidDue.reduce((sum, inv) => sum + inv.amount, 0);

    // No recurring-income source exists in the data model (only expenses carry
    // a `recurring` flag), so there is nothing to derive this from. It was a
    // flat 2500/week literal.
    const recurringIncome = 0;

    const scheduledExpenses = expenses
      .filter((exp) => !exp.recurring && inWeek(exp.date))
      .reduce((sum, exp) => sum + exp.amount, 0);

    const recurringExpenses = expenses
      .filter((exp) => exp.recurring && exp.recurringFrequency === 'weekly')
      .reduce((sum, exp) => sum + exp.amount, 0) +
      (i % 4 === 0
        ? expenses
            .filter((exp) => exp.recurring && exp.recurringFrequency === 'monthly')
            .reduce((sum, exp) => sum + exp.amount, 0)
        : 0);

    // An invoice the customer has actually received is committed; a draft is not.
    const committedIncome = unpaidDue
      .filter((inv) => inv.status !== 'draft')
      .reduce((sum, inv) => sum + inv.amount, 0);

    const expectedIncome = invoicesDue + recurringIncome;
    const expectedExpenses = scheduledExpenses + recurringExpenses;

    forecasts.push({
      period: i18n.t('cashflow.weekN', { n: i + 1 }),
      expectedIncome,
      expectedExpenses,
      netCashFlow: expectedIncome - expectedExpenses,
      // Share of this week's expected income backed by an invoice the customer
      // has actually been sent. Was `0.95 - i * 0.05`: the week index dressed
      // up as a percentage and rendered next to real money as "90%", "85%".
      // null when the week expects nothing -- there is no confidence to report
      // about an empty week, and "100%" beside EUR 0,00 reads as a claim.
      confidence: expectedIncome > 0 ? committedIncome / expectedIncome : null,
      breakdown: {
        invoicesDue,
        recurringIncome,
        scheduledExpenses,
        recurringExpenses,
      },
    });
  }

  return forecasts;
}

// ---------------------------------------------------------------------------
// Seasonal patterns — computed from real history
// ---------------------------------------------------------------------------
// This used to `return` a literal twelve-row table (Jan 18000 / Feb 20000 /
// ... / Mei 42000), so every contractor on every account saw the same invented
// monthly averages and the same year-over-year percentages, presented as their
// own seasonality. Nothing about it responded to their data.
//
// Now it aggregates the contractor's actual invoices and expenses by calendar
// month. Months with no history are omitted rather than zero-filled, and
// yearOverYear is only produced when the same month exists in two different
// years -- with a single year of history there is nothing to compare against,
// so it stays 0 instead of implying a trend.
export function computeSeasonalPatterns(
  invoices: Invoice[],
  expenses: Expense[],
): SeasonalPattern[] {
  // month index -> year -> total
  const income = new Map<number, Map<number, number>>();
  const spend = new Map<number, Map<number, number>>();

  const add = (bucket: Map<number, Map<number, number>>, iso: string, amount: number) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    const m = d.getMonth();
    const y = d.getFullYear();
    if (!bucket.has(m)) bucket.set(m, new Map());
    const byYear = bucket.get(m)!;
    byYear.set(y, (byYear.get(y) ?? 0) + amount);
  };

  // Only money that actually landed counts as income for a past month; a draft
  // or still-open invoice is not evidence about that month's seasonality.
  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    add(income, inv.issueDate, inv.amount);
  }
  for (const exp of expenses) add(spend, exp.date, exp.amount);

  const months = Array.from(new Set([...income.keys(), ...spend.keys()])).sort((a, b) => a - b);
  if (months.length === 0) return [];

  const mean = (byYear?: Map<number, number>) => {
    if (!byYear || byYear.size === 0) return 0;
    let total = 0;
    for (const v of byYear.values()) total += v;
    return total / byYear.size;
  };

  const rows = months.map((m) => {
    const byYear = income.get(m);
    const avgIncome = mean(byYear);
    const avgExpenses = mean(spend.get(m));

    // Year over year needs the same month in two different years.
    let yearOverYear = 0;
    if (byYear && byYear.size >= 2) {
      const years = Array.from(byYear.keys()).sort((a, b) => a - b);
      const prev = byYear.get(years[years.length - 2]) ?? 0;
      const latest = byYear.get(years[years.length - 1]) ?? 0;
      if (prev > 0) yearOverYear = Math.round(((latest - prev) / prev) * 100);
    }

    return { monthIndex: m, avgIncome, avgExpenses, yearOverYear };
  });

  // `trend` is relative to this contractor's own average month, not an
  // absolute euro threshold -- a one-person painter and a ten-crew firm have
  // very different "high" months.
  const overall = rows.reduce((sum, r) => sum + r.avgIncome, 0) / rows.length;
  const label = (m: number) => {
    const d = new Date(2000, m, 1);
    try {
      return new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(d);
    } catch {
      return String(m + 1);
    }
  };

  return rows.map((r) => ({
    month: label(r.monthIndex),
    monthIndex: r.monthIndex,
    avgIncome: Math.round(r.avgIncome),
    avgExpenses: Math.round(r.avgExpenses),
    trend: overall <= 0
      ? ('medium' as const)
      : r.avgIncome > overall * 1.15
        ? ('high' as const)
        : r.avgIncome < overall * 0.85
          ? ('low' as const)
          : ('medium' as const),
    yearOverYear: r.yearOverYear,
  }));
}

export function useCashFlow() {
  const { invoices: appInvoices } = useAppState();
  // R26: real expenses from canonical expenseService (was mock singleton).
  // expenseService stores per-contractor in AsyncStorage + Supabase via R262.
  const { expenses: appExpenses } = useExpenses();

  // Map AppState invoices → CashFlowService Invoice shape
  const invoices = useMemo<Invoice[]>(() =>
    appInvoices.map((inv) => ({
      id: inv.id,
      customerId: inv.customerId ?? inv.customer ?? '',
      customerName: inv.customerName ?? inv.customer ?? '',
      projectId: inv.jobId ?? inv.job ?? '',
      projectName: inv.job ?? '',
      amount: inv.amount ?? 0,
      status: inv.status === 'draft' ? 'draft' as const
        : inv.status === 'sent' ? 'sent' as const
        : inv.status === 'paid' ? 'paid' as const
        : inv.status === 'overdue' ? 'overdue' as const
        : 'draft' as const,
      issueDate: inv.sentAt ?? inv.createdAt ?? new Date().toISOString(),
      dueDate: inv.dueDate ?? new Date(Date.now() + (inv.dueInDays ?? 30) * MS_PER_DAY).toISOString().split('T')[0],
      paidDate: inv.paidAt,
      remindersSent: 0,
    })),
    [appInvoices],
  );

  // R26: real expenses from canonical expenseService (was MOCK_EXPENSES singleton).
  // Map expenseService.Expense shape → cashFlowService.Expense shape.
  const expenses = useMemo<Expense[]>(() => {
    const catMap: Record<string, Expense['category']> = {
      materiaal: 'materialen',
      voertuig: 'voertuig',
      gereedschap: 'gereedschap',
      verzekering: 'verzekering',
      kantoor: 'overig',
      opleiding: 'overig',
      reis: 'overig',
      overig: 'overig',
    };
    return appExpenses.map((e) => ({
      id: e.id,
      category: catMap[e.category] ?? 'overig',
      description: e.description,
      amount: e.amount + (e.vatAmount ?? 0),
      date: (e.date instanceof Date ? e.date : new Date(e.date)).toISOString().slice(0, 10),
      projectId: e.jobId,
      receiptUrl: e.receiptUrl,
      recurring: false,
    }));
  }, [appExpenses]);

  // Build summary from real invoices
  const summary = useMemo<CashFlowSummary>(() => {
    const pendingIncome = invoices
      .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.amount, 0);

    const pendingExpenses = expenses
      .filter((e) => new Date(e.date) > new Date())
      .reduce((sum, e) => sum + e.amount, 0);

    const paidTotal = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.amount, 0);

    const overdue = invoices.filter((i) => i.status === 'overdue');
    const alerts: CashFlowAlert[] = [];

    if (overdue.length > 0) {
      const overdueTotal = overdue.reduce((sum, i) => sum + i.amount, 0);
      alerts.push({
        id: 'alert_overdue',
        type: 'warning',
        title: i18n.t('cashflow.alertOverdueTitle', { count: overdue.length }),
        description: i18n.t('cashflow.alertOverdueDesc', { amount: formatMoney(overdueTotal) }),
        actionable: true,
        action: i18n.t('cashflow.alertOverdueAction', 'Send reminders'),
      });
    }

    const projectedBalance30Days = paidTotal + pendingIncome - pendingExpenses;

    if (projectedBalance30Days < LOW_BALANCE_THRESHOLD) {
      alerts.push({
        id: 'alert_low_balance',
        type: 'warning',
        title: i18n.t('cashflow.alertLowCashTitle', 'Low cash flow expected'),
        // The threshold was baked into the sentence as a literal "€5.000",
        // which contradicted the actual 5000 test above for any non-euro
        // country. Format the same constant the branch compares against.
        description: i18n.t('cashflow.alertLowCashDesc', { amount: formatMoney(LOW_BALANCE_THRESHOLD) }),
        // Not actionable: this pointed at the "Financieringsopties" section,
        // which advertised credit from providers that do not exist and has
        // been removed. `actionable` only draws a chevron, and a chevron with
        // nowhere to go is a promise the screen cannot keep.
        actionable: false,
      });
    }

    const healthScore = Math.min(100, Math.max(0,
      50 +
      (overdue.length === 0 ? 20 : -overdue.length * 5) +
      (projectedBalance30Days > 10000 ? 30 : projectedBalance30Days > 5000 ? 15 : 0)
    ));

    return {
      currentBalance: paidTotal,
      pendingIncome,
      pendingExpenses,
      projectedBalance30Days,
      healthScore,
      alerts,
    };
  }, [invoices, expenses]);

  const aging = useMemo(() => computeInvoiceAging(invoices), [invoices]);
  const forecast = useMemo(() => computeForecast(invoices, expenses, 8), [invoices, expenses]);

  const markPaid = useCallback((invoiceId: string, method: string) => {
    cashFlowService.markInvoicePaid(invoiceId, method);
  }, []);

  const sendReminder = useCallback((invoiceId: string) => {
    cashFlowService.sendReminder(invoiceId);
  }, []);

  const addExpense = useCallback((expense: Omit<Expense, 'id'>) => {
    return cashFlowService.addExpense(expense);
  }, []);

  // Real seasonality, derived from this contractor's own paid invoices and
  // recorded expenses. Empty until there is history to aggregate.
  const seasonalPatterns = useMemo(
    () => computeSeasonalPatterns(invoices, expenses),
    [invoices, expenses],
  );

  return {
    invoices,
    expenses,
    summary,
    aging,
    forecast,
    seasonalPatterns,
    markPaid,
    sendReminder,
    addExpense,
  };
}

export function usePaymentReminders() {
  const [reminders, setReminders] = useState<PaymentReminder[]>(() => cashFlowService.getPaymentReminders());

  useEffect(() => {
    const unsubscribe = cashFlowService.subscribe(() => {
      setReminders(cashFlowService.getPaymentReminders());
    });
    return unsubscribe;
  }, []);

  return { reminders, sendReminder: cashFlowService.sendReminder.bind(cashFlowService) };
}

// Reads the contractor's real invoices/expenses out of AppState. Previously
// this called the singleton, which R26 left permanently empty -- so it returned
// the hardcoded twelve-month table for everyone, forever.
export function useSeasonalPatterns() {
  return useCashFlow().seasonalPatterns;
}
