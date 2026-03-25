export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export type Quote = {
  id: string;
  customer: string;
  job: string;
  description?: string;
  amount: number;
  status: QuoteStatus;
  trade?: string;
  validUntil?: string;
  lineItems?: { description: string; quantity: number; unitPrice: number }[];
  customerId?: string;
  lastUpdated: string;
  sentAt?: string;
  createdAt?: string;
};

export type Invoice = {
  id: string;
  customer: string;
  customerId?: string;
  job: string;
  jobId?: string;
  amount: number;
  total?: number;
  status: InvoiceStatus;
  dueInDays: number;
  dueDate?: string;
  sentAt?: string;
  paidAt?: string;
  lastUpdated?: string;
  createdAt?: string;
  reference?: string;
  customerName?: string;
  exportedAt?: string;
  einvoiceSubmitted?: string;
};
