// =============================================================================
// SCHEDULE FRAGILITY TYPES
// =============================================================================
// Type definitions for the Schedule Fragility Scoring feature (P2)
// Implements dynamic fragility analysis and what-if scenarios (a16z E11)
// =============================================================================

// ============================================
// CORE TYPES
// ============================================

export interface Activity {
  id: string;
  projectId: string;
  name: string;
  description?: string;

  // Timing
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  duration: number;              // Days
  remainingDuration?: number;

  // Progress
  percentComplete: number;
  status: ActivityStatus;

  // Dependencies
  predecessors: string[];        // Activity IDs
  successors: string[];          // Activity IDs
  dependencyType: DependencyType;

  // Resources
  assignedResources: string[];
  resourceRequirements?: {
    type: string;
    quantity: number;
    unit: string;
  }[];

  // Float/Slack
  totalFloat: number;            // Days of flexibility
  freeFloat: number;

  // Flags
  isCriticalPath: boolean;
  isMilestone: boolean;

  // External factors
  weatherSensitive: boolean;
  permitRequired: boolean;
  permitId?: string;

  // Metadata
  wbsCode?: string;
  tradeCode?: string;
  phase?: string;
}

export type ActivityStatus =
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'delayed'
  | 'on-hold'
  | 'cancelled';

export type DependencyType =
  | 'finish-to-start'    // FS - Most common
  | 'start-to-start'     // SS
  | 'finish-to-finish'   // FF
  | 'start-to-finish';   // SF

// ============================================
// FRAGILITY SCORING
// ============================================

export interface FragilityScore {
  projectId: string;
  projectName: string;
  calculatedAt: string;

  // Overall score (0-100, higher = more fragile)
  overallScore: number;
  fragility: FragilityLevel;

  // Factor breakdown
  factors: FragilityFactors;

  // Critical activities
  criticalPathLength: number;     // Days
  criticalActivitiesCount: number;
  fragileActivities: ActivityRisk[];

  // Alerts
  alerts: FragilityAlert[];

  // What-if scenarios
  whatIfScenarios: Scenario[];

  // Recommendations
  recommendations: FragilityRecommendation[];
}

export type FragilityLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface FragilityFactors {
  criticalPathBuffer: FactorScore;
  dependencyDensity: FactorScore;
  resourceContention: FactorScore;
  weatherExposure: FactorScore;
  permitRisk: FactorScore;
  supplierRisk?: FactorScore;
  progressVariance?: FactorScore;
}

export interface FactorScore {
  name: string;
  score: number;               // 0-100
  weight: number;              // Contribution to overall
  description: string;
  status: 'good' | 'warning' | 'danger';
  details?: string;
}

// ============================================
// ACTIVITY RISK
// ============================================

export interface ActivityRisk {
  activityId: string;
  activityName: string;

  // Risk assessment
  riskScore: number;           // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Why it's risky
  riskFactors: {
    factor: string;
    contribution: number;
    description: string;
  }[];

  // Impact if delayed
  delayImpact: {
    projectDelayDays: number;
    affectedActivities: number;
    costImpact?: number;
  };

  // Current status
  totalFloat: number;
  daysRemaining?: number;
  percentComplete: number;

  // Mitigation suggestions
  mitigations: string[];
}

// ============================================
// FRAGILITY ALERTS
// ============================================

export type AlertType =
  | 'low-float'
  | 'delay-propagation'
  | 'resource-conflict'
  | 'weather-risk'
  | 'permit-delay'
  | 'critical-path-change'
  | 'milestone-at-risk'
  | 'dependency-chain';

export interface FragilityAlert {
  id: string;
  projectId: string;
  type: AlertType;
  severity: 'info' | 'warning' | 'danger' | 'critical';

  // Alert details
  title: string;
  message: string;
  affectedActivityIds: string[];

  // Impact
  potentialDelayDays?: number;
  potentialCostImpact?: number;

  // Timing
  detectedAt: string;
  dueBy?: string;

  // Status
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: string;

  // Recommendations
  suggestedActions: string[];
}

// ============================================
// WHAT-IF SCENARIOS
// ============================================

export interface Scenario {
  id: string;
  name: string;
  description: string;
  type: ScenarioType;

  // Scenario parameters
  parameters: ScenarioParameter[];

  // Results (after analysis)
  results?: ScenarioResults;

  // Metadata
  createdAt: string;
  createdBy: string;
  lastRunAt?: string;
}

export type ScenarioType =
  | 'activity-delay'
  | 'resource-shortage'
  | 'weather-disruption'
  | 'permit-delay'
  | 'supplier-failure'
  | 'acceleration'
  | 'scope-change';

export interface ScenarioParameter {
  name: string;
  type: 'number' | 'date' | 'select' | 'activities';
  value: number | string | string[];
  unit?: string;
  description?: string;
}

export interface ScenarioResults {
  impactAnalysis: ImpactAnalysis;
  affectedActivities: {
    activityId: string;
    activityName: string;
    originalEndDate: string;
    newEndDate: string;
    delayDays: number;
  }[];
  recommendations: string[];
  runAt: string;
}

