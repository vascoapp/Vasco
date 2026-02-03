// =============================================================================
// WORKFLOW AGENTS - Types
// =============================================================================
// Agentic workflow automation: Quote nurture, Cash collection, Job closeout
// a16z pattern: AI that "operates" not just "assists"
// =============================================================================

// ============================================
// WORKFLOW DEFINITIONS
// ============================================

export type WorkflowType =
  | 'quote-nurture'
  | 'cash-collection'
  | 'job-closeout'
  | 'material-reorder'
  | 'compliance-renewal'
  | 'customer-lifecycle'
  | 'review-generation';

export type WorkflowStatus =
  | 'idle'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Workflow {
  id: string;
  type: WorkflowType;
  name: string;
  description: string;

  // Target entity
  entityType: 'quote' | 'invoice' | 'job' | 'customer' | 'material' | 'certification';
  entityId: string;

  // Status
  status: WorkflowStatus;
  currentStepIndex: number;
  steps: WorkflowStep[];

  // Timing
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  nextActionAt?: string;

  // Context data
  context: Record<string, unknown>;

  // Results
  actionsExecuted: WorkflowActionLog[];
  outcome?: WorkflowOutcome;
}

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  description: string;

  // Trigger
  trigger: WorkflowTrigger;

  // Action
  action: WorkflowAction;

  // Conditions
  conditions?: WorkflowCondition[];
  skipConditions?: WorkflowCondition[];

  // Status
  status: 'pending' | 'waiting' | 'executing' | 'completed' | 'skipped' | 'failed';
  executedAt?: string;
  result?: unknown;
}

export interface WorkflowTrigger {
  type: 'immediate' | 'delay' | 'schedule' | 'event' | 'condition';

  // Delay trigger
  delayDays?: number;
  delayHours?: number;

  // Schedule trigger
  scheduledAt?: string;

  // Event trigger
  eventType?: string;

  // Condition trigger
  condition?: WorkflowCondition;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty' | 'is_not_empty';
  value: unknown;
  source: 'entity' | 'context' | 'external';
}

export interface WorkflowAction {
  type: WorkflowActionType;
  params: Record<string, unknown>;
  requiresApproval: boolean;
  approvalTimeout?: number;  // Hours before auto-skip
}

export type WorkflowActionType =
  // Communication
  | 'send-email'
  | 'send-sms'
  | 'send-whatsapp'
  | 'create-call-task'

  // Document generation
  | 'generate-invoice'
  | 'generate-quote'
  | 'generate-warranty'
  | 'generate-report'

  // Status updates
  | 'update-status'
  | 'mark-completed'
  | 'mark-lost'

  // Scheduling
  | 'schedule-followup'
  | 'create-reminder'
  | 'schedule-job'

  // Financial
  | 'create-payment-link'
  | 'apply-late-fee'
  | 'create-payment-plan'

  // Purchasing
  | 'create-purchase-order'
  | 'check-inventory'

  // External
  | 'notify-team'
  | 'log-activity'
  | 'trigger-webhook';

export interface WorkflowActionLog {
  stepId: string;
  actionType: WorkflowActionType;
  executedAt: string;
  success: boolean;
  result?: unknown;
  error?: string;
  approvedBy?: string;
  autoApproved: boolean;
}

export interface WorkflowOutcome {
  success: boolean;
  resultType: 'converted' | 'lost' | 'paid' | 'completed' | 'cancelled' | 'expired' | 'other';
  summary: string;
  metrics?: Record<string, number>;
}

// ============================================
// QUOTE NURTURE WORKFLOW
// ============================================

export interface QuoteNurtureWorkflow extends Workflow {
  type: 'quote-nurture';
  context: QuoteNurtureContext;
}

export interface QuoteNurtureContext {
  quoteId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  quoteAmount: number;
  quoteTier?: 'good' | 'better' | 'best';
  quoteSentAt: string;

  // Engagement tracking
  quoteViewed: boolean;
  quoteViewedAt?: string;
  viewCount: number;

  // Communication history
  remindersSent: number;
  lastContactAt?: string;
  lastContactType?: 'email' | 'sms' | 'call';

  // Customer signals
  customerResponded: boolean;
  customerResponse?: string;
  objections?: string[];

  // Conversion data
  similarQuotesConversionRate: number;
  optimalFollowupDays: number;
}

