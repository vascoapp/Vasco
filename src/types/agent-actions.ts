// =============================================================================
// AGENT ACTIONS - System of Action Types
// =============================================================================
// AI-generated actions with approval workflow (a16z "system of action" pattern)
// =============================================================================

// ============================================
// ACTION STAKES & APPROVAL WORKFLOW
// ============================================

export type ActionStake = 'low' | 'medium' | 'high';

export type ActionStatus =
  | 'pending'      // Awaiting user review
  | 'approved'     // User approved, ready to execute
  | 'executed'     // Action completed
  | 'rejected'     // User rejected
  | 'expired'      // Action no longer relevant
  | 'failed';      // Execution failed

export type ActionCategory =
  | 'quote'           // Quote creation, follow-up, optimization
  | 'invoice'         // Invoice generation, reminders, collection
  | 'scheduling'      // Job scheduling, rescheduling
  | 'purchasing'      // Material orders, restock
  | 'communication'   // Customer messages, follow-ups
  | 'compliance'      // Certification renewals, filings
  | 'reporting'       // Reports, summaries
  | 'job-management'; // Job status updates, closeout

// ============================================
// AGENT ACTION
// ============================================

export interface AgentAction<T = unknown> {
  id: string;

  // Action Identity
  type: ActionType;
  category: ActionCategory;
  stake: ActionStake;

  // Display
  title: string;
  description: string;
  reason: string;           // Why the agent recommends this

  // Payload - the actual action data
  payload: T;

  // Preview - what the user sees before approving
  preview?: ActionPreview;

  // Timing
  createdAt: string;
  expiresAt?: string;       // Action becomes stale
  executedAt?: string;

  // Workflow
  status: ActionStatus;
  requiresReview: boolean;

  // Context
  relatedEntityType?: 'job' | 'quote' | 'invoice' | 'customer' | 'material';
  relatedEntityId?: string;

  // Confidence
  confidence: number;       // 0-100, how confident is the agent

  // Impact Metrics
  estimatedImpact?: ActionImpact;

  // Audit Trail
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
  executionResult?: ActionResult;
}

export interface ActionPreview {
  // For messages/documents
  content?: string;

  // For financial actions
  amount?: number;
  currency?: 'EUR' | 'GBP';

  // For scheduling
  proposedDate?: string;
  proposedTime?: string;

  // Generic key-value preview
  fields?: { label: string; value: string }[];
}

export interface ActionImpact {
  // Time savings
  timeSavedMinutes?: number;

  // Financial
  revenueImpact?: number;
  costSavings?: number;

  // Metrics
  conversionLift?: number;  // percentage points
  paymentSpeedup?: number;  // days
}

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// ============================================
// ACTION TYPES (Specific Actions)
// ============================================

export type ActionType =
  // Quote Actions
  | 'quote-followup'
  | 'quote-reminder'
  | 'quote-optimize'
  | 'quote-generate'

  // Invoice Actions
  | 'invoice-generate'
  | 'invoice-reminder'
  | 'invoice-escalate'
  | 'payment-plan-suggest'

  // Scheduling Actions
  | 'schedule-propose'
  | 'schedule-reschedule'
  | 'schedule-optimize-day'

  // Purchasing Actions
  | 'material-order'
  | 'bulk-order-opportunity'
  | 'price-alert-action'

  // Communication Actions
  | 'customer-followup'
  | 'customer-check-in'
  | 'review-request'
  | 'referral-request'

  // Job Actions
  | 'job-closeout'
  | 'job-status-update'
  | 'warranty-create'

  // Compliance Actions
  | 'certification-renewal'
  | 'compliance-filing'
  | 'insurance-renewal'

  // Reporting Actions
  | 'weekly-summary'
  | 'monthly-report'
  | 'lender-update'

  // Enterprise Financial Actions (P0 - require final confirmation)
  | 'approve-payment'
  | 'approve-change-order'
  | 'release-retention'
  | 'draw-request'

  // Enterprise Contractual Actions
  | 'issue-instruction'
  | 'certify-completion'
  | 'terminate-contract'

  // Enterprise Compliance Actions
  | 'submit-permit'
  | 'discharge-condition'
  | 's106-payment';

// ============================================
// SPECIFIC ACTION PAYLOADS
// ============================================

export interface QuoteFollowupPayload {
  quoteId: string;
  customerId: string;
  customerName: string;
  quoteAmount: number;
  daysSinceSent: number;
  suggestedMessage: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'call';

  // Context
  similarQuotesConversionRate: number;
  optimalFollowupWindow: string;
}

