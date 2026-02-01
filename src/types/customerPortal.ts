// =============================================================================
// CUSTOMER PORTAL TYPES
// =============================================================================
// Types for customer-facing decision submission portal
// Enables two-sided data collection for the intelligence moat
// =============================================================================

import type { DecisionInputType, DecisionOption, ProjectPhase } from './decisions';

// ============================================
// CUSTOMER ACCESS
// ============================================

/**
 * Access token for customer portal
 * Allows customers to view and submit decisions without full account
 */
export interface CustomerAccessToken {
  id: string;
  trackerId: string;
  customerId: string;

  // Access control
  accessCode: string; // 6-character code for easy sharing
  accessUrl: string; // Full URL with token
  expiresAt: string;
  isActive: boolean;

  // Usage tracking
  createdAt: string;
  lastAccessedAt?: string;
  accessCount: number;

  // Permissions
  canViewPrices: boolean;
  canAddNotes: boolean;
  canUploadPhotos: boolean;
}

// ============================================
// CUSTOMER PORTAL VIEW
// ============================================

/**
 * Customer-facing view of their project decisions
 * Simplified from contractor view, focused on ease of use
 */
export interface CustomerPortalData {
  // Access info
  accessToken: string;

  // Project info (customer sees)
  projectName: string;
  contractorName: string;
  contractorCompany?: string;
  contractorPhone?: string;
  contractorLogo?: string;

  // Timeline
  projectStartDate: string;
  estimatedCompletionDate?: string;
  currentPhase: ProjectPhase;

  // Decisions
  categories: CustomerPortalCategory[];

  // Summary
  totalDecisions: number;
  completedDecisions: number;
  overdueDecisions: number;

  // Branding
  accentColor?: string;
}

export interface CustomerPortalCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;

  // Timeline
  phase: ProjectPhase;
  dueDate: string;
  isOverdue: boolean;

  // Items
  items: CustomerPortalItem[];
  completedCount: number;
  totalCount: number;
}

export interface CustomerPortalItem {
  id: string;
  name: string;
  description: string;
  helpText?: string;
  exampleAnswer?: string;

  // Input
  inputType: DecisionInputType;
  options?: DecisionOption[];
  unit?: string;

  // Importance (shown to customer)
  priority: 'critical' | 'important' | 'optional';
  whyItMatters?: string; // Customer-friendly explanation

  // Status
  status: 'pending' | 'decided' | 'skipped';
  dueDate: string;
  isOverdue: boolean;

  // Customer's response
  value?: string | number | boolean | string[];
  notes?: string;
  photoUrls?: string[];
  decidedAt?: string;

  // Product linking (for data moat)
  linkedProductId?: string;
  linkedProductName?: string;
  linkedProductUrl?: string;
}

// ============================================
// CUSTOMER DECISION SUBMISSION
// ============================================

/**
 * When a customer submits a decision
 */
export interface CustomerDecisionSubmission {
  itemId: string;
  trackerId: string;
  customerId: string;

  // The decision
  value: string | number | boolean | string[];
  notes?: string;
  photoUrls?: string[];

  // Context for intelligence
  selectedOptionLabel?: string;
  timeToDecide?: number; // Seconds from viewing to deciding
  deviceType: 'mobile' | 'tablet' | 'desktop';

  // Product data (if they linked to a product)
  linkedProduct?: {
    name: string;
    brand?: string;
    url?: string;
    price?: number;
    retailer?: string;
  };

  submittedAt: string;
}

// ============================================
// INTELLIGENCE DATA CAPTURE
// ============================================

/**
 * Data captured from customer decisions for the moat
 * This feeds into pricing intelligence and recommendations
 */
export interface DecisionIntelligenceData {
  id: string;

  // Decision context
  decisionType: string; // e.g., 'toilet_style', 'paint_color'
  trade: string;
  projectType: string;

  // What they chose
  chosenValue: string;
  chosenLabel?: string;

  // Product data (valuable for pricing moat)
  linkedProduct?: {
    name: string;
    brand: string;
    category: string;
    price?: number;
    retailer?: string;
    url?: string;
  };

  // Context
  region: string;
  projectBudget?: 'budget' | 'mid-range' | 'premium';
  propertyType?: 'apartment' | 'house' | 'commercial';

  // Timing
  daysBeforeDeadline: number;
  wasOverdue: boolean;
  reminderCount: number;

  // Engagement
  timeToDecide: number;
  viewCount: number;

  capturedAt: string;
}

// ============================================
// CONTRACTOR SHARE SETTINGS
// ============================================

/**
 * Settings for how contractor shares with customers
 */
export interface CustomerShareSettings {
  // Access
  requireAccessCode: boolean;
  accessCodeExpiry: number; // Days

  // Visibility
  showPriceImpacts: boolean;
  showTimeline: boolean;
  showContractorContact: boolean;

  // Branding
  useCompanyBranding: boolean;
  companyLogo?: string;
  accentColor?: string;
  welcomeMessage?: string;

  // Notifications
  notifyOnDecision: boolean;
  notifyOnAccess: boolean;

  // Auto-reminders
  autoReminders: boolean;
  reminderDaysBefore: number[];
}

// ============================================
// CUSTOMER ACTIVITY
// ============================================

/**
 * Track customer engagement for insights
 */
export interface CustomerPortalActivity {
  id: string;
  trackerId: string;
  customerId: string;

  action:
    | 'portal_accessed'
    | 'category_viewed'
    | 'item_viewed'
    | 'decision_made'
    | 'decision_changed'
    | 'note_added'
    | 'photo_uploaded'
    | 'product_linked'
    | 'help_viewed';

  // Context
  itemId?: string;
  categoryId?: string;
  metadata?: Record<string, unknown>;

  // Device info
  deviceType: 'mobile' | 'tablet' | 'desktop';
  platform?: string;

  timestamp: string;
}
