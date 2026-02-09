// =============================================================================
// VASCO INTELLIGENCE DATA SCHEMA
// =============================================================================
// The agentic moat: Every data point becomes training data for intelligence.
// This schema captures the full context needed for AI to learn and improve.
// =============================================================================

// ============================================
// CORE ENTITY TYPES
// ============================================

export interface EntityRef {
  id: string;
  type: EntityType;
  name: string;
  confidence: number; // 0-1, how confident we are in this entity resolution
}

export type EntityType =
  | 'contractor'
  | 'customer'
  | 'supplier'
  | 'material'
  | 'service'
  | 'worker'
  | 'project'
  | 'location'
  | 'document';

// ============================================
// DATA CAPTURE - Every Touchpoint
// ============================================

export interface DataEvent {
  id: string;
  timestamp: string;
  eventType: DataEventType;
  userId: string;
  sessionId: string;

  // Context
  context: EventContext;

  // The actual data
  payload: Record<string, unknown>;

  // Linked entities (resolved by entity resolution)
  entities: EntityRef[];

  // Outcome tracking (filled in later when we know the result)
  outcome?: EventOutcome;

  // Vector embedding for semantic search
  embeddingId?: string;
}

export type DataEventType =
  // Quotes
  | 'quote_created'
  | 'quote_sent'
  | 'quote_viewed'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'quote_expired'
  | 'quote_tier_selected' // Which tier they chose

  // Jobs
  | 'job_created'
  | 'job_scheduled'
  | 'job_started'
  | 'job_completed'
  | 'job_cancelled'
  | 'job_rescheduled'
  | 'job_status_updated'
  | 'lifecycle_advanced'
  | 'customer_preference_set'

  // Time tracking
  | 'clock_in'
  | 'clock_out'
  | 'break_start'
  | 'break_end'

  // Materials
  | 'material_searched'
  | 'material_price_checked'
  | 'material_purchased'
  | 'material_used'
  | 'material_wasted'

  // Payments
  | 'invoice_created'
  | 'invoice_sent'
  | 'payment_requested'
  | 'payment_received'
  | 'payment_overdue'
  | 'payment_reminder_sent'

  // Customer interactions
  | 'customer_contacted'
  | 'customer_viewed_quote'
  | 'customer_feedback'
  | 'customer_review'

  // Documents
  | 'document_uploaded'
  | 'document_classified'
  | 'document_extracted'
  | 'document_approved'

  // AI interactions
  | 'ai_recommendation_shown'
  | 'ai_recommendation_accepted'
  | 'ai_recommendation_rejected'
  | 'ai_recommendation_dismissed'
  | 'ai_prediction_made'

  // Invoices & payments (extended)
  | 'invoice_generated'
  | 'invoice_paid'
  | 'invoice_reminder_sent'
  | 'invoice_extracted'
  | 'expense_added'

  // Quotes (extended)
  | 'quote_analyzed'
  | 'quote_approved_by_customer'
  | 'quote_declined_by_customer'
  | 'optimization_applied'
  | 'optimization_rejected'
  | 'upsell_applied'

  // Follow-ups
  | 'follow_up_scheduled'
  | 'follow_up_completed'
  | 'follow_up_snoozed'
  | 'follow_up_cancelled'
  | 'follow_up_preferences_updated'

  // Compliance & certifications
  | 'license_added'
  | 'certification_added'
  | 'safety_checklist_completed'
  | 'regulatory_update_read'
  | 'insurance_policy_added'

  // Equipment
  | 'equipment_added'
  | 'equipment_updated'
  | 'equipment_checkout'
  | 'equipment_return'
  | 'maintenance_recorded'

  // Evidence & handover
  | 'evidence_pack_assembled'
  | 'handover_package_created'
  | 'handover_pdf_generated'
  | 'handover_portal_link_created'
  | 'handover_customer_signed'
  | 'completion_certificate_generated'
  | 'handover_package_sent'

  // Documents (extended)
  | 'document_updated'
  | 'document_deleted'
  | 'share_link_created'
  | 'document_shared'

  // Contractor network & referrals
  | 'connection_request_sent'
  | 'connection_request_accepted'
  | 'referral_sent'
  | 'referral_accepted'
  | 'referral_declined'
  | 'referral_completed'

  // Workflows
  | 'workflow_initiated'
  | 'workflow_step_completed'
  | 'workflow_payment_approved'
  | 'workflow_payment_released'

  // Customer portal & insights
  | 'customer_message_sent'
  | 'customer_interaction_added'
  | 'customer_decision_made'
  | 'maintenance_request_submitted'
  | 'portal_portal_accessed'
  | 'portal_category_viewed'
  | 'portal_item_viewed'
  | 'portal_decision_made'
  | 'portal_decision_changed'
  | 'portal_note_added'
  | 'portal_photo_uploaded'
  | 'portal_product_linked'
  | 'portal_help_viewed'
  | 'product_selected_by_customer'
  | 'regional_preference_recorded'
  | 'decision_timing_recorded'

  // AI assistant
  | 'assistant_conversation_started'
  | 'assistant_message_sent'
  | 'assistant_context_updated'

  // Insights & analytics
  | 'insight_dismissed'
  | 'insight_actioned'
  | 'report_exported'

  // Benchmarking
  | 'benchmark_goal_set'

  // Cash flow
  | 'cash_flow_forecast'

  // Price alerts
  | 'price_alert_created'
  | 'price_alert_actioned'
  | 'price_alert_snoozed'
  | 'price_alert_dismissed'
  | 'price_alert_purchased'
  | 'alert_preferences_updated'

  // Pricing engine
  | 'price_suggested'
  | 'price_outcome_recorded'

  // Project planner
  | 'project_predicted'
  | 'project_outcome_recorded'

  // Reorder & stock
  | 'stock_updated'
  | 'order_placed'
  | 'suggestion_ordered'
  | 'suggestion_dismissed'
  | 'suggestion_snoozed'

  // Reputation
  | 'review_responded'
  | 'review_requested'

  // Route optimizer
  | 'route_optimized'
  | 'route_job_status_updated'

  // Schedule fragility
  | 'what_if_analysis_run'

  // Service contracts
  | 'contract_created'
  | 'contract_cancelled'
  | 'contract_visit_scheduled'
  | 'contract_visit_completed'
  | 'contract_renewal_sent'
  | 'contract_renewal_accepted'

  // Supplier integration
  | 'supplier_connection_requested'
  | 'supplier_synced'
  | 'product_added_to_cart'
  | 'order_submitted'
  | 'supplier_reviewed'

  // Supplier reliability
  | 'delivery_tracked'
  | 'drift_detected'
  | 'alternatives_suggested'

  // Team management
  | 'team_member_added'
  | 'team_member_updated'
  | 'team_clock_in'
  | 'team_clock_out'
  | 'payroll_calculated'
  | 'skill_match_search'
  | 'leave_request_submitted'
  | 'leave_request_approved'
  | 'training_recorded'

  // Upsell engine
  | 'upsell_recommendations_generated'
  | 'upsell_presented'
  | 'upsell_outcome'

  // Warranty
  | 'warranty_registered'
  | 'warranty_claim_created'

  // Predictive maintenance
  | 'prediction_acknowledged'
  | 'recommendation_scheduled'
  | 'recommendation_completed'
  | 'recommendation_dismissed'
  | 'part_ordered'
  | 'predictive_analysis_run'

  // Recommendation feedback
  | 'recommendation_feedback_submitted'
  | 'recommendation_dismissed'

  // Decision tracking
  | 'decision_tracker_created'

  // Knowledge base
  | 'article_read'
  | 'tutorial_step_completed'

  // Lead generation
  | 'lead_created'
  | 'lead_status_changed'
  | 'lead_activity_added'

  // Capacity planning (no events, just type fix)
  | 'quick_feedback_positive'
  | 'quick_feedback_negative';

