// =============================================================================
// SUPPLIER RELIABILITY TYPES
// =============================================================================
// Type definitions for the Supplier Reliability Tracking feature (P1)
// Implements supplier performance monitoring and drift detection (a16z E11)
// =============================================================================

// ============================================
// CORE TYPES
// ============================================

export interface Supplier {
  id: string;
  name: string;
  category: SupplierCategory;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  accountNumber?: string;
  paymentTerms?: string;
  preferredStatus: boolean;
  activeStatus: 'active' | 'inactive' | 'suspended' | 'probation';
  createdAt: string;
  updatedAt: string;
}

export type SupplierCategory =
  | 'materials'
  | 'equipment'
  | 'tools'
  | 'safety'
  | 'consumables'
  | 'subcontractor'
  | 'professional-services'
  | 'plant-hire'
  | 'waste-management'
  | 'utilities'
  | 'other';

// ============================================
// PERFORMANCE METRICS
// ============================================

export interface SupplierMetrics {
  onTimeDeliveryRate: number;       // Percentage of orders delivered on time (0-100)
  qualityScore: number;              // Average quality rating (0-100)
  priceStability: number;            // Inverse of price variance (0-100, higher = more stable)
  responsiveness: number;            // Score based on response times (0-100)
  disputeRate: number;               // Percentage of orders with disputes (0-100)
  orderAccuracy: number;             // Percentage of orders without errors (0-100)
  documentationQuality: number;      // Quality of invoices, delivery notes (0-100)
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  category: SupplierCategory;

  // Current metrics
  metrics: SupplierMetrics;

  // Trend analysis
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;           // Change in reliability score over period

  // Composite score
  reliabilityScore: number;          // Overall reliability (0-100)
  reliabilityGrade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Historical data
  historicalScores: {
    date: string;
    score: number;
  }[];

  // Activity stats
  totalOrders: number;
  totalSpend: number;
  currency: 'GBP' | 'EUR';
  lastOrderDate?: string;

  // Alerts
  alerts: (ReliabilityAlert | DriftAlert)[];

  // Assessment
  lastAssessedAt: string;
  nextAssessmentDue?: string;
}

export interface ReliabilityAlert {
  id: string;
  type: string;
  message: string;
  severity: DriftSeverity;
  date: string;
}

// ============================================
// DELIVERY TRACKING
// ============================================

export interface DeliveryRecord {
  id: string;
  supplierId: string;
  orderId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;

  // Delivery status
  status: 'pending' | 'delivered' | 'delayed' | 'partial' | 'cancelled';
  delayDays?: number;

  // Quality assessment
  qualityScore?: number;             // 0-100
  qualityNotes?: string;
  hasIssues: boolean;
  issueDescription?: string;

  // Quantity
  orderedQuantity: number;
  deliveredQuantity?: number;
  unit: string;

  // Financial
  orderedAmount: number;
  invoicedAmount?: number;
  currency: 'GBP' | 'EUR';

  // Documentation
  deliveryNoteUri?: string;
  photosUri?: string[];

  // Metadata
  recordedBy: string;
  recordedAt: string;
  projectId?: string;
  siteId?: string;
}

// ============================================
// DRIFT DETECTION
// ============================================

export type DriftSeverity = 'low' | 'medium' | 'high' | 'critical';

export type DriftType =
  | 'delivery-delays'
  | 'quality-decline'
  | 'price-increase'
  | 'responsiveness-drop'
  | 'dispute-increase'
  | 'overall-decline';

export interface DriftAlert {
  id: string;
  supplierId: string;
  supplierName: string;
  type: DriftType;
  severity: DriftSeverity;

  // Drift details
  metricName: string;
  previousValue: number;
  currentValue: number;
  changePercentage: number;

  // Context
  message: string;
  description: string;
  recommendation: string;

  // Timing
  detectedAt: string;
  periodStart: string;
  periodEnd: string;

  // Status
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;

  // Impact
  impactAssessment?: {
    projectsAffected: number;
    potentialCostImpact: number;
    scheduleRiskLevel: 'low' | 'medium' | 'high';
  };
}

// ============================================
// RANKING & COMPARISON
// ============================================

export interface SupplierRanking {
  rank: number;
  supplierId: string;
  supplierName: string;
  category: SupplierCategory;
  reliabilityScore: number;
  trend: 'improving' | 'stable' | 'declining';
  totalOrders: number;
  totalSpend: number;
  currency: 'GBP' | 'EUR';
}

export interface SupplierComparison {
  suppliers: SupplierPerformance[];
  category: SupplierCategory;
  comparisonDate: string;

