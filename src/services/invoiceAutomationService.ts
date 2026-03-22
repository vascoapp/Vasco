// =============================================================================
// INVOICE AUTOMATION SERVICE
// =============================================================================
// Automated invoicing, payment tracking, and collection workflows
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface AutoInvoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerAddress: string;
  issueDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'reminded' | 'collection';
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  paymentMethod?: 'bank_transfer' | 'ideal' | 'card' | 'cash';
  paidDate?: Date;
  payments: PaymentRecord[];
  reminders: ReminderSent[];
  notes?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
}

export interface PaymentRecord {
  id: string;
  date: Date;
  amount: number;
  method: 'bank_transfer' | 'ideal' | 'card' | 'cash';
  reference?: string;
  type: 'deposit' | 'milestone' | 'final' | 'partial';
}

export interface ReminderSent {
  date: Date;
  type: 'friendly' | 'reminder' | 'urgent' | 'final';
  method: 'email' | 'sms';
  opened?: boolean;
}

export interface PaymentReminder {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  daysOverdue: number;
  suggestedAction: string;
  nextReminderType: 'friendly' | 'reminder' | 'urgent' | 'final' | 'collection';
}

export interface InvoiceStats {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  overdue: number;
  overdueAmount: number;
  avgDaysToPayment: number;
  invoicesThisMonth: number;
  collectionRate: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const VAT_RATES = [0, 9, 21] as const;
export type VatRate = typeof VAT_RATES[number];
export { VAT_RATES };

const mockInvoices: AutoInvoice[] = [
  {
    id: 'inv-1', invoiceNumber: 'F2024-0125', jobId: 'job-100', customerId: 'cust-1', customerName: 'Familie de Groot',
    customerEmail: 'degroot@email.nl', customerAddress: 'Hoofdstraat 45, Amsterdam',
    issueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    status: 'sent',
    lineItems: [
      { description: 'CV-ketel onderhoud (arbeid)', quantity: 1, unitPrice: 125, vatRate: 9, total: 136.25 },
      { description: 'Onderdelen - ontluchtingsventiel', quantity: 2, unitPrice: 15, vatRate: 21, total: 36.30 },
    ],
    subtotal: 155, vatAmount: 17.55, total: 172.55, paidAmount: 0, payments: [], reminders: [],
  },
  {
    id: 'inv-2', invoiceNumber: 'F2024-0124', jobId: 'job-99', customerId: 'cust-2', customerName: 'Bakkerij Jansen',
    customerAddress: 'Winkelstraat 12, Utrecht',
    issueDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: 'overdue',
    lineItems: [{ description: 'Airco service', quantity: 3, unitPrice: 95, vatRate: 21, total: 344.85 }],
    subtotal: 285, vatAmount: 59.85, total: 344.85, paidAmount: 0, payments: [],
    reminders: [{ date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), type: 'friendly', method: 'email', opened: true }],
  },
  {
    id: 'inv-3', invoiceNumber: 'F2024-0123', jobId: 'job-98', customerId: 'cust-3', customerName: 'Familie Visser',
    customerAddress: 'Parkweg 78, Rotterdam',
    issueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    status: 'paid',
    lineItems: [{ description: 'Warmtepomp storing', quantity: 1, unitPrice: 185, vatRate: 21, total: 223.85 }],
    subtotal: 185, vatAmount: 38.85, total: 223.85, paidAmount: 223.85, paidDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    paymentMethod: 'ideal',
    payments: [{ id: 'pay-1', date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), amount: 223.85, method: 'ideal', type: 'final' }],
    reminders: [],
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type InvoiceListener = () => void;

class InvoiceAutomationService {
  private static instance: InvoiceAutomationService;
  private listeners: Set<InvoiceListener> = new Set();
  private invoices: AutoInvoice[] = [...mockInvoices];
  private invoiceCounter = 125;

  static getInstance(): InvoiceAutomationService {
    if (!InvoiceAutomationService.instance) {
      InvoiceAutomationService.instance = new InvoiceAutomationService();
    }
    return InvoiceAutomationService.instance;
  }

  subscribe(listener: InvoiceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getInvoices(status?: AutoInvoice['status']): AutoInvoice[] {
    if (status) return this.invoices.filter(i => i.status === status);
    return this.invoices;
  }

  getInvoice(id: string): AutoInvoice | undefined { return this.invoices.find(i => i.id === id); }

  generateInvoice(jobId: string, customerId: string, customerName: string, customerAddress: string, lineItems: InvoiceLineItem[], customerEmail?: string): AutoInvoice {
    this.invoiceCounter++;
    const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const vatAmount = lineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice * li.vatRate / 100), 0);

    const invoice: AutoInvoice = {
      id: `inv-${Date.now()}`, invoiceNumber: `F${new Date().getFullYear()}-${String(this.invoiceCounter).padStart(4, '0')}`,
      jobId, customerId, customerName, customerEmail, customerAddress,
      issueDate: new Date(), dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'draft', lineItems, subtotal, vatAmount: Math.round(vatAmount * 100) / 100, total: Math.round((subtotal + vatAmount) * 100) / 100,
      paidAmount: 0, payments: [], reminders: [],
    };
    this.invoices.unshift(invoice);
    trackUserAction('invoice_generated', { jobId, total: invoice.total });
    this.notify();
    return invoice;
  }

  sendInvoice(invoiceId: string): void {
    const invoice = this.invoices.find(i => i.id === invoiceId);
    if (invoice) {
      invoice.status = 'sent';
      trackUserAction('invoice_sent', { invoiceId, total: invoice.total });
      this.notify();
    }
  }

