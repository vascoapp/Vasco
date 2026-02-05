/**
 * Auditor Types
 *
 * Types for the continuous background auditing service that
 * monitors all data for risks, missed value, and compliance issues.
 */

import { ReasoningChain } from './reasoning';

// ============================================
// AUDIT CATEGORIES
// ============================================

export type AuditCategoryId =
  // Contractor categories
  | 'payment-overdue'
  | 'quote-stale'
  | 'margin-erosion'
  | 'compliance-expiring'
  | 'customer-churn-risk'
  | 'missed-upsell'
  | 'pricing-below-market'
  | 'invoice-vs-estimate'
  | 'supplier-rate-creep'

  // Site Lead categories
  | 'safety-trend-negative'
  | 'quality-defect-spike'
  | 'schedule-slip-risk'
  | 'resource-conflict'
  | 'inspection-overdue'
  | 'rfi-aging'

  // COO categories
  | 'critical-path-risk'
  | 'permit-deadline-risk'
  | 'procurement-bottleneck'
  | 'supplier-reliability-drift'
  | 'change-order-backlog'
  | 'handover-blocking-payment'
  | 'procurement-overpayment'
  | 'unnecessary-procurement'

  // CFO categories
  | 'cost-overrun-trajectory'
  | 'cashflow-gap-risk'
  | 'retention-release-risk'
  | 'draw-request-delay'
  | 'invoice-disputes'
  | 'contingency-burn-rate'
  | 'invoice-budget-mismatch'
  | 'invoice-contract-mismatch'
  | 'duplicate-invoice'
  | 'unapproved-line-items'
  | 'unnecessary-spending'
  | 'overpayment-detection'
  | 'missing-volume-discounts'
  | 'early-payment-missed'
  | 'rate-creep-detection'
  | 'budget-line-variance'

  // Director categories
  | 'portfolio-concentration'
  | 'irr-erosion'
  | 'team-bottleneck'
  | 'market-shift'
  | 'regulatory-change'
  | 'portfolio-cost-leakage'
  | 'vendor-consolidation-opportunity';

export type UserRole = 'contractor' | 'sitelead' | 'coo' | 'cfo' | 'director';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AuditStatus = 'new' | 'acknowledged' | 'in-review' | 'resolved' | 'dismissed' | 'auto-resolved';

export type CheckFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly';

// ============================================
// AUDIT CATEGORY CONFIGURATION
// ============================================

export interface AuditCategory {
  id: AuditCategoryId;
  name: string;
  description: string;
  role: UserRole;
  checkFrequency: CheckFrequency;
  defaultSeverity: AuditSeverity;
  autoResolveEnabled: boolean;
  notificationEnabled: boolean;
}

