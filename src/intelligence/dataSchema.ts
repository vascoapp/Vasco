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
  | 'ai_prediction_made';

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
