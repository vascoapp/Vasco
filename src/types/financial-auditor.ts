/**
 * Financial Auditor Types
 *
 * Types for the Financial Auditor service that:
 * 1. Verifies invoices against budgets/contracts/POs
 * 2. Detects unnecessary spending
 * 3. Detects overpayments (paying above market/contract rates)
 */

// ============================================
// CORE AUDIT TYPES
// ============================================

export type AuditType =
  | 'invoice-mismatch'
  | 'unnecessary-spend'
  | 'overpayment'
  | 'duplicate-charge'
  | 'budget-variance'
  | 'missing-approval'
  | 'rate-creep';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AuditStatus = 'new' | 'acknowledged' | 'in-review' | 'resolved' | 'dismissed';

export interface FinancialAuditFinding {
  id: string;
  auditType: AuditType;
  severity: AuditSeverity;
  status: AuditStatus;

  title: string;
  description: string;

  financialDetails: {
    invoiceId?: string;
    invoiceNumber?: string;
    vendor?: string;
    projectId?: string;
    costCode?: string;

    invoicedAmount?: number;
    expectedAmount?: number;
    variance?: number;
    variancePercent?: number;

    marketRate?: number;
    contractRate?: number;
    historicalRate?: number;

    budgetLineItem?: string;
    excelReference?: string;  // Cell reference in budget spreadsheet
    comparisonSource?: 'budget' | 'contract' | 'market-rate' | 'historical-avg' | 'purchase-order';
  };

  evidence: {
    type: 'invoice' | 'budget' | 'contract' | 'quote' | 'po' | 'delivery' | 'historical';
    documentId: string;
    reference: string;
    value?: number;
  }[];

  suggestedAction: {
    type: 'request-credit' | 'reject-invoice' | 'flag-for-review' | 'renegotiate' | 'approve-with-note' | 'find-alternative';
    description: string;
    potentialSavings?: number;
  } | null;

  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  dismissedReason?: string;
}

// ============================================
// INVOICE VERIFICATION
// ============================================

export type VerificationStatus = 'matched' | 'discrepancy' | 'missing-reference' | 'pending-review' | 'approved' | 'rejected';

export type DiscrepancyType =
  | 'quantity-mismatch'
  | 'rate-mismatch'
  | 'unapproved-item'
  | 'duplicate-charge'
  | 'missing-approval'
  | 'exceeds-budget'
  | 'exceeds-po'
  | 'calculation-error'
  | 'vat-error';

export interface InvoiceLineItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  vatRate?: number;
  vatAmount?: number;
  costCode?: string;
  budgetCategory?: string;
}

export interface InvoiceDiscrepancy {
  id: string;
  lineNumber?: number;
  type: DiscrepancyType;
  description: string;

  invoicedValue: number;
  expectedValue: number;
  variance: number;
  variancePercent: number;

  severity: AuditSeverity;

  source: {
    type: 'budget' | 'contract' | 'po' | 'historical' | 'invoice';
    documentId?: string;
    reference?: string;
  };

  recommendation: string;
}

export interface InvoiceVerification {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  vendor: string;
  vendorId?: string;

  invoiceAmount: number;
  invoiceDate: string;
  dueDate?: string;

  lineItems: InvoiceLineItem[];

  verificationResult: {
    status: VerificationStatus;
    matchedTo: 'budget' | 'contract' | 'purchase-order' | 'estimate' | 'none';
    matchedDocumentId?: string;

    expectedAmount: number;
    variance: number;
    variancePercent: number;

    discrepancies: InvoiceDiscrepancy[];

    autoApprovalEligible: boolean;
    autoApprovalBlockers?: string[];
  };

  projectId?: string;
  costCode?: string;

  verifiedAt: string;
  verifiedBy: 'system' | string;

  decision?: {
    action: 'approved' | 'rejected' | 'partial-approved' | 'credit-requested';
    decidedBy: string;
    decidedAt: string;
    notes?: string;
    adjustedAmount?: number;
  };
}

export interface BudgetData {
  id: string;
  projectId: string;
  name: string;
  version: number;

  lineItems: BudgetLineItem[];

  totalBudget: number;
  totalCommitted: number;
  totalSpent: number;
  totalRemaining: number;

  lastUpdated: string;
  source: 'excel' | 'manual' | 'erp';
  excelFilePath?: string;
}

export interface BudgetLineItem {
  id: string;
  costCode: string;
  description: string;
  category: string;

  quantity: number;
  unit: string;
  unitRate: number;
  total: number;

  committed: number;
  spent: number;
  remaining: number;

  variancePercent: number;
  status: 'on-budget' | 'over-budget' | 'under-budget' | 'at-risk';
}