  // Averages for the category
  categoryAverages: {
    reliabilityScore: number;
    onTimeDeliveryRate: number;
    qualityScore: number;
    priceStability: number;
  };

  // Best performer
  topPerformer: {
    supplierId: string;
    supplierName: string;
    reliabilityScore: number;
  };
}

// ============================================
// ALTERNATIVE SUGGESTIONS
// ============================================

export interface AlternativeSupplier {
  supplierId: string;
  supplierName: string;
  category: SupplierCategory;

  // Comparison to current supplier
  reliabilityScore: number;
  reliabilityDifference: number;    // Positive = better than current
  priceDifference?: number;          // Percentage difference
  leadTimeDifference?: number;       // Days difference

  // Why recommended
  reasons: string[];
  confidence: number;                // 0-100

  // Products/services match
  matchingProducts: number;          // Count of matching products
  matchPercentage: number;           // How well they match current needs
}

export interface AlternativeSuggestion {
  currentSupplierId: string;
  currentSupplierName: string;
  reason: string;                    // Why alternatives are suggested

  alternatives: AlternativeSupplier[];
  suggestedAt: string;

  // Action status
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  selectedAlternativeId?: string;
}

// ============================================
// SUPPLIER ASSESSMENT
// ============================================

export interface SupplierAssessment {
  id: string;
  supplierId: string;
  supplierName: string;
  assessmentDate: string;
  assessedBy: string;

  // Assessment scores
  scores: {
    category: string;
    score: number;
    weight: number;
    notes?: string;
  }[];

  // Overall result
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: 'continue' | 'monitor' | 'review' | 'terminate';

  // Action plan
  actionItems?: {
    description: string;
    dueDate: string;
    assignedTo?: string;
    status: 'pending' | 'in-progress' | 'completed';
  }[];

  // Previous assessment comparison
  previousAssessmentId?: string;
  previousScore?: number;
  scoreDifference?: number;

  // Next assessment
  nextAssessmentDue?: string;
}

// ============================================
// SERVICE STATISTICS
// ============================================

export interface SupplierReliabilityStats {
  // Overview
  totalSuppliers: number;
  activeSuppliers: number;
  suppliersOnProbation: number;

  // Performance distribution
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };

  // Trends
  trendDistribution: {
    improving: number;
    stable: number;
    declining: number;
  };

  // Alerts
  totalActiveAlerts: number;
  criticalAlerts: number;
  highAlerts: number;

  // Average metrics
  averageReliabilityScore: number;
  averageOnTimeDeliveryRate: number;
  averageQualityScore: number;

  // Top performers
  topPerformers: SupplierRanking[];

  // At risk
  atRiskSuppliers: {
    supplierId: string;
    supplierName: string;
    reliabilityScore: number;
    alertCount: number;
  }[];
}

// ============================================
// CONFIGURATION
// ============================================

export interface ReliabilityThresholds {
  // Score thresholds for grades
  gradeA: number;                    // >= this score = A
  gradeB: number;                    // >= this score = B
  gradeC: number;                    // >= this score = C
  gradeD: number;                    // >= this score = D
  // Below D = F

  // Alert thresholds
  criticalDecline: number;           // Percentage drop to trigger critical
  highDecline: number;               // Percentage drop to trigger high
  mediumDecline: number;             // Percentage drop to trigger medium

  // Minimum orders for reliable scoring
  minimumOrdersForScore: number;

  // Assessment frequency (days)
  assessmentFrequencyDays: number;
}

export const DEFAULT_RELIABILITY_THRESHOLDS: ReliabilityThresholds = {
  gradeA: 90,
  gradeB: 75,
  gradeC: 60,
  gradeD: 45,
  criticalDecline: 25,
  highDecline: 15,
  mediumDecline: 10,
  minimumOrdersForScore: 5,
  assessmentFrequencyDays: 90,
};

// ============================================
// METRIC WEIGHTS
// ============================================

export interface MetricWeights {
  onTimeDeliveryRate: number;
  qualityScore: number;
  priceStability: number;
  responsiveness: number;
  disputeRate: number;
  orderAccuracy: number;
  documentationQuality: number;
}

export const DEFAULT_METRIC_WEIGHTS: MetricWeights = {
  onTimeDeliveryRate: 0.25,          // 25%
  qualityScore: 0.25,                // 25%
  priceStability: 0.10,              // 10%
  responsiveness: 0.10,              // 10%
  disputeRate: 0.15,                 // 15% (inverted)
  orderAccuracy: 0.10,               // 10%
  documentationQuality: 0.05,        // 5%
};
