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
  /**
   * OVERRIDE ONLY — read it through `documentNumber()`, never directly.
   *
   * There is no `reference` column and nothing writes this. The real document
   * number is minted by the `next_document_number` RPC and lands on `id`
   * (`documentRowToInvoice`: `id: row.document_number ?? row.id`). This slot
   * exists for a series carried in from another system. Reading it raw is what
   * produced a dunning WhatsApp that named no invoice and an accountant
   * handover listing customers where the numbers belong.
   */
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
  // ── How it was paid ───────────────────────────────────────────────────────
  // Written server-side by the Mollie and Stripe webhooks the moment a payment
  // settles, and until 2026-08-19 read by nothing: DocumentRow had no field for
  // any of them, so the contractor could never see whether an invoice came in
  // by iDEAL, card or bank transfer, and had no provider reference to reconcile
  // a bank line against. Rule #8, from the read side — and missed by the
  // earlier sweeps because the WRITER is an edge function, not AppState.
  /** 'ideal' | 'creditcard' | 'bancontact' | … — the provider's own name for it. */
  paymentMethod?: string;
  /** 'mollie' | 'stripe'. */
  paymentProvider?: string;
  /** The provider's payment id, for reconciliation against a bank statement. */
  paymentId?: string;
  // ── Progress billing (termijnfacturen) ────────────────────────────────────
  // Projects already carried `invoiceIds`, but there was no invoice -> project
  // link and progress billing has to walk that direction.
  projectId?: string;
  /** The ProjectBillingTerm this instalment was raised for. */
  billingTermId?: string;
  /** The ProjectChangeOrder this invoice bills, when it is meerwerk rather
   *  than a scheduled instalment. Negative-amount orders settle as a credit. */
  changeOrderId?: string;
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

/**
 * The number a human — contractor, customer, accountant, tax authority — knows
 * this document by.
 *
 * `document_number` is minted server-side by the `next_document_number` RPC
 * (contractor's own prefix, monotonic counter, GoBD/§14 UStG sequential) and
 * `documentRowToInvoice` / `documentRowToQuote` land it on `id`:
 *
 *     id: row.document_number ?? row.id
 *
 * So **`id` IS the document number** on every row that came from the backend,
 * and `reference` is only an override slot for a series carried in from another
 * system. Nothing writes `reference` today and there is no column for it.
 *
 * That is exactly why this function has to exist. Eight readers each invented
 * their own fallback for the same missing field and disagreed about what to
 * show instead — the dunning WhatsApp fell back to `''` and sent the customer a
 * Mahnung threatening statutory interest that **named no invoice**; the
 * accountant handover and the tax-filings screen fell back to the CUSTOMER
 * NAME, so an accountant reading a list of invoice numbers got a list of
 * people; the Moneybird/Xero/QuickBooks export passed `undefined` straight
 * through as the external `Reference` / `DocNumber`.
 *
 * Same shape as `findDocumentCustomer` (#214): one resolver, exported from the
 * domain module, rather than N guards that drift.
 */
export function documentNumber(
  doc: { id?: string | null; reference?: string | null } | null | undefined,
): string {
  if (!doc) return '';
  const ref = (doc.reference ?? '').trim();
  if (ref) return ref;
  return (doc.id ?? '').trim();
}
