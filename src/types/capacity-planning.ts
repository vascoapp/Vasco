/**
 * Predictive Capacity Planning Types
 *
 * Helps contractors:
 * - Know when they have availability for new work
 * - Estimate job durations accurately
 * - Identify potential delays and overrun risks
 * - Provide customer-facing availability windows
 */

// ============================================
// CAPACITY & AVAILABILITY
// ============================================

export interface CapacitySlot {
  date: string; // ISO date
  dayOfWeek: string;

  // Time breakdown
  totalHours: number; // Available work hours (e.g., 8)
  bookedHours: number;
  availableHours: number;

  // Status
  status: 'available' | 'partial' | 'busy' | 'unavailable';
  utilization: number; // 0-100%

  // Scheduled items
  jobs: ScheduledJobSummary[];
  blockers: CapacityBlocker[];

  // Risk factors for the day
  weatherRisk: WeatherRiskLevel;
  weatherForecast?: WeatherForecast;
}

export interface ScheduledJobSummary {
  jobId: string;
  jobTitle: string;
  customerName: string;
  scheduledStart: string;
  scheduledEnd: string;
  estimatedHours: number;
  address: string;
  priority: 'low' | 'normal' | 'high' | 'emergency';
  status: 'scheduled' | 'in-progress' | 'at-risk';
  riskFactors?: string[];
}

export interface CapacityBlocker {
  type: 'personal' | 'travel' | 'break' | 'weather' | 'material-wait' | 'permit-wait';
  startTime: string;
  endTime: string;
  description: string;
  isFlexible: boolean; // Can be moved if needed
}

export type WeatherRiskLevel = 'none' | 'low' | 'moderate' | 'high';

export interface WeatherForecast {
  condition: 'clear' | 'cloudy' | 'rain' | 'heavy-rain' | 'snow' | 'wind';
  temperature: number;
  precipitation: number; // mm
  windSpeed: number; // km/h
  suitableForOutdoor: boolean;
}

// ============================================
// AVAILABILITY WINDOWS
// ============================================

export interface AvailabilityWindow {
  startDate: string;
  endDate: string;
  totalAvailableHours: number;

  // For customer communication
  displayText: string; // e.g., "Next available: Feb 12-14"
  confidence: number; // 0-100

  // What affects this window
  constraints: WindowConstraint[];

  // Recommended for specific job types
  suitableFor: JobTypeSuitability[];
}

export interface WindowConstraint {
  type: 'weather' | 'existing-job' | 'material-lead-time' | 'permit' | 'personal';
  description: string;
  severity: 'blocking' | 'warning' | 'info';
  resolvableBy?: string; // Date when constraint lifts
}

export interface JobTypeSuitability {
  jobType: string;
  suitability: 'ideal' | 'suitable' | 'possible' | 'not-recommended';
  reason: string;
}

// ============================================
// DURATION ESTIMATION
// ============================================

export interface DurationEstimate {
  jobId?: string;
  jobType: string;
  scope: JobScope;

  // Time estimates
  estimatedHours: number;
  rangeMin: number;
  rangeMax: number;
  confidence: number; // 0-100

  // Breakdown
  breakdown: DurationBreakdown;

  // Risk factors that could extend duration
  riskFactors: DurationRiskFactor[];

  // Historical comparison
  historicalComparison?: HistoricalComparison;

  // AI reasoning
  reasoning: string;
}

export interface JobScope {
  size: 'small' | 'medium' | 'large';
  complexity: 'simple' | 'moderate' | 'complex';
  isOutdoor: boolean;
  requiresPermit: boolean;
  materialLeadTime?: number; // days
  specialRequirements?: string[];
}

export interface DurationBreakdown {
  preparation: number; // hours
  travelTime: number;
  coreWork: number;
  cleanup: number;
  buffer: number; // Built-in contingency

  // Optional phases
  phases?: WorkPhase[];
}

export interface WorkPhase {
  name: string;
  estimatedHours: number;
  dependencies?: string[];
  canParallelize: boolean;
}

export interface DurationRiskFactor {
  factor: string;
  impact: 'minor' | 'moderate' | 'significant';
  probability: number; // 0-100
  additionalHours: number;
  mitigation?: string;
}

export interface HistoricalComparison {
  similarJobsCount: number;
  avgActualDuration: number;
  avgEstimatedDuration: number;
  accuracyRate: number; // % of jobs completed within estimate
  commonOverrunCauses: string[];
}

// ============================================
// OVERRUN PREDICTION
// ============================================

export interface OverrunPrediction {
  jobId: string;
  currentStatus: JobProgressStatus;

  // Prediction
  isAtRisk: boolean;
  overrunProbability: number; // 0-100
  predictedOverrunHours: number;

  // Indicators
  indicators: OverrunIndicator[];

  // Impact
  impact: OverrunImpact;

  // Recommendations
  recommendations: OverrunMitigation[];
}

export interface JobProgressStatus {
  percentComplete: number;
  hoursSpent: number;
  hoursEstimated: number;
  hoursRemaining: number;

  burnRate: number; // Hours per day
  projectedCompletion: string; // ISO date
  originalCompletion: string;

  behindSchedule: boolean;
  daysBehind: number;
}

