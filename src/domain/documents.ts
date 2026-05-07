export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export type QuoteDeclineReason =
  | 'price_too_high'
  | 'chose_competitor'
  | 'scope_changed'
  | 'no_response'
  | 'timing'
  | 'customer_declined'
  | 'other';

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
  // R188: structured rejection reason — fed into pricing_intelligence for moat
  declineReason?: QuoteDeclineReason;
  counterOfferAmount?: number;
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
  // R66 round 13: internal notes (free-text contractor memo, not
  // customer-visible). Was UI-only — saving did nothing.
  notes?: string;
};