export interface InvoiceReminderPayload {
  invoiceId: string;
  customerId: string;
  customerName: string;
  amount: number;
  daysOverdue: number;
  reminderCount: number;
  suggestedMessage: string;
  tone: 'friendly' | 'firm' | 'final';
  channel: 'email' | 'sms' | 'whatsapp';
}

export interface InvoiceGeneratePayload {
  jobId: string;
  customerId: string;
  customerName: string;
  lineItems: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string;
}

export interface MaterialOrderPayload {
  materials: {
    materialId: string;
    name: string;
    quantity: number;
    unit: string;
    supplierId: string;
    supplierName: string;
    unitPrice: number;
    totalPrice: number;
  }[];
  totalAmount: number;
  supplierId: string;
  supplierName: string;
  deliveryDate?: string;

  // Savings opportunity
  savings?: number;
  savingsReason?: string;
}

export interface ScheduleProposePayload {
  jobId: string;
  jobTitle: string;
  customerId: string;
  customerName: string;
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  estimatedDuration: number;

  // Why this slot
  reason: string;
  travelTimeFromPrevious?: number;
  weatherForecast?: string;
}

export interface JobCloseoutPayload {
  jobId: string;
  jobTitle: string;
  customerId: string;
  customerName: string;
  completionDate: string;

  // Generated artifacts
  invoiceDraft: InvoiceGeneratePayload;
  warrantyDocument?: {
    type: string;
    duration: string;
    coverage: string[];
  };
  followUpScheduled?: {
    date: string;
    type: 'satisfaction-check' | 'maintenance-reminder';
  };
  reviewRequest?: {
    message: string;
    platforms: string[];
  };
}

export interface ComplianceFilingPayload {
  type: 'btw-aangifte' | 'kvk-update' | 'certification-renewal' | 'insurance-renewal';
  documentId?: string;
  documentName: string;
  dueDate: string;
  generatedContent?: string;
  attachments?: string[];
  submissionUrl?: string;
}

// ============================================
// ACTION RULES & CONFIGURATION
// ============================================

export interface ActionRule {
  actionType: ActionType;
  stake: ActionStake;
  autoApproveThreshold?: number;  // Confidence level for auto-approval
  requiresConfirmation: boolean;
  requiresFinalConfirmation?: boolean;  // P0: Final execution confirmation gate for critical liability actions
  maxDailyLimit?: number;
  cooldownMinutes?: number;       // Min time between same action types
}

