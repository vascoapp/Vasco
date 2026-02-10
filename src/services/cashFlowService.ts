// =============================================================================
// CASH FLOW FORECASTER SERVICE
// =============================================================================
// Predicts income/expenses, tracks invoices, provides payment reminders
// Analyzes seasonal patterns and offers financing suggestions
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

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
  confidence: number;
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

export interface FinancingSuggestion {
  id: string;
  type: 'invoice_factoring' | 'credit_line' | 'payment_plan';
  title: string;
  description: string;
  potentialAmount: number;
  estimatedCost: number;
  provider?: string;
  requirements: string[];
}

export interface SeasonalPattern {
  month: string;
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

  getInvoiceAging(): InvoiceAging {
    const now = new Date();
    const unpaid = this.getInvoices().filter((i) => i.status !== 'paid' && i.status !== 'cancelled');

    const aging: InvoiceAging = {
      current: { count: 0, total: 0 },
      days30: { count: 0, total: 0 },
      days60: { count: 0, total: 0 },
      days90Plus: { count: 0, total: 0 },
    };

    unpaid.forEach((invoice) => {
      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 0) {
        aging.current.count++;
        aging.current.total += invoice.amount;
      } else if (daysOverdue <= 30) {
        aging.days30.count++;
        aging.days30.total += invoice.amount;
      } else if (daysOverdue <= 60) {
        aging.days60.count++;
        aging.days60.total += invoice.amount;
      } else {
        aging.days90Plus.count++;
        aging.days90Plus.total += invoice.amount;
      }
    });

    return aging;
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
    const forecasts: CashFlowForecast[] = [];
    const now = new Date();

    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Calculate expected income from invoices due this week
      const invoicesDue = this.getInvoices()
        .filter((inv) => {
          const dueDate = new Date(inv.dueDate);
          return inv.status !== 'paid' && dueDate >= weekStart && dueDate <= weekEnd;
        })
        .reduce((sum, inv) => sum + inv.amount, 0);

      // Recurring income estimate
      const recurringIncome = i === 0 ? 0 : 2500; // Simplified

