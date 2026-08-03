// =============================================================================
// PROJECT TYPE — Groups multiple jobs under one renovation/construction project
// =============================================================================
// Used by aannemers (general contractors) managing multi-trade projects.
// Solo tradespeople can ignore projects — jobs work standalone.
// =============================================================================

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface ProjectMilestone {
  id: string;
  title: string;
  trade?: string;
  weekNumber: number; // week offset from project start (1-based)
  completed: boolean;
  jobIds: string[]; // linked jobs
}

// ---------------------------------------------------------------------------
// Progress billing (termijnfacturen)
// ---------------------------------------------------------------------------
// An aannemer does not invoice an EUR 80k renovation once. They bill in
// instalments -- 30% at start, 30% at rough-in, 30% at finish, 10% at
// oplevering -- and the customer withholds retentie until the waarborgtermijn
// expires.
//
// A billing term is NOT a ProjectMilestone. A milestone is a point in the
// schedule ("week 3, rough-in done"); a term is money ("30% due on rough-in").
// A project can have five milestones and three terms. A term may reference a
// milestone as its trigger via `milestoneId`, which is the only link between
// the two lists.
// ---------------------------------------------------------------------------

export type BillingTermBasis = 'percent' | 'fixed';

/**
 * pending  — not yet due
 * ready    — trigger met (e.g. its milestone completed), awaiting invoicing
 * invoiced — an invoice has been raised for it
 * paid     — that invoice is settled
 */
export type BillingTermStatus = 'pending' | 'ready' | 'invoiced' | 'paid';

export interface ProjectBillingTerm {
  id: string;
  title: string;
  basis: BillingTermBasis;
  /** Percent of contract value, 0-100. Used when basis === 'percent'. */
  percent?: number;
  /** Absolute amount. Used when basis === 'fixed'. */
  amount?: number;
  /** Optional schedule milestone whose completion makes this term `ready`. */
  milestoneId?: string;
  status: BillingTermStatus;
  /** Set once invoiced, so the term and its document stay linked both ways. */
  invoiceId?: string;
  invoicedAt?: string;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Meerwerk / minderwerk (change orders)
// ---------------------------------------------------------------------------
// Extra or reduced work agreed after the contract. This is where an aannemer
// usually makes or loses their margin, and it is the most common source of
// customer disputes.
//
// LEGAL: art. 7:755 BW. A contractor may charge for meerwerk only if they
// warned the client IN TIME that the change required a price increase. The
// warning need not state the amount, but it must have happened — and for
// consumers there is an enhanced duty to explain the price and how it was
// calculated. So `warnedAt` is not workflow decoration: without it the
// contractor may have no right to invoice the work at all, which is why
// canInvoiceChangeOrder refuses to bill a positive order that has none.
//
// Minderwerk is the same entity with a negative `amount`. It reduces what the
// customer owes, needs no warning (it is in their favour), and settles as a
// credit rather than an invoice.
// ---------------------------------------------------------------------------

export type ChangeOrderStatus =
  | 'draft'      // being written up, customer has not seen it
  | 'proposed'   // sent to the customer, awaiting their answer
  | 'approved'   // customer agreed; counts toward project value
  | 'rejected'   // customer declined; never billable
  | 'invoiced';  // billed (or credited, when the amount is negative)

/** How the price warning reached the customer — the evidence if it is disputed. */
export type ChangeOrderWarningChannel = 'app' | 'email' | 'whatsapp' | 'sms' | 'in_person';

export interface ProjectChangeOrder {
  id: string;
  title: string;
  description?: string;
  /**
   * Signed. Positive is meerwerk (customer owes more), negative is minderwerk
   * (customer owes less). Excluding VAT, like every other amount here.
   */
  amount: number;
  status: ChangeOrderStatus;
  /**
   * When the customer was told this change carried a price increase
   * (art. 7:755 BW). Required before a positive order can be invoiced.
   */
  warnedAt?: string;
  warnedVia?: ChangeOrderWarningChannel;
  approvedAt?: string;
  rejectedAt?: string;
  invoiceId?: string;
  invoicedAt?: string;
  createdAt: string;
  sortOrder: number;
}

export interface Project {
  id: string;
  title: string;
  customerId: string;
  customerName?: string;
  status: ProjectStatus;
  description?: string;

  // Location
  address?: {
    street: string;
    city: string;
    postcode: string;
    country: string;
  };

  // Schedule
  startDate?: string; // ISO date
  targetEndDate?: string;
  actualEndDate?: string;

  // Financial
  totalBudget: number;
  totalQuoted: number;
  totalInvoiced: number;
  totalPaid: number;

  // Progress billing. Empty means the project is billed as a single invoice,
  // which is the existing behaviour for every project created before this.
  billingTerms: ProjectBillingTerm[];
  /**
   * Percent of each instalment withheld until oplevering, 0-100. Commonly 5 in
   * NL construction contracts. 0 means no retention.
   *
   * Retentie is withheld from PAYMENT, not deducted from the invoice: the
   * invoice is issued for the full term amount and VAT is charged on the full
   * amount. See progressBillingService.payableNow.
   */
  retentionPercent: number;

  /**
   * Meerwerk / minderwerk agreed after the contract.
   *
   * These deliberately do NOT re-base the percentage billing terms. A term
   * already invoiced is a historical fact, and re-spreading approved changes
   * across the remaining terms would under-bill the project: bill 30% of 80k,
   * approve 20k of meerwerk, then bill 70% of 100k and you have invoiced 94k
   * of a 100k project. Change orders are billed on their own invoice instead,
   * so total billed is exactly contract + changes.
   */
  changeOrders: ProjectChangeOrder[];

  // Multi-trade scheduling
  milestones: ProjectMilestone[];

  // Linked entities
  jobIds: string[];
  quoteIds: string[];
  invoiceIds: string[];
  subcontractorIds: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Computed from linked jobs + invoices
export interface ProjectPnL {
  projectId: string;
  revenue: number;           // total invoiced
  materialCosts: number;     // sum of job materials
  laborCosts: number;        // sum of time entries × rate
  subcontractorCosts: number;// sum of subcontractor invoices
  otherCosts: number;
  grossProfit: number;
  grossMargin: number;       // percentage
  budgetVariance: number;    // budget - actual costs
  budgetVariancePct: number;
}