export const DEFAULT_ACTION_RULES: Record<ActionType, ActionRule> = {
  // Low stake - can auto-execute with notification
  'quote-followup': { actionType: 'quote-followup', stake: 'low', autoApproveThreshold: 85, requiresConfirmation: false },
  'customer-check-in': { actionType: 'customer-check-in', stake: 'low', autoApproveThreshold: 90, requiresConfirmation: false },
  'review-request': { actionType: 'review-request', stake: 'low', autoApproveThreshold: 90, requiresConfirmation: false },
  'weekly-summary': { actionType: 'weekly-summary', stake: 'low', autoApproveThreshold: 95, requiresConfirmation: false },
  'job-status-update': { actionType: 'job-status-update', stake: 'low', autoApproveThreshold: 85, requiresConfirmation: false },

  // Medium stake - draft + one-tap approval
  'quote-reminder': { actionType: 'quote-reminder', stake: 'medium', requiresConfirmation: true },
  'quote-generate': { actionType: 'quote-generate', stake: 'medium', requiresConfirmation: true },
  'invoice-generate': { actionType: 'invoice-generate', stake: 'medium', requiresConfirmation: true },
  'invoice-reminder': { actionType: 'invoice-reminder', stake: 'medium', requiresConfirmation: true },
  'schedule-propose': { actionType: 'schedule-propose', stake: 'medium', requiresConfirmation: true },
  'schedule-reschedule': { actionType: 'schedule-reschedule', stake: 'medium', requiresConfirmation: true },
  'material-order': { actionType: 'material-order', stake: 'medium', requiresConfirmation: true },
  'customer-followup': { actionType: 'customer-followup', stake: 'medium', requiresConfirmation: true },
  'referral-request': { actionType: 'referral-request', stake: 'medium', requiresConfirmation: true },
  'job-closeout': { actionType: 'job-closeout', stake: 'medium', requiresConfirmation: true },
  'warranty-create': { actionType: 'warranty-create', stake: 'medium', requiresConfirmation: true },
  'monthly-report': { actionType: 'monthly-report', stake: 'medium', requiresConfirmation: true },
  'lender-update': { actionType: 'lender-update', stake: 'medium', requiresConfirmation: true },
  'schedule-optimize-day': { actionType: 'schedule-optimize-day', stake: 'medium', requiresConfirmation: true },

  // High stake - explicit review required
  'quote-optimize': { actionType: 'quote-optimize', stake: 'high', requiresConfirmation: true },
  'invoice-escalate': { actionType: 'invoice-escalate', stake: 'high', requiresConfirmation: true },
  'payment-plan-suggest': { actionType: 'payment-plan-suggest', stake: 'high', requiresConfirmation: true },
  'bulk-order-opportunity': { actionType: 'bulk-order-opportunity', stake: 'high', requiresConfirmation: true },
  'price-alert-action': { actionType: 'price-alert-action', stake: 'high', requiresConfirmation: true },
  'certification-renewal': { actionType: 'certification-renewal', stake: 'high', requiresConfirmation: true },
  'compliance-filing': { actionType: 'compliance-filing', stake: 'high', requiresConfirmation: true },
  'insurance-renewal': { actionType: 'insurance-renewal', stake: 'high', requiresConfirmation: true },

  // ============================================
  // ENTERPRISE ACTIONS - P0 FINAL CONFIRMATION GATE
  // ============================================
  // Critical liability actions requiring explicit final confirmation before execution

  // Financial - require final confirmation for liability protection
  'approve-payment': {
    actionType: 'approve-payment',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: Final gate before payment execution
  },
  'approve-change-order': {
    actionType: 'approve-change-order',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: Budget impact requires final confirmation
  },
  'release-retention': {
    actionType: 'release-retention',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: Retention release is irreversible
  },
  'draw-request': {
    actionType: 'draw-request',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: Lender draw requests are high-stakes
  },

  // Contractual - critical legal implications
  'issue-instruction': {
    actionType: 'issue-instruction',
    stake: 'medium',
    requiresConfirmation: true,
    requiresFinalConfirmation: false,
  },
  'certify-completion': {
    actionType: 'certify-completion',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: Practical completion has legal implications
  },
  'terminate-contract': {
    actionType: 'terminate-contract',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: Contract termination is critical
  },

  // Compliance - regulatory implications
  'submit-permit': {
    actionType: 'submit-permit',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: Permit submissions are binding
  },
  'discharge-condition': {
    actionType: 'discharge-condition',
    stake: 'medium',
    requiresConfirmation: true,
    requiresFinalConfirmation: false,
  },
  's106-payment': {
    actionType: 's106-payment',
    stake: 'high',
    requiresConfirmation: true,
    requiresFinalConfirmation: true,  // P0: S106 payments are significant financial obligations
  },
};

// ============================================
// HOURS SAVED TRACKING
// ============================================

export interface HoursSavedEntry {
  id: string;
  actionId: string;
  actionType: ActionType;
  minutesSaved: number;
  description: string;
  savedAt: string;
}

export interface HoursSavedSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;

  // Breakdown by category
  byCategory: Record<ActionCategory, number>;

  // Top time savers
  topActions: {
    actionType: ActionType;
    totalMinutes: number;
    count: number;
  }[];
}

// Estimated time saved per action type (minutes)
export const ACTION_TIME_ESTIMATES: Record<ActionType, number> = {
  'quote-followup': 10,
  'quote-reminder': 8,
  'quote-optimize': 45,
  'quote-generate': 30,
  'invoice-generate': 20,
  'invoice-reminder': 8,
  'invoice-escalate': 15,
  'payment-plan-suggest': 25,
  'schedule-propose': 15,
  'schedule-reschedule': 20,
  'schedule-optimize-day': 30,
  'material-order': 25,
  'bulk-order-opportunity': 40,
  'price-alert-action': 15,
  'customer-followup': 12,
  'customer-check-in': 10,
  'review-request': 8,
  'referral-request': 10,
  'job-closeout': 45,
  'job-status-update': 5,
  'warranty-create': 20,
  'certification-renewal': 60,
  'compliance-filing': 90,
  'insurance-renewal': 45,
  'weekly-summary': 30,
  'monthly-report': 60,
  'lender-update': 45,
  'approve-payment': 15,
  'approve-change-order': 30,
  'release-retention': 20,
  'draw-request': 45,
  'issue-instruction': 15,
  'certify-completion': 30,
  'terminate-contract': 60,
  'submit-permit': 45,
  'discharge-condition': 20,
  's106-payment': 30,
};