// ============================================
// UNNECESSARY SPENDING DETECTION
// ============================================

export type UnnecessarySpendType =
  | 'redundant-service'           // Paying multiple vendors for same thing
  | 'over-specification'          // Premium when standard would work
  | 'unused-subscription'         // Paying for unused services
  | 'early-procurement'           // Bought too early, cash tied up
  | 'scope-creep'                 // Items not in original scope
  | 'premium-when-standard-ok'    // Gold-plating
  | 'duplicate-purchase'          // Same item bought twice
  | 'excess-quantity';            // Ordered more than needed

export interface UnnecessarySpendFinding {
  id: string;
  type: UnnecessarySpendType;
  severity: AuditSeverity;

  title: string;
  description: string;

  currentSpend: number;
  necessarySpend: number;
  savingsPotential: number;

  affectedItems: {
    description: string;
    vendor?: string;
    amount: number;
    invoiceId?: string;
  }[];

  evidence: {
    type: string;
    description: string;
    documentId?: string;
  }[];

  confidence: number;  // 0-100

  actionRequired: string;
  actionDeadline?: string;

  projectId?: string;
  category?: string;

  detectedAt: string;
  status: AuditStatus;
}

export interface UnnecessarySpendAnalysis {
  id: string;
  projectId: string;
  projectName?: string;
  analysisDate: string;

  findings: UnnecessarySpendFinding[];

  summary: {
    totalCurrentSpend: number;
    totalNecessarySpend: number;
    totalPotentialSavings: number;
    findingsCount: number;
    bySeverity: Record<AuditSeverity, number>;
    byType: Record<UnnecessarySpendType, number>;
  };

  prioritizedActions: SavingsAction[];

  comparisonToSimilarProjects?: {
    averageSpend: number;
    percentile: number;
    benchmark: string;
  };
}

export interface SavingsAction {
  id: string;
  title: string;
  description: string;

  savingsAmount: number;
  savingsType: 'one-time' | 'recurring-monthly' | 'recurring-annual';

  effort: 'low' | 'medium' | 'high';
  timeline: 'immediate' | 'this-week' | 'this-month' | 'this-quarter';

  actionSteps: string[];

  relatedFindingIds: string[];

  status: 'suggested' | 'accepted' | 'in-progress' | 'completed' | 'rejected';
  acceptedBy?: string;
  acceptedAt?: string;
  completedAt?: string;
  actualSavings?: number;
}

// ============================================
// OVERPAYMENT DETECTION
// ============================================

export type OverpaymentType =
  | 'above-market-rate'           // Paying more than market
  | 'above-contract-rate'         // Paying more than contract
  | 'above-historical-avg'        // Paying more than before
  | 'no-volume-discount'          // Not getting bulk discount
  | 'missed-early-payment'        // Missed prompt payment discount
  | 'rate-creep'                  // Gradual rate increases
  | 'no-competitive-quote';       // Didn't get competitive bids

export interface OverpaymentFinding {
  id: string;
  type: OverpaymentType;
  severity: AuditSeverity;

  title: string;
  description: string;

  vendor: string;
  vendorId?: string;
  itemOrService: string;

  paidRate: number;
  benchmarkRate: number;
  benchmarkSource: 'market-data' | 'contract' | 'historical' | 'competitor-quote';
  benchmarkDetails?: string;

  overpaymentAmount: number;
  overpaymentPercent: number;

  invoicesAffected: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    date: string;
  }[];

  periodStart?: string;
  periodEnd?: string;

  evidence: {
    type: string;
    description: string;
    value?: number;
    documentId?: string;
  }[];

  isRecoverable: boolean;
  recoveryLikelihood?: 'high' | 'medium' | 'low';
  recoveryAction?: string;

  projectId?: string;

  detectedAt: string;
  status: AuditStatus;
}

export interface OverpaymentAnalysis {
  id: string;
  projectId: string;
  projectName?: string;
  analysisDate: string;

  findings: OverpaymentFinding[];

  summary: {
    totalOverpaymentAmount: number;
    recoverableAmount: number;
    findingsCount: number;
    bySeverity: Record<AuditSeverity, number>;
    byType: Record<OverpaymentType, number>;
    topVendors: { vendor: string; amount: number }[];
  };

  recoveryActions: RecoveryAction[];

  rateCreepTrends?: {
    vendor: string;
    item: string;
    rateChange: number;
    rateChangePercent: number;
    period: string;
  }[];
}

export interface RecoveryAction {
  id: string;
  vendorId: string;
  vendorName: string;

  amount: number;
  basis: string;  // Why we can recover (contract terms, billing error, etc.)