export const AUDIT_CATEGORIES: Record<UserRole, AuditCategory[]> = {
  contractor: [
    { id: 'payment-overdue', name: 'Payment Overdue', description: 'Customer payment past due date', role: 'contractor', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: true, notificationEnabled: true },
    { id: 'quote-stale', name: 'Stale Quote', description: 'Quote sent but no customer response', role: 'contractor', checkFrequency: 'daily', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'margin-erosion', name: 'Margin Erosion', description: 'Job costs exceeding estimate', role: 'contractor', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'compliance-expiring', name: 'Compliance Expiring', description: 'Certifications or insurance expiring soon', role: 'contractor', checkFrequency: 'daily', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'customer-churn-risk', name: 'Customer Churn Risk', description: 'Customer engagement declining', role: 'contractor', checkFrequency: 'weekly', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'missed-upsell', name: 'Missed Upsell', description: 'Upsell opportunity not captured', role: 'contractor', checkFrequency: 'daily', defaultSeverity: 'low', autoResolveEnabled: false, notificationEnabled: false },
    { id: 'pricing-below-market', name: 'Pricing Below Market', description: 'Charging below competitor rates', role: 'contractor', checkFrequency: 'weekly', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'invoice-vs-estimate', name: 'Invoice vs Estimate Gap', description: 'Invoice differs significantly from estimate', role: 'contractor', checkFrequency: 'realtime', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'supplier-rate-creep', name: 'Supplier Rate Creep', description: 'Supplier prices increasing', role: 'contractor', checkFrequency: 'weekly', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
  ],
  sitelead: [
    { id: 'safety-trend-negative', name: 'Safety Trend Negative', description: 'LTIR or safety metrics trending up', role: 'sitelead', checkFrequency: 'daily', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'quality-defect-spike', name: 'Quality Defect Spike', description: 'Defect rate increasing', role: 'sitelead', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'schedule-slip-risk', name: 'Schedule Slip Risk', description: 'Activities at risk of delay', role: 'sitelead', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'resource-conflict', name: 'Resource Conflict', description: 'Double-booked resources', role: 'sitelead', checkFrequency: 'realtime', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'inspection-overdue', name: 'Inspection Overdue', description: 'Missed inspection date', role: 'sitelead', checkFrequency: 'daily', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'rfi-aging', name: 'RFI Aging', description: 'RFIs not responded to in time', role: 'sitelead', checkFrequency: 'daily', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
  ],
  coo: [
    { id: 'critical-path-risk', name: 'Critical Path Risk', description: 'Activities threatening completion', role: 'coo', checkFrequency: 'daily', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'permit-deadline-risk', name: 'Permit Deadline Risk', description: 'Permit conditions at risk', role: 'coo', checkFrequency: 'daily', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'procurement-bottleneck', name: 'Procurement Bottleneck', description: 'Contracts needed but not awarded', role: 'coo', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'supplier-reliability-drift', name: 'Supplier Reliability Drift', description: 'Supplier performance declining', role: 'coo', checkFrequency: 'weekly', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'change-order-backlog', name: 'Change Order Backlog', description: 'Unprocessed change orders', role: 'coo', checkFrequency: 'daily', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'handover-blocking-payment', name: 'Handover Blocking Payment', description: 'Handovers incomplete', role: 'coo', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'procurement-overpayment', name: 'Procurement Overpayment', description: 'Paying more than contract rates', role: 'coo', checkFrequency: 'realtime', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'unnecessary-procurement', name: 'Unnecessary Procurement', description: 'Procuring items not in scope', role: 'coo', checkFrequency: 'daily', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
  ],
  cfo: [
    { id: 'cost-overrun-trajectory', name: 'Cost Overrun Trajectory', description: 'EAC exceeding budget', role: 'cfo', checkFrequency: 'daily', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'cashflow-gap-risk', name: 'Cash Flow Gap Risk', description: 'Upcoming cash shortfall', role: 'cfo', checkFrequency: 'daily', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'retention-release-risk', name: 'Retention Release Risk', description: 'Retentions not being released', role: 'cfo', checkFrequency: 'weekly', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'draw-request-delay', name: 'Draw Request Delay', description: 'Draw requests aging', role: 'cfo', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'invoice-disputes', name: 'Invoice Disputes', description: 'Disputed invoices accumulating', role: 'cfo', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'contingency-burn-rate', name: 'Contingency Burn Rate', description: 'Contingency depleting too fast', role: 'cfo', checkFrequency: 'weekly', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'invoice-budget-mismatch', name: 'Invoice-Budget Mismatch', description: 'Invoice does not match budget', role: 'cfo', checkFrequency: 'realtime', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'duplicate-invoice', name: 'Duplicate Invoice', description: 'Same charge submitted twice', role: 'cfo', checkFrequency: 'realtime', defaultSeverity: 'critical', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'overpayment-detection', name: 'Overpayment Detection', description: 'Paying above market rates', role: 'cfo', checkFrequency: 'daily', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'rate-creep-detection', name: 'Rate Creep Detection', description: 'Gradual rate increases', role: 'cfo', checkFrequency: 'weekly', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'budget-line-variance', name: 'Budget Line Variance', description: 'Actual vs budget by cost code', role: 'cfo', checkFrequency: 'daily', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
  ],
  director: [
    { id: 'portfolio-concentration', name: 'Portfolio Concentration', description: 'Too much risk in one project', role: 'director', checkFrequency: 'weekly', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'irr-erosion', name: 'IRR Erosion', description: 'Returns declining', role: 'director', checkFrequency: 'weekly', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'team-bottleneck', name: 'Team Bottleneck', description: 'Key person dependencies', role: 'director', checkFrequency: 'weekly', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'market-shift', name: 'Market Shift', description: 'Market conditions changing', role: 'director', checkFrequency: 'weekly', defaultSeverity: 'medium', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'regulatory-change', name: 'Regulatory Change', description: 'New regulations affecting portfolio', role: 'director', checkFrequency: 'weekly', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'portfolio-cost-leakage', name: 'Portfolio Cost Leakage', description: 'Systemic overspending patterns', role: 'director', checkFrequency: 'weekly', defaultSeverity: 'high', autoResolveEnabled: false, notificationEnabled: true },
    { id: 'vendor-consolidation-opportunity', name: 'Vendor Consolidation', description: 'Same service from multiple vendors', role: 'director', checkFrequency: 'monthly', defaultSeverity: 'low', autoResolveEnabled: false, notificationEnabled: false },
  ],
};

// ============================================
// AUDIT FINDINGS
// ============================================

export interface AuditFinding {
  id: string;
  categoryId: AuditCategoryId;
  category: AuditCategory;

  title: string;
  description: string;

  severity: AuditSeverity;
  status: AuditStatus;

  // Impact assessment
  impact: {
    financial?: number;
    schedule?: number;        // Days
    risk?: number;           // 0-100 score
    compliance?: string;
  };

  // Evidence
  evidence: {
    type: string;
    description: string;
    value?: any;
    documentId?: string;
  }[];

  // Related entities
  relatedEntities: {
    type: 'project' | 'invoice' | 'supplier' | 'customer' | 'job' | 'employee';
    id: string;
    name: string;
  }[];

  // Suggested action
  suggestedAction: {
    type: string;
    description: string;
    urgency: 'immediate' | 'today' | 'this-week' | 'when-convenient';
    estimatedSavings?: number;
  } | null;

  // AI reasoning
  reasoning?: ReasoningChain;

  // Timestamps
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  dismissedReason?: string;

  // Auto-resolution
  autoResolved?: boolean;
  autoResolveReason?: string;
}

// ============================================
// AUDITOR CONFIGURATION
// ============================================

export interface AuditorConfig {
  enabled: boolean;
  roles: UserRole[];

  // Frequency settings
  realtimeEnabled: boolean;
  hourlyRunEnabled: boolean;
  dailyRunEnabled: boolean;
  weeklyRunEnabled: boolean;

  // Notification settings
  notifyOnCritical: boolean;
  notifyOnHigh: boolean;
  notifyOnMedium: boolean;
  notifyRecipients: string[];

  // Thresholds
  maxFindingsPerRun: number;
  autoAcknowledgeAfterDays: number;
  autoResolveEnabled: boolean;
}

export const DEFAULT_AUDITOR_CONFIG: AuditorConfig = {
  enabled: true,
  roles: ['contractor', 'cfo', 'coo', 'sitelead', 'director'],
  realtimeEnabled: true,
  hourlyRunEnabled: false,
  dailyRunEnabled: true,
  weeklyRunEnabled: true,
  notifyOnCritical: true,
  notifyOnHigh: true,
  notifyOnMedium: false,
  notifyRecipients: [],
  maxFindingsPerRun: 50,
  autoAcknowledgeAfterDays: 7,
  autoResolveEnabled: true,
};

// ============================================
// AUDITOR STATS
// ============================================

export interface AuditStats {
  totalFindings: number;
  newFindings: number;
  acknowledgedFindings: number;
  resolvedFindings: number;
  dismissedFindings: number;

  bySeverity: Record<AuditSeverity, number>;
  byRole: Record<UserRole, number>;
  byCategory: Record<string, number>;

  // Trends
  findingsLast7Days: number;
  findingsLast30Days: number;
  resolutionRate: number;
  averageResolutionTime: number;  // Hours

  // Financial impact
  totalFinancialImpact: number;
  potentialSavings: number;
  realizedSavings: number;
}

// ============================================
// AUDIT RUN
// ============================================

export interface AuditRun {
  id: string;
  frequency: CheckFrequency;
  startedAt: string;
  completedAt?: string;

  categoriesChecked: AuditCategoryId[];
  findingsGenerated: number;
  findingsAutoResolved: number;

  status: 'running' | 'completed' | 'failed';
  error?: string;

  duration?: number;  // Milliseconds
}

// ============================================
// FILTERS
// ============================================

export interface AuditFilters {
  roles?: UserRole[];
  categories?: AuditCategoryId[];
  severity?: AuditSeverity[];
  status?: AuditStatus[];
  dateFrom?: string;
  dateTo?: string;
  projectId?: string;
  hasFinancialImpact?: boolean;
  minFinancialImpact?: number;
}