      // Scheduled expenses
      const scheduledExpenses = this.getExpenses()
        .filter((exp) => {
          const expDate = new Date(exp.date);
          return !exp.recurring && expDate >= weekStart && expDate <= weekEnd;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);

      // Recurring expenses
      const recurringExpenses = this.getExpenses()
        .filter((exp) => exp.recurring && exp.recurringFrequency === 'weekly')
        .reduce((sum, exp) => sum + exp.amount, 0) +
        (i % 4 === 0
          ? this.getExpenses()
              .filter((exp) => exp.recurring && exp.recurringFrequency === 'monthly')
              .reduce((sum, exp) => sum + exp.amount, 0)
          : 0);

      const expectedIncome = invoicesDue + recurringIncome;
      const expectedExpenses = scheduledExpenses + recurringExpenses;

      forecasts.push({
        period: `Week ${i + 1}`,
        expectedIncome,
        expectedExpenses,
        netCashFlow: expectedIncome - expectedExpenses,
        confidence: Math.max(0.5, 0.95 - i * 0.05),
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

  getCashFlowSummary(): CashFlowSummary {
    const invoices = this.getInvoices();
    const pendingIncome = invoices
      .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + i.amount, 0);

    const pendingExpenses = this.getExpenses()
      .filter((e) => new Date(e.date) > new Date())
      .reduce((sum, e) => sum + e.amount, 0);

    const forecast = this.getCashFlowForecast(4);
    const projectedBalance30Days = 15000 + forecast.reduce((sum, f) => sum + f.netCashFlow, 0);

    const overdue = invoices.filter((i) => i.status === 'overdue');
    const alerts: CashFlowAlert[] = [];

    if (overdue.length > 0) {
      const overdueTotal = overdue.reduce((sum, i) => sum + i.amount, 0);
      alerts.push({
        id: 'alert_overdue',
        type: 'warning',
        title: `${overdue.length} openstaande facturen`,
        description: `€${overdueTotal.toLocaleString('nl-NL')} aan betalingen zijn verlopen`,
        actionable: true,
        action: 'Stuur herinneringen',
      });
    }

    if (projectedBalance30Days < 5000) {
      alerts.push({
        id: 'alert_low_balance',
        type: 'warning',
        title: 'Lage cashflow verwacht',
        description: 'Je saldo kan binnen 30 dagen onder €5.000 komen',
        actionable: true,
        action: 'Bekijk financieringsopties',
      });
    }

    const healthScore = Math.min(100, Math.max(0,
      50 +
      (overdue.length === 0 ? 20 : -overdue.length * 5) +
      (projectedBalance30Days > 10000 ? 30 : projectedBalance30Days > 5000 ? 15 : 0)
    ));

    return {
      currentBalance: 15000,
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
        return `Beste ${invoice.customerName}, graag herinneren wij u aan factuur #${invoice.id} van €${invoice.amount}. Wilt u deze binnen 7 dagen voldoen?`;
      case 'call':
        return `Telefonisch contact opnemen over factuur #${invoice.id} (€${invoice.amount})`;
      case 'final_notice':
        return `LAATSTE HERINNERING: Factuur #${invoice.id} van €${invoice.amount} is nog niet voldaan. Betaal binnen 7 dagen om incassokosten te voorkomen.`;
      case 'collection':
        return `Incassoprocedure starten voor factuur #${invoice.id} (€${invoice.amount})`;
    }
  }

  // -----------------------------------------
  // Financing Suggestions
  // -----------------------------------------

  getFinancingSuggestions(): FinancingSuggestion[] {
    const aging = this.getInvoiceAging();
    const suggestions: FinancingSuggestion[] = [];

    if (aging.days30.total + aging.days60.total > 2000) {
      suggestions.push({
        id: 'fin_factoring',
        type: 'invoice_factoring',
        title: 'Factoring',
        description: 'Verkoop je openstaande facturen voor direct werkkapitaal',
        potentialAmount: Math.round((aging.days30.total + aging.days60.total) * 0.9),
        estimatedCost: Math.round((aging.days30.total + aging.days60.total) * 0.03),
        provider: 'Vasco Financing',
        requirements: ['Geverifieerde facturen', 'Zakelijke klanten'],
      });
    }

    const summary = this.getCashFlowSummary();
    if (summary.projectedBalance30Days < 10000) {
      suggestions.push({
        id: 'fin_credit',
        type: 'credit_line',
        title: 'Zakelijk krediet',
        description: 'Flexibele kredietlijn voor werkkapitaal',
        potentialAmount: 25000,
        estimatedCost: 250,
        provider: 'Vasco Business Credit',
        requirements: ['6+ maanden actief', 'Positieve cashflow historie'],
      });
    }

    return suggestions;
  }

  // -----------------------------------------
  // Seasonal Patterns
  // -----------------------------------------

  getSeasonalPatterns(): SeasonalPattern[] {
    const months = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const patterns: SeasonalPattern[] = [
      { month: 'Jan', avgIncome: 18000, avgExpenses: 12000, trend: 'low', yearOverYear: -5 },
      { month: 'Feb', avgIncome: 20000, avgExpenses: 13000, trend: 'low', yearOverYear: 2 },
      { month: 'Mrt', avgIncome: 28000, avgExpenses: 16000, trend: 'medium', yearOverYear: 8 },
      { month: 'Apr', avgIncome: 35000, avgExpenses: 20000, trend: 'high', yearOverYear: 12 },
      { month: 'Mei', avgIncome: 42000, avgExpenses: 24000, trend: 'high', yearOverYear: 15 },
      { month: 'Jun', avgIncome: 40000, avgExpenses: 23000, trend: 'high', yearOverYear: 10 },
      { month: 'Jul', avgIncome: 32000, avgExpenses: 18000, trend: 'medium', yearOverYear: 5 },
      { month: 'Aug', avgIncome: 28000, avgExpenses: 16000, trend: 'medium', yearOverYear: 3 },
      { month: 'Sep', avgIncome: 38000, avgExpenses: 22000, trend: 'high', yearOverYear: 8 },
      { month: 'Okt', avgIncome: 30000, avgExpenses: 18000, trend: 'medium', yearOverYear: 4 },
      { month: 'Nov', avgIncome: 22000, avgExpenses: 14000, trend: 'low', yearOverYear: -2 },
      { month: 'Dec', avgIncome: 16000, avgExpenses: 11000, trend: 'low', yearOverYear: -8 },
    ];
    return patterns;
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

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useCashFlow() {
  const [invoices, setInvoices] = useState<Invoice[]>(() => cashFlowService.getInvoices());
  const [expenses, setExpenses] = useState<Expense[]>(() => cashFlowService.getExpenses());

  useEffect(() => {
    const unsubscribe = cashFlowService.subscribe(() => {
      setInvoices(cashFlowService.getInvoices());
      setExpenses(cashFlowService.getExpenses());
    });
    return unsubscribe;
  }, []);

  const summary = useMemo(() => cashFlowService.getCashFlowSummary(), [invoices, expenses]);
  const aging = useMemo(() => cashFlowService.getInvoiceAging(), [invoices]);
  const forecast = useMemo(() => cashFlowService.getCashFlowForecast(8), [invoices, expenses]);

  const markPaid = useCallback((invoiceId: string, method: string) => {
    cashFlowService.markInvoicePaid(invoiceId, method);
  }, []);

  const sendReminder = useCallback((invoiceId: string) => {
    cashFlowService.sendReminder(invoiceId);
  }, []);

  const addExpense = useCallback((expense: Omit<Expense, 'id'>) => {
    return cashFlowService.addExpense(expense);
  }, []);

  return {
    invoices,
    expenses,
    summary,
    aging,
    forecast,
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

export function useFinancingSuggestions() {
  return useMemo(() => cashFlowService.getFinancingSuggestions(), []);
}

export function useSeasonalPatterns() {
  return useMemo(() => cashFlowService.getSeasonalPatterns(), []);
}