  suggestedApproach: 'credit-note-request' | 'rate-renegotiation' | 'contract-dispute' | 'future-offset' | 'formal-claim';

  steps: string[];
  templateMessage?: string;

  deadline?: string;

  relatedFindingIds: string[];

  status: 'suggested' | 'initiated' | 'in-negotiation' | 'resolved' | 'rejected';
  initiatedAt?: string;
  resolvedAt?: string;
  recoveredAmount?: number;
  resolution?: string;
}

// ============================================
// BUDGET RECONCILIATION
// ============================================

export interface BudgetVariance {
  costCode: string;
  description: string;
  category: string;

  budgetAmount: number;
  actualAmount: number;
  committedAmount: number;

  variance: number;
  variancePercent: number;

  status: 'on-budget' | 'over-budget' | 'under-budget' | 'at-risk';
  trend: 'improving' | 'stable' | 'worsening';

  transactions: {
    invoiceId: string;
    vendor: string;
    amount: number;
    date: string;
  }[];

  forecast: {
    estimatedFinal: number;
    forecastVariance: number;
    confidence: number;
  };
}

export interface BudgetVarianceReport {
  id: string;
  projectId: string;
  projectName: string;
  reportDate: string;

  summary: {
    totalBudget: number;
    totalActual: number;
    totalCommitted: number;
    totalVariance: number;
    totalVariancePercent: number;
    overBudgetCategories: number;
    atRiskCategories: number;
  };

  variances: BudgetVariance[];

  alerts: {
    type: 'over-budget' | 'trending-over' | 'large-variance' | 'unbudgeted-spend';
    costCode: string;
    description: string;
    severity: AuditSeverity;
  }[];

  recommendations: string[];
}

export interface ReconciliationReport {
  id: string;
  projectId: string;
  reportDate: string;

  budgetSource: {
    type: 'excel' | 'manual' | 'erp';
    fileName?: string;
    lastModified?: string;
  };

  matchedItems: number;
  unmatchedBudgetItems: string[];
  unmatchedActualItems: string[];

  discrepancies: {
    costCode: string;
    budgetValue: number;
    actualValue: number;
    difference: number;
    reason?: string;
  }[];

  status: 'reconciled' | 'discrepancies-found' | 'pending-review';
}

// ============================================
// FINANCIAL AUDIT DASHBOARD
// ============================================

export interface FinancialAuditStats {
  // Invoice verification
  invoicesVerified: number;
  invoicesWithDiscrepancies: number;
  discrepancyRate: number;
  totalDiscrepancyValue: number;

  // Unnecessary spending
  unnecessarySpendFindings: number;
  potentialSavings: number;
  savingsRealized: number;

  // Overpayments
  overpaymentFindings: number;
  totalOverpaymentValue: number;
  recoverableAmount: number;
  recoveredAmount: number;

  // Budget health
  projectsOverBudget: number;
  averageVariance: number;

  // By severity
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;

  // Trends
  findingsTrend: 'increasing' | 'stable' | 'decreasing';
  savingsTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface FinancialAuditConfig {
  // Auto-approval thresholds
  autoApprovalMaxVariance: number;  // e.g., 5%
  autoApprovalMaxAmount: number;    // e.g., €1000

  // Alert thresholds
  budgetVarianceAlertThreshold: number;  // e.g., 10%
  rateCreepAlertThreshold: number;       // e.g., 5% increase

  // Market rate comparison
  marketRateTolerance: number;  // e.g., 15% above market

  // Review requirements
  requireApprovalAbove: number;  // e.g., €5000

  // Scheduling
  runFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';

  // Notifications
  notifyOnCritical: boolean;
  notifyOnHigh: boolean;
  notifyRecipients: string[];
}

// ============================================
// SERVICE INTERFACES
// ============================================

export interface FinancialAuditFilters {
  projectId?: string;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  severity?: AuditSeverity[];
  auditType?: AuditType[];
  status?: AuditStatus[];
  minAmount?: number;
  maxAmount?: number;
}

export interface InvoiceVerificationRequest {
  invoiceId: string;
  projectId: string;
  compareAgainst: ('budget' | 'contract' | 'po' | 'historical')[];
  budgetData?: BudgetData;
  contractId?: string;
  poId?: string;
}

export interface SpendingAnalysisRequest {
  projectId: string;
  dateRange?: { from: string; to: string };
  categories?: string[];
  vendors?: string[];
  includeComparison?: boolean;
}

export interface OverpaymentAnalysisRequest {
  projectId: string;
  dateRange?: { from: string; to: string };
  vendors?: string[];
  includeRateCreep?: boolean;
  lookbackMonths?: number;
}