export const QUOTE_NURTURE_TEMPLATE: Omit<WorkflowStep, 'id' | 'status'>[] = [
  {
    order: 1,
    name: 'Initial follow-up',
    description: 'Friendly check-in 2 days after quote sent',
    trigger: { type: 'delay', delayDays: 2 },
    action: {
      type: 'send-email',
      params: { template: 'quote-followup-friendly' },
      requiresApproval: true,
    },
    skipConditions: [{ field: 'quoteViewed', operator: 'equals', value: true, source: 'context' }],
  },
  {
    order: 2,
    name: 'Value reminder',
    description: 'Highlight value proposition if no response',
    trigger: { type: 'delay', delayDays: 5 },
    action: {
      type: 'send-email',
      params: { template: 'quote-value-reminder' },
      requiresApproval: true,
    },
    conditions: [{ field: 'customerResponded', operator: 'equals', value: false, source: 'context' }],
  },
  {
    order: 3,
    name: 'Phone call task',
    description: 'Create task to call customer directly',
    trigger: { type: 'delay', delayDays: 7 },
    action: {
      type: 'create-call-task',
      params: { priority: 'high' },
      requiresApproval: false,
    },
    conditions: [{ field: 'customerResponded', operator: 'equals', value: false, source: 'context' }],
  },
  {
    order: 4,
    name: 'Final follow-up',
    description: 'Last attempt before marking as lost',
    trigger: { type: 'delay', delayDays: 12 },
    action: {
      type: 'send-email',
      params: { template: 'quote-final-followup' },
      requiresApproval: true,
    },
    conditions: [{ field: 'customerResponded', operator: 'equals', value: false, source: 'context' }],
  },
  {
    order: 5,
    name: 'Mark as lost',
    description: 'Auto-mark quote as lost if no conversion',
    trigger: { type: 'delay', delayDays: 14 },
    action: {
      type: 'mark-lost',
      params: { reason: 'no-response' },
      requiresApproval: false,
    },
    conditions: [{ field: 'customerResponded', operator: 'equals', value: false, source: 'context' }],
  },
];

// ============================================
// CASH COLLECTION WORKFLOW
// ============================================

export interface CashCollectionWorkflow extends Workflow {
  type: 'cash-collection';
  context: CashCollectionContext;
}

export interface CashCollectionContext {
  invoiceId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  invoiceAmount: number;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;

  // Payment tracking
  amountPaid: number;
  amountDue: number;
  partialPayments: { amount: number; date: string }[];

  // Communication history
  remindersSent: number;
  lastReminderAt?: string;
  lastReminderType?: 'friendly' | 'firm' | 'final';

  // Customer history
  customerPaymentHistory: 'good' | 'average' | 'poor';
  avgPaymentDays: number;
  previousOverdueCount: number;

  // Payment link
  paymentLinkUrl?: string;
  paymentLinkExpiry?: string;
}

export const CASH_COLLECTION_TEMPLATE: Omit<WorkflowStep, 'id' | 'status'>[] = [
  {
    order: 1,
    name: 'Due date reminder',
    description: 'Friendly reminder 3 days before due date',
    trigger: { type: 'schedule' },  // Scheduled for dueDate - 3 days
    action: {
      type: 'send-email',
      params: { template: 'invoice-due-soon', tone: 'friendly' },
      requiresApproval: false,
    },
  },
  {
    order: 2,
    name: 'Due today',
    description: 'Reminder on due date',
    trigger: { type: 'schedule' },  // Scheduled for dueDate
    action: {
      type: 'send-email',
      params: { template: 'invoice-due-today', tone: 'friendly' },
      requiresApproval: false,
    },
  },
  {
    order: 3,
    name: 'First overdue notice',
    description: 'Polite reminder 3 days overdue',
    trigger: { type: 'delay', delayDays: 3 },
    action: {
      type: 'send-email',
      params: { template: 'invoice-overdue-1', tone: 'friendly' },
      requiresApproval: true,
    },
  },
  {
    order: 4,
    name: 'Second reminder',
    description: 'Firmer reminder 7 days overdue',
    trigger: { type: 'delay', delayDays: 7 },
    action: {
      type: 'send-email',
      params: { template: 'invoice-overdue-2', tone: 'firm' },
      requiresApproval: true,
    },
  },
  {
    order: 5,
    name: 'Phone call',
    description: 'Personal call 14 days overdue',
    trigger: { type: 'delay', delayDays: 14 },
    action: {
      type: 'create-call-task',
      params: { priority: 'high', script: 'collection-call' },
      requiresApproval: false,
    },
  },
  {
    order: 6,
    name: 'Final notice',
    description: 'Final notice before escalation',
    trigger: { type: 'delay', delayDays: 21 },
    action: {
      type: 'send-email',
      params: { template: 'invoice-final-notice', tone: 'final' },
      requiresApproval: true,
    },
  },
  {
    order: 7,
    name: 'Payment plan offer',
    description: 'Offer payment plan 30 days overdue',
    trigger: { type: 'delay', delayDays: 30 },
    action: {
      type: 'create-payment-plan',
      params: { installments: 3 },
      requiresApproval: true,
    },
  },
];

// ============================================
// JOB CLOSEOUT WORKFLOW
// ============================================

export interface JobCloseoutWorkflow extends Workflow {
  type: 'job-closeout';
  context: JobCloseoutContext;
}

export interface JobCloseoutContext {
  jobId: string;
  jobTitle: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  completionDate: string;

  // Job details
  quotedAmount: number;
  actualAmount?: number;
  materialsUsed: { name: string; cost: number }[];
  hoursWorked: number;

