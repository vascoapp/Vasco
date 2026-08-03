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
