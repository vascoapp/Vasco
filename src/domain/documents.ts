export type QuoteStatus = 'draft' | 'sent';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export type Quote = {
  id: string;
  customer: string;
  job: string;
  amount: number;
  status: QuoteStatus;
  lastUpdated: string;
};

export type Invoice = {
  id: string;
  customer: string;
  job: string;
  amount: number;
  status: InvoiceStatus;
  dueInDays: number;
};