export interface EventContext {
  // Device & session
  platform: 'ios' | 'android' | 'web';
  appVersion: string;

  // Location context
  location?: {
    lat: number;
    lng: number;
    locality?: string;
    region?: string;
    country: string;
  };

  // Time context
  dayOfWeek: number;
  hourOfDay: number;
  isWeekend: boolean;
  season: 'spring' | 'summer' | 'autumn' | 'winter';

  // User context (optional - filled when available)
  userRole?: string;
  userTenure?: number; // days since signup
  userTier?: string; // subscription tier

  // Business context
  projectId?: string;
  customerId?: string;
  jobId?: string;
}

export interface EventOutcome {
  // Did the action lead to success?
  success: boolean;

  // Outcome details
  outcomeType: string;
  outcomeValue?: number;
  outcomeTimestamp: string;

  // Time to outcome
  daysToOutcome: number;

  // Related metrics
  metrics?: Record<string, number>;
}

// ============================================
// ENTITY RESOLUTION & KNOWLEDGE GRAPH
// ============================================

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[]; // Other names this entity goes by

  // Attributes
  attributes: Record<string, unknown>;

  // Relationships to other entities
  relationships: EntityRelationship[];

  // Time-series data
  history: EntityHistoryPoint[];

  // Aggregated stats
  stats: EntityStats;

  // Embedding for similarity search
  embeddingId?: string;

  // Confidence & source
  confidence: number;
  sources: string[]; // Where we learned about this entity

  createdAt: string;
  updatedAt: string;
}