// ============================================
// IMPACT ANALYSIS
// ============================================

export interface ImpactAnalysis {
  // Schedule impact
  projectDelayDays: number;
  originalCompletionDate: string;
  newCompletionDate: string;
  criticalPathChange: boolean;

  // Cost impact
  estimatedCostImpact?: number;
  currency?: 'GBP' | 'EUR';
  costBreakdown?: {
    category: string;
    amount: number;
    description: string;
  }[];

  // Resource impact
  resourceImpact?: {
    resourceType: string;
    impactDescription: string;
    additionalNeeded?: number;
  }[];

  // Milestone impact
  milestonesAffected: {
    milestoneId: string;
    milestoneName: string;
    originalDate: string;
    newDate: string;
    delayDays: number;
  }[];

  // Risk assessment
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  confidenceLevel: number;        // 0-100

  // Mitigation options
  mitigationOptions: {
    description: string;
    costToImplement?: number;
    timeRecovery: number;          // Days recovered
    feasibility: 'low' | 'medium' | 'high';
  }[];
}

// ============================================
// CRITICAL PATH
// ============================================

export interface CriticalPath {
  projectId: string;
  calculatedAt: string;

  // Path details
  totalDuration: number;          // Days
  startDate: string;
  endDate: string;

  // Activities on critical path
  activities: CriticalPathActivity[];

  // Path analysis
  longestChain: string[];         // Activity IDs
  bottlenecks: {
    activityId: string;
    activityName: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }[];

  // Float analysis
  averageFloat: number;
  activitiesWithZeroFloat: number;
  nearCriticalActivities: string[]; // Activities with float < 5 days
}

export interface CriticalPathActivity {
  activityId: string;
  activityName: string;
  startDate: string;
  endDate: string;
  duration: number;
  percentComplete: number;
  position: number;              // Position in critical path
  totalFloat: number;
  predecessorId?: string;
  successorId?: string;
}

// ============================================
// RECOMMENDATIONS
// ============================================

export interface FragilityRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: RecommendationCategory;

  // Recommendation details
  title: string;
  description: string;
  rationale: string;

  // Impact if implemented
  expectedBenefit: {
    fragilityReduction: number;   // Points
    floatIncrease?: number;       // Days
    costImpact?: number;
  };

  // Implementation
  implementationSteps?: string[];
  estimatedEffort?: string;
  responsibleRole?: string;

  // Related items
  relatedActivityIds?: string[];
  relatedAlertIds?: string[];
}

export type RecommendationCategory =
  | 'buffer-increase'
  | 'dependency-optimization'
  | 'resource-leveling'
  | 'risk-mitigation'
  | 'acceleration'
  | 'contingency-planning';

// ============================================
// STATISTICS
// ============================================

export interface ScheduleFragilityStats {
  // Overview
  totalProjects: number;
  averageFragilityScore: number;

  // Distribution
  fragilityDistribution: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };

  // Most fragile projects
  mostFragileProjects: {
    projectId: string;
    projectName: string;
    fragilityScore: number;
    fragilityLevel: FragilityLevel;
  }[];

  // Alert summary
  totalActiveAlerts: number;
  criticalAlerts: number;
  alertsByType: Record<AlertType, number>;

  // Trends
  fragilityTrend: 'improving' | 'stable' | 'worsening';
  trendPercentage: number;
}

// ============================================
// CONFIGURATION
// ============================================

export interface FragilityThresholds {
  // Overall score thresholds
  lowMax: number;                // Below this = low fragility
  moderateMax: number;           // Below this = moderate
  highMax: number;               // Below this = high, above = critical

  // Factor thresholds
  criticalPathBufferDanger: number;   // Days of buffer considered dangerous
  dependencyDensityWarning: number;   // Average dependencies per activity
  floatWarningThreshold: number;       // Days of float considered risky

  // Alert thresholds
  delayPropagationWarning: number;    // Days delay to trigger alert
}

export const DEFAULT_FRAGILITY_THRESHOLDS: FragilityThresholds = {
  lowMax: 30,
  moderateMax: 50,
  highMax: 75,
  criticalPathBufferDanger: 5,
  dependencyDensityWarning: 3,
  floatWarningThreshold: 3,
  delayPropagationWarning: 2,
};

// ============================================
// FACTOR WEIGHTS
// ============================================

export interface FragilityWeights {
  criticalPathBuffer: number;
  dependencyDensity: number;
  resourceContention: number;
  weatherExposure: number;
  permitRisk: number;
  supplierRisk: number;
  progressVariance: number;
}

export const DEFAULT_FRAGILITY_WEIGHTS: FragilityWeights = {
  criticalPathBuffer: 0.25,      // 25%
  dependencyDensity: 0.20,       // 20%
  resourceContention: 0.15,      // 15%
  weatherExposure: 0.10,         // 10%
  permitRisk: 0.10,              // 10%
  supplierRisk: 0.10,            // 10%
  progressVariance: 0.10,        // 10%
};