  markPaid(invoiceId: string, method: AutoInvoice['paymentMethod'], amount?: number): void {
    const invoice = this.invoices.find(i => i.id === invoiceId);
    if (invoice) {
      invoice.status = 'paid';
      invoice.paidAmount = amount || invoice.total;
      invoice.paidDate = new Date();
      invoice.paymentMethod = method;
      trackUserAction('invoice_paid', { invoiceId, method, amount: invoice.paidAmount });
      this.notify();

      // Record invoice outcome for intelligence calibration
      import('../intelligence/learningStorage').then(({ recordInvoiceOutcome }) => {
        recordInvoiceOutcome({
          invoiceId: invoice.id,
          amount: invoice.total,
          issuedDate: invoice.issueDate.toISOString(),
          dueDate: invoice.dueDate.toISOString(),
          paidDate: invoice.paidDate!.toISOString(),
          isOverdue: invoice.dueDate < invoice.paidDate!,
        }).catch(() => {});
      }).catch(() => {});
    }
  }

  addPayment(invoiceId: string, amount: number, method: PaymentRecord['method'], type: PaymentRecord['type'], reference?: string): void {
    const invoice = this.invoices.find(i => i.id === invoiceId);
    if (invoice) {
      const payment: PaymentRecord = {
        id: `pay-${Date.now()}`,
        date: new Date(),
        amount,
        method,
        type,
        reference,
      };
      invoice.payments.push(payment);
      invoice.paidAmount = invoice.payments.reduce((sum, p) => sum + p.amount, 0);

      if (invoice.paidAmount >= invoice.total) {
        invoice.status = 'paid';
        invoice.paidDate = new Date();
        invoice.paymentMethod = method;
        trackUserAction('invoice_paid', { invoiceId, method, amount: invoice.paidAmount });
      }
      this.notify();
    }
  }

  sendReminder(invoiceId: string, type: ReminderSent['type']): void {
    const invoice = this.invoices.find(i => i.id === invoiceId);
    if (invoice) {
      invoice.reminders.push({ date: new Date(), type, method: 'email' });
      invoice.status = 'reminded';
      trackUserAction('invoice_reminder_sent', { invoiceId, type });
      this.notify();
    }
  }

  getOverdueReminders(): PaymentReminder[] {
    const now = new Date();
    return this.invoices
      .filter(i => i.status !== 'paid' && i.dueDate < now)
      .map(i => {
        const daysOverdue = Math.floor((now.getTime() - i.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const lastReminder = i.reminders[i.reminders.length - 1];
        let nextType: PaymentReminder['nextReminderType'] = 'friendly';
        if (lastReminder) {
          if (lastReminder.type === 'friendly') nextType = 'reminder';
          else if (lastReminder.type === 'reminder') nextType = 'urgent';
          else if (lastReminder.type === 'urgent') nextType = 'final';
          else nextType = 'collection';
        }
        return {
          invoiceId: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customerName,
          amount: i.total - i.paidAmount, daysOverdue, suggestedAction: `Stuur ${nextType} herinnering`, nextReminderType: nextType,
        };
      });
  }

  getStats(): InvoiceStats {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const paid = this.invoices.filter(i => i.status === 'paid');
    const overdue = this.invoices.filter(i => i.status !== 'paid' && i.dueDate < now);

    return {
      totalInvoiced: this.invoices.reduce((sum, i) => sum + i.total, 0),
      totalPaid: paid.reduce((sum, i) => sum + i.paidAmount, 0),
      outstanding: this.invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.total - i.paidAmount, 0),
      overdue: overdue.length,
      overdueAmount: overdue.reduce((sum, i) => sum + i.total - i.paidAmount, 0),
      avgDaysToPayment: 18,
      invoicesThisMonth: this.invoices.filter(i => i.issueDate >= monthStart).length,
      collectionRate: Math.round((paid.length / this.invoices.length) * 100),
    };
  }
}

export const invoiceAutomationService = InvoiceAutomationService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useAutoInvoices(status?: AutoInvoice['status']) {
  const [invoices, setInvoices] = useState<AutoInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setInvoices(invoiceAutomationService.getInvoices(status));
    setLoading(false);
    return invoiceAutomationService.subscribe(() => setInvoices(invoiceAutomationService.getInvoices(status)));
  }, [status]);

  const generate = useCallback((jId: string, cId: string, cName: string, cAddr: string, items: InvoiceLineItem[], email?: string) =>
    invoiceAutomationService.generateInvoice(jId, cId, cName, cAddr, items, email), []);
  const send = useCallback((id: string) => invoiceAutomationService.sendInvoice(id), []);
  const markPaid = useCallback((id: string, method: AutoInvoice['paymentMethod'], amount?: number) => invoiceAutomationService.markPaid(id, method, amount), []);
  const addPayment = useCallback((id: string, amount: number, method: PaymentRecord['method'], type: PaymentRecord['type'], ref?: string) =>
    invoiceAutomationService.addPayment(id, amount, method, type, ref), []);
  const sendReminder = useCallback((id: string, type: ReminderSent['type']) => invoiceAutomationService.sendReminder(id, type), []);

  return { invoices, loading, generate, send, markPaid, addPayment, sendReminder };
}

export function usePaymentReminders() {
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  useEffect(() => {
    setReminders(invoiceAutomationService.getOverdueReminders());
    return invoiceAutomationService.subscribe(() => setReminders(invoiceAutomationService.getOverdueReminders()));
  }, []);
  return reminders;
}

export function useInvoiceStats() {
  const [stats, setStats] = useState<InvoiceStats>(invoiceAutomationService.getStats());
  useEffect(() => invoiceAutomationService.subscribe(() => setStats(invoiceAutomationService.getStats())), []);
  return stats;
}
