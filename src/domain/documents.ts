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
  // R66 round 47: leveringsdatum / NL Belastingdienst Art. 35 lid 1.b.
  // Snapshotted at invoice-create from linked job.completedAt; persisted
  // on documents.delivery_date. PDF render reads from here so the date
  // survives if the linked job is later deleted.
  deliveryDate?: string;
  // ── Progress billing (termijnfacturen) ────────────────────────────────────
  // Projects already carried `invoiceIds`, but there was no invoice -> project
  // link and progress billing has to walk that direction.
  projectId?: string;
  /** The ProjectBillingTerm this instalment was raised for. */
  billingTermId?: string;
  /**
   * Retentie withheld from THIS invoice. `amount` stays the full term value --
   * VAT is charged on the full amount -- and what the customer pays now is
   * `amount - retentionAmount`. That figure is derived, never stored, so it
   * cannot drift. Deducting retention from `amount` instead would under-report
   * VAT and produce an e-invoice total that disagrees with the contract.
   */
  retentionAmount?: number;
  /** The final invoice that releases everything withheld. Withholds nothing itself. */
  isRetentionRelease?: boolean;
};