export interface EntityRelationship {
  targetId: string;
  targetType: EntityType;
  relationshipType: RelationshipType;
  strength: number; // 0-1, how strong is this relationship
  attributes?: Record<string, unknown>;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
}

export type RelationshipType =
  | 'works_for'
  | 'works_with'
  | 'supplies_to'
  | 'buys_from'
  | 'located_at'
  | 'part_of'
  | 'competes_with'
  | 'similar_to'
  | 'alternative_to'
  | 'used_in'
  | 'recommended_with';

export interface EntityHistoryPoint {
  timestamp: string;
  attribute: string;
  value: unknown;
  source: string;
}

export interface EntityStats {
  totalInteractions: number;
  lastInteraction: string;

  // Type-specific stats (filled based on entity type)
  [key: string]: unknown;
}

// ============================================
// CONTRACTOR-SPECIFIC INTELLIGENCE
// ============================================

export interface ContractorProfile extends Entity {
  type: 'contractor';

  attributes: {
    trade: string;
    secondaryTrades: string[];
    serviceArea: string[];
    avgJobValue: number;
    avgJobDuration: number;
    avgQuoteAcceptRate: number;
    preferredPaymentTerms: number;
  };

  // Pricing intelligence
  pricingProfile: ContractorPricingProfile;

  // Customer intelligence
  customerProfile: ContractorCustomerProfile;

  // Material intelligence
  materialProfile: ContractorMaterialProfile;

  // Performance intelligence
  performanceProfile: ContractorPerformanceProfile;
}

export interface ContractorPricingProfile {
  // What pricing strategies work?
  avgQuoteValue: number;
  avgAcceptedQuoteValue: number;
  avgRejectedQuoteValue: number;

  // Tier preferences
  tierDistribution: {
    good: number;
    better: number;
    best: number;
  };

  // Price sensitivity by category
  categoryPricing: {
    category: string;
    avgPrice: number;
    winRate: number;
    priceElasticity: number; // How much does price affect win rate
  }[];

  // Seasonal patterns
  seasonalMultipliers: {
    season: string;
    multiplier: number;
  }[];

  // Margin analysis
  avgMargin: number;
  marginByCategory: Record<string, number>;
}

export interface ContractorCustomerProfile {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;

  // Customer segments
  segments: {
    segment: string; // "residential", "commercial", "property-manager"
    count: number;
    avgValue: number;
    avgPaymentDays: number;
  }[];

  // Payment behavior
  avgPaymentDays: number;
  onTimePaymentRate: number;
  overdueRate: number;

  // Churn patterns
  churnRate: number;
  avgCustomerLifetime: number;
}

export interface ContractorMaterialProfile {
  // Top materials used
  topMaterials: {
    materialId: string;
    name: string;
    brand: string;
    avgMonthlySpend: number;
    avgPrice: number;
    preferredSupplier: string;
  }[];

  // Supplier relationships
  suppliers: {
    supplierId: string;
    name: string;
    totalSpend: number;
    avgDiscount: number;
    reliability: number;
    avgLeadTime: number;
  }[];

  // Price sensitivity
  priceAlertThreshold: number; // % discount that triggers action
  bulkBuyingBehavior: boolean;

  // Waste tracking
  avgWasteRate: number;
}

export interface ContractorPerformanceProfile {
  // Job execution
  avgJobsPerMonth: number;
  completionRate: number;
  onTimeRate: number;
  avgDelayDays: number;

  // Quality
  avgRating: number;
  ratingTrend: 'improving' | 'stable' | 'declining';
  complaintRate: number;

  // Efficiency
  avgHoursPerJob: number;
  estimateAccuracy: number; // Actual vs estimated hours
  utilizationRate: number;

  // Revenue
  monthlyRevenue: number;
  revenueTrend: number; // % change
  revenuePerHour: number;
}

// ============================================
// CROSS-USER INTELLIGENCE (Anonymized)
// ============================================

export interface MarketIntelligence {
  // Aggregated across all users in a region/trade
  region: string;
  trade: string;
  period: string;

  // Pricing benchmarks
  pricing: {
    avgHourlyRate: number;
    avgHourlyRateP25: number;
    avgHourlyRateP75: number;
    avgMarkup: number;
    avgMaterialMarkup: number;
  };