  // Photos
  hasBeforePhotos: boolean;
  hasAfterPhotos: boolean;

  // Generated artifacts
  invoiceGenerated: boolean;
  invoiceId?: string;
  warrantyGenerated: boolean;
  warrantyId?: string;

  // Follow-up
  reviewRequested: boolean;
  satisfactionCheckScheduled: boolean;
}

export const JOB_CLOSEOUT_TEMPLATE: Omit<WorkflowStep, 'id' | 'status'>[] = [
  {
    order: 1,
    name: 'Generate invoice',
    description: 'Create invoice from job details',
    trigger: { type: 'immediate' },
    action: {
      type: 'generate-invoice',
      params: { includePhotos: true },
      requiresApproval: true,
    },
    conditions: [{ field: 'invoiceGenerated', operator: 'equals', value: false, source: 'context' }],
  },
  {
    order: 2,
    name: 'Create warranty',
    description: 'Generate warranty document',
    trigger: { type: 'immediate' },
    action: {
      type: 'generate-warranty',
      params: { type: 'standard', duration: '24-months' },
      requiresApproval: true,
    },
  },
  {
    order: 3,
    name: 'Send invoice',
    description: 'Send invoice with warranty to customer',
    trigger: { type: 'delay', delayHours: 1 },
    action: {
      type: 'send-email',
      params: { template: 'job-complete-invoice', attachWarranty: true },
      requiresApproval: true,
    },
  },
  {
    order: 4,
    name: 'Request review',
    description: 'Ask for review 3 days after completion',
    trigger: { type: 'delay', delayDays: 3 },
    action: {
      type: 'send-email',
      params: { template: 'review-request', platforms: ['google', 'facebook'] },
      requiresApproval: true,
    },
    conditions: [{ field: 'reviewRequested', operator: 'equals', value: false, source: 'context' }],
  },
  {
    order: 5,
    name: 'Satisfaction check',
    description: 'Check in 14 days after completion',
    trigger: { type: 'delay', delayDays: 14 },
    action: {
      type: 'send-email',
      params: { template: 'satisfaction-check' },
      requiresApproval: false,
    },
  },
  {
    order: 6,
    name: 'Schedule maintenance reminder',
    description: 'Set reminder for annual maintenance',
    trigger: { type: 'delay', delayDays: 30 },
    action: {
      type: 'schedule-followup',
      params: { type: 'maintenance-reminder', delayMonths: 11 },
      requiresApproval: false,
    },
  },
];

// ============================================
// MATERIAL REORDER WORKFLOW
// ============================================

export interface MaterialReorderWorkflow extends Workflow {
  type: 'material-reorder';
  context: MaterialReorderContext;
}

export interface MaterialReorderContext {
  materialId: string;
  materialName: string;
  currentStock: number;
  reorderLevel: number;
  reorderQuantity: number;

  // Supplier options
  suppliers: {
    supplierId: string;
    supplierName: string;
    price: number;
    inStock: boolean;
    deliveryDays: number;
  }[];

  // Recommendation
  recommendedSupplierId?: string;
  recommendedPrice?: number;
  potentialSavings?: number;

  // Urgency
  urgency: 'low' | 'medium' | 'high';
  upcomingJobsNeeding: number;
}

// ============================================
// WORKFLOW ENGINE CONFIGURATION
// ============================================

export interface WorkflowEngineConfig {
  // Timing
  checkIntervalMinutes: number;
  maxConcurrentWorkflows: number;

  // Approval
  defaultApprovalTimeoutHours: number;
  autoApproveAfterTimeout: boolean;

  // Limits
  maxActionsPerDay: number;
  maxEmailsPerCustomerPerWeek: number;

  // Hours
  workingHoursStart: number;  // 9 = 9:00 AM
  workingHoursEnd: number;    // 18 = 6:00 PM
  workingDays: number[];      // [1,2,3,4,5] = Mon-Fri
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowEngineConfig = {
  checkIntervalMinutes: 15,
  maxConcurrentWorkflows: 50,
  defaultApprovalTimeoutHours: 24,
  autoApproveAfterTimeout: false,
  maxActionsPerDay: 100,
  maxEmailsPerCustomerPerWeek: 3,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  workingDays: [1, 2, 3, 4, 5],
};

// ============================================
// WORKFLOW ANALYTICS
// ============================================

export interface WorkflowAnalytics {
  workflowType: WorkflowType;
  period: 'week' | 'month' | 'quarter';

  // Volume
  totalStarted: number;
  totalCompleted: number;
  totalFailed: number;
  totalCancelled: number;

  // Outcomes
  successRate: number;
  avgDurationDays: number;

  // Type-specific
  conversionRate?: number;      // For quote-nurture
  collectionRate?: number;      // For cash-collection
  avgDaysToPayment?: number;    // For cash-collection

  // Actions
  totalActionsExecuted: number;
  approvalRate: number;
  avgActionsPerWorkflow: number;
}
