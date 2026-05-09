// =============================================================================
// CUSTOMER DECISION TRACKING TYPES
// =============================================================================
// Helps contractors guide customers through project decisions
// Reduces delays, improves experience, builds repeat business
// =============================================================================

// ============================================
// DECISION TEMPLATES
// ============================================

/**
 * A template defines a standard set of decisions for a project type
 * Contractors can use these as-is or customize for specific jobs
 */
export interface DecisionTemplate {
  id: string;
  name: string;
  description: string;
  trade: Trade;
  projectType: string;

  // The decisions in this template
  categories: DecisionCategory[];

  // Metadata
  estimatedTotalDecisions: number;
  avgDaysToComplete: number;
  usageCount: number; // How many times this template has been used

  // For learning
  isSystemTemplate: boolean;
  createdBy?: string;
  createdAt: string;
}

export type Trade =
  | 'general_contractor'
  | 'painter'
  | 'electrician'
  | 'plumber'
  | 'carpenter'
  | 'tiler'
  | 'kitchen_fitter'
  | 'bathroom_fitter'
  | 'flooring'
  | 'roofing'
  | 'solar'
  | 'insulation'
  | 'landscaping'
  | 'glazing'
  | 'plastering'
  | 'other';

/**
 * Categories group related decisions
 * e.g., "Electrical Fixtures", "Paint Colors", "Door Hardware"
 */
export interface DecisionCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;

  // When should this category be decided?
  phase: ProjectPhase;
  daysBeforePhaseStart: number; // How many days before phase starts

  // The individual decisions
  items: DecisionItem[];
}

export type ProjectPhase =
  | 'planning'
  | 'demolition'
  | 'rough_in'
  | 'installation'
  | 'finishing'
  | 'final';

/**
 * Individual decision item
 * e.g., "Kitchen outlet quantity", "Master bedroom paint color"
 */
export interface DecisionItem {
  id: string;
  name: string;
  description: string;

  // Help the customer
  helpText?: string;
  exampleAnswer?: string;
  photoRequired?: boolean;
  linkUrl?: string; // Link to product page, inspiration, etc.

  // Input type
  inputType: DecisionInputType;
  options?: DecisionOption[]; // For select/multiselect
  unit?: string; // For number inputs

  // Importance
  priority: 'critical' | 'important' | 'nice_to_have' | 'optional';
  impactIfDelayed: string; // What happens if this decision is late

  // Dependencies
  dependsOn?: string[]; // IDs of other decisions this depends on
}

export type DecisionInputType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'photo'
  | 'color'
  | 'boolean'
  | 'date'
  | 'payment_method'; // Customer payment preference selector

export interface DecisionOption {
  value: string;
  label: string;
  description?: string;
  imageUrl?: string;
  priceImpact?: number; // +/- from base price
  // R66 round 45: customer-facing supply context. Pre-R45 customers saw
  // only the option label + price impact (when non-zero) — no signal on
  // whether the contractor could actually deliver it next week vs. in 4
  // weeks. NL renovations queue 6-12 weeks ahead so this is real decision
  // input. Contractor sets these on the template / per-tracker; portal
  // surfaces them inline next to the price tag.
  stockStatus?: 'in_stock' | 'low_stock' | 'order_only' | 'special_order';
  leadTimeDays?: number;
  // Optional explicit base-price label for "standard / no extra cost" — when
  // priceImpact is 0 the customer historically saw nothing. Now we render
  // this label so every option has visible price context.
  basePriceLabel?: string;
}

// ============================================
// CUSTOMER DECISIONS (Instance)
// ============================================

/**
 * A customer decision tracker instance for a specific job
 */
export interface CustomerDecisionTracker {
  id: string;
  jobId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;

  // Template used (can be customized)
  templateId: string;
  templateName: string;

  // Project timeline
  projectStartDate: string;
  phases: PhaseSchedule[];

  // The decisions with customer responses
  categories: CustomerDecisionCategory[];

  // Summary stats
  totalDecisions: number;
  decidedCount: number;
  pendingCount: number;
  overdueCount: number;

  // Communication
  lastReminderSent?: string;
  reminderFrequency: 'daily' | 'every_2_days' | 'weekly' | 'manual';
  preferredChannel: 'whatsapp' | 'sms' | 'email';

  // Status
  status: 'active' | 'completed' | 'paused';
  // R66 round 32: capability-URL for the customer-facing portal at
  // /customer/[code]. Generated FE-side at create time (32 hex / 128 bits)
  // and stored on decision_trackers.access_code. Optional because legacy
  // local-only trackers from pre-R30 don't have one.
  accessCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseSchedule {
  phase: ProjectPhase;
  startDate: string;
  endDate?: string;
}

export interface CustomerDecisionCategory {
  id: string;
  categoryId: string;
  name: string;
  phase: ProjectPhase;
  dueDate: string;

  items: CustomerDecisionItem[];

  // Computed
  isOverdue: boolean;
  completedCount: number;
  totalCount: number;
}

export interface CustomerDecisionItem {
  id: string;
  itemId: string;
  name: string;
  description: string;
  inputType: DecisionInputType;
  options?: DecisionOption[];
  priority: 'critical' | 'important' | 'nice_to_have' | 'optional';

  // Customer's response
  status: 'pending' | 'decided' | 'skipped';
  value?: string | number | boolean | string[];
  notes?: string;
  photoUrl?: string;
  decidedAt?: string;

  // Timeline
  dueDate: string;
  isOverdue: boolean;

  // Reminders sent
  remindersSent: number;
  lastReminderAt?: string;
}

// ============================================
// REMINDER & COMMUNICATION
// ============================================

export interface DecisionReminder {
  id: string;
  trackerId: string;
  customerId: string;

  // What's pending
  overdueItems: { id: string; name: string; daysOverdue: number }[];
  upcomingItems: { id: string; name: string; dueInDays: number }[];

  // Message
  channel: 'whatsapp' | 'sms' | 'email';
  message: string;
  sentAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';

  // Response
  customerRespondedAt?: string;
  decisionsCompletedAfter?: number;
}

// ============================================
// ANALYTICS
// ============================================

export interface DecisionAnalytics {
  // Overall performance
  avgDecisionTime: number; // Days from request to decision
  avgOverdueRate: number; // % of decisions that go overdue
  avgDecisionsPerProject: number;

  // By category
  categoryPerformance: {
    categoryName: string;
    avgDaysToDecide: number;
    overdueRate: number;
  }[];

  // Impact
  projectsWithNoDelays: number;
  projectsWithDelays: number;
  avgDelayReduction: number; // vs before using this feature

  // Customer satisfaction
  avgCustomerRating?: number;
  repeatCustomerRate: number;
}