export interface OverrunIndicator {
  type: 'pace' | 'scope-creep' | 'weather' | 'material' | 'complexity' | 'resource';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detectedAt: string;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface OverrunImpact {
  // Time impact
  delayDays: number;
  affectsNextJob: boolean;
  nextJobId?: string;

  // Financial impact
  additionalLaborCost: number;
  additionalMaterialCost: number;
  penaltyCost: number;
  totalCostImpact: number;

  // Customer impact
  customerSatisfactionRisk: 'low' | 'medium' | 'high';
  requiresCustomerNotification: boolean;
}

export interface OverrunMitigation {
  action: string;
  priority: 'immediate' | 'soon' | 'optional';

  expectedRecovery: number; // hours saved
  cost: number;
  feasibility: 'high' | 'medium' | 'low';

  steps: string[];
}

// ============================================
// DELAY FACTORS
// ============================================

export interface DelayFactor {
  id: string;
  category: 'weather' | 'material' | 'permit' | 'resource' | 'customer' | 'technical' | 'external';

  name: string;
  description: string;

  probability: number; // 0-100
  impactHours: number;

  // Timing
  likelyTiming: 'before-start' | 'early' | 'mid' | 'late' | 'any';

  // Detection
  earlyWarningSignals: string[];
  monitoringRequired: boolean;

  // Prevention
  preventable: boolean;
  preventionActions?: string[];
  preventionCost?: number;
}

export interface DelayAnalysis {
  jobId: string;

  // Overall risk
  overallDelayRisk: 'low' | 'moderate' | 'high' | 'critical';
  mostLikelyDelay: number; // hours
  worstCaseDelay: number;

  // By category
  factorsByCategory: Record<string, DelayFactor[]>;

  // Top risks
  topRisks: DelayFactor[];

  // Proactive recommendations
  proactiveActions: ProactiveAction[];
}

export interface ProactiveAction {
  action: string;
  targetFactor: string;
  timing: 'now' | 'before-start' | 'during-job';

  effort: 'minimal' | 'moderate' | 'significant';
  effectiveness: number; // 0-100

  description: string;
}

// ============================================
// CUSTOMER COMMUNICATION
// ============================================

export interface CustomerQuoteResponse {
  // Availability
  earliestStart: string;
  recommendedStart: string;

  // Duration
  estimatedDuration: string; // "2-3 days"
  estimatedCompletion: string;

  // Confidence
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceExplanation: string;

  // Potential delays to communicate
  knownRisks: CustomerRiskCommunication[];

  // Price factors
  rushAvailable: boolean;
  rushPremium?: number;
}

export interface CustomerRiskCommunication {
  risk: string;
  likelihood: 'unlikely' | 'possible' | 'likely';
  customerMessage: string; // Plain language explanation
  contingencyBuiltIn: boolean;
}

// ============================================
// ALERTS & NOTIFICATIONS
// ============================================

export interface CapacityAlert {
  id: string;
  type: CapacityAlertType;
  severity: 'info' | 'warning' | 'danger' | 'critical';

  title: string;
  message: string;

  // Context
  jobId?: string;
  date?: string;

  // Actions
  suggestedActions: string[];
  actionRequired: boolean;

  // State
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

export type CapacityAlertType =
  | 'overbooked'           // More work than capacity
  | 'underutilized'        // Low utilization opportunity
  | 'job-at-risk'          // Specific job overrun risk
  | 'cascade-delay'        // One delay affecting others
  | 'weather-impact'       // Weather affecting schedule
  | 'material-delay'       // Material not arriving in time
  | 'permit-delay'         // Permit approval delayed
  | 'customer-conflict'    // Double booking
  | 'travel-inefficiency'  // Poor route planning
  | 'availability-gap';    // Gap in schedule that could be filled

// ============================================
// SERVICE CONFIGURATION
// ============================================

export interface CapacityPlanningConfig {
  // Working hours
  defaultWorkdayHours: number; // e.g., 8
  workingDays: number[]; // 1-7 (Mon-Sun)

  // Buffers
  defaultBufferPercent: number; // e.g., 10%
  travelTimeBuffer: number; // minutes between jobs

  // Thresholds
  highUtilizationThreshold: number; // e.g., 85%
  lowUtilizationThreshold: number; // e.g., 50%
  overrunRiskThreshold: number; // % complete vs % time

  // Weather
  weatherCheckEnabled: boolean;
  outdoorJobWeatherCutoffs: {
    maxPrecipitation: number;
    maxWindSpeed: number;
    minTemperature: number;
  };

  // Historical learning
  useHistoricalData: boolean;
  minHistoricalJobs: number; // Before trusting historical estimates
}

// ============================================
// LEARNING & FEEDBACK
// ============================================

export interface JobOutcome {
  jobId: string;
  jobType: string;

  // Planned vs Actual
  estimatedHours: number;
  actualHours: number;

  estimatedStart: string;
  actualStart: string;

  estimatedCompletion: string;
  actualCompletion: string;

  // What happened
  delaysEncountered: EncounteredDelay[];

  // Feedback
  accuracyScore: number; // How close was estimate
  lessonsLearned?: string;
}

export interface EncounteredDelay {
  cause: string;
  category: DelayFactor['category'];
  hoursLost: number;
  wasAnticipated: boolean;
  couldHavePrevented: boolean;
}

export interface PredictionAccuracy {
  period: 'week' | 'month' | 'quarter' | 'year';

  totalJobs: number;
  onTimeCompletions: number;
  onTimeRate: number;

  avgEstimateError: number; // hours
  avgEstimateErrorPercent: number;

  // By factor
  accuracyByJobType: Record<string, number>;
  mostCommonDelays: Array<{ cause: string; count: number; avgHours: number }>;

  // Trend
  trend: 'improving' | 'stable' | 'declining';
}