  // Market trends
  trends: {
    demandIndex: number; // 0-100
    priceIndex: number;
    competitionIndex: number;
  };

  // Material prices
  materialPrices: {
    materialId: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceTrend: 'rising' | 'stable' | 'falling';
  }[];

  // Best practices
  bestPractices: {
    practice: string;
    adoptionRate: number;
    successMetric: string;
    successValue: number;
  }[];

  // Seasonal patterns
  seasonalPatterns: {
    month: number;
    demandMultiplier: number;
    priceMultiplier: number;
  }[];
}

// ============================================
// AI MODEL TRAINING DATA
// ============================================

export interface TrainingExample {
  id: string;
  modelType: AIModelType;
  createdAt: string;

  // Input features
  features: Record<string, number | string | boolean>;

  // Target/label
  target: unknown;

  // Actual outcome (for model evaluation)
  actualOutcome?: unknown;
  predictionAccuracy?: number;

  // Metadata
  weight: number; // How much to weight this example
  source: string;
}

export type AIModelType =
  | 'quote_acceptance' // Will customer accept this quote?
  | 'quote_pricing' // What price should we quote?
  | 'tier_selection' // Which tier will customer choose?
  | 'job_duration' // How long will this job take?
  | 'material_demand' // When should we buy materials?
  | 'payment_timing' // When will customer pay?
  | 'customer_churn' // Will customer return?
  | 'price_sensitivity' // How price-sensitive is customer?
  | 'supplier_selection' // Which supplier for this material?
  | 'schedule_optimization' // Best schedule for jobs
  | 'upsell_opportunity'; // Can we upsell?

export interface ModelPrediction {
  id: string;
  modelType: AIModelType;
  modelVersion: string;
  timestamp: string;

  // Input
  input: Record<string, unknown>;

  // Prediction
  prediction: unknown;
  confidence: number;
  explanation?: string[];

  // For tracking accuracy
  eventId?: string; // Link to DataEvent when outcome known
  wasCorrect?: boolean;
  errorMagnitude?: number;
}

// ============================================
// FEEDBACK LOOPS
// ============================================

export interface FeedbackLoop {
  id: string;
  name: string;
  description: string;

  // Trigger
  triggerEvent: DataEventType;

  // What we track
  trackedOutcome: DataEventType;

  // Time window
  maxDaysToOutcome: number;

  // How we learn
  learningRate: number;

  // Stats
  stats: {
    totalTriggers: number;
    totalOutcomes: number;
    conversionRate: number;
    avgDaysToOutcome: number;
    lastUpdated: string;
  };
}

// Core feedback loops for contractors:
export const CONTRACTOR_FEEDBACK_LOOPS: Omit<FeedbackLoop, 'id' | 'stats'>[] = [
  {
    name: 'Quote to Acceptance',
    description: 'Learn which quotes get accepted',
    triggerEvent: 'quote_sent',
    trackedOutcome: 'quote_accepted',
    maxDaysToOutcome: 30,
    learningRate: 0.1,
  },
  {
    name: 'Tier Selection',
    description: 'Learn which tier customers choose',
    triggerEvent: 'quote_viewed',
    trackedOutcome: 'quote_tier_selected',
    maxDaysToOutcome: 14,
    learningRate: 0.15,
  },
  {
    name: 'Job Duration Accuracy',
    description: 'Learn actual vs estimated job duration',
    triggerEvent: 'job_started',
    trackedOutcome: 'job_completed',
    maxDaysToOutcome: 90,
    learningRate: 0.1,
  },
  {
    name: 'Material Price Timing',
    description: 'Learn best time to purchase materials',
    triggerEvent: 'material_price_checked',
    trackedOutcome: 'material_purchased',
    maxDaysToOutcome: 7,
    learningRate: 0.2,
  },
  {
    name: 'Payment Collection',
    description: 'Learn payment timing patterns',
    triggerEvent: 'invoice_sent',
    trackedOutcome: 'payment_received',
    maxDaysToOutcome: 60,
    learningRate: 0.1,
  },
  {
    name: 'Customer Retention',
    description: 'Learn what drives repeat business',
    triggerEvent: 'job_completed',
    trackedOutcome: 'quote_created', // New quote = repeat customer
    maxDaysToOutcome: 365,
    learningRate: 0.05,
  },
  {
    name: 'AI Recommendation Effectiveness',
    description: 'Learn which AI suggestions work',
    triggerEvent: 'ai_recommendation_shown',
    trackedOutcome: 'ai_recommendation_accepted',
    maxDaysToOutcome: 1,
    learningRate: 0.2,
  },
];
