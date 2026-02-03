// =============================================================================
// ROI METRICS - Types
// =============================================================================
// Contractor-native KPIs and "Hours Saved" tracking
// a16z pattern: ROI expressed in hard operational metrics
// =============================================================================

// ============================================
// CORE ROI METRICS
// ============================================

export interface ContractorROIMetrics {
  contractorId: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'day' | 'week' | 'month' | 'quarter' | 'year';

  // === Time Metrics ===
  quoteToJobDays: MetricValue;          // Days from quote sent → job accepted
  jobToCashDays: MetricValue;           // Days from job complete → payment received
  quoteToCashDays: MetricValue;         // Full cycle: quote → cash
  avgInvoicePaymentDays: MetricValue;   // Average days to get paid

  // === Financial Efficiency ===
  effectiveHourlyRate: MetricValue;     // Revenue ÷ (billable + unbillable hours)
  billableHourlyRate: MetricValue;      // Revenue ÷ billable hours only
  revenuePerJob: MetricValue;           // Average job value
  materialMargin: MetricValue;          // (Quoted materials - Actual cost) ÷ Quoted

  // === Conversion Metrics ===
  quoteWinRate: MetricValue;            // Accepted quotes ÷ Total quotes sent
  winRateByTier: TierWinRates;          // Good/Better/Best conversion
  leadToQuoteRate: MetricValue;         // Leads that become quotes
  repeatCustomerRate: MetricValue;      // Revenue from repeat customers

  // === Operational Efficiency ===
  utilizationRate: MetricValue;         // Billable hours ÷ Available hours
  scheduleAdherence: MetricValue;       // Jobs started on time
  firstTimeFixRate: MetricValue;        // Jobs completed without return visit
  customerSatisfaction: MetricValue;    // Average rating

  // === Automation Impact ===
  hoursSaved: HoursSavedMetrics;
  automationROI: AutomationROI;
}

export interface MetricValue {
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;              // vs previous period
  benchmark?: number;                 // Industry/regional benchmark
  benchmarkLabel?: string;
  isGood: boolean;                    // Green = good performance
  target?: number;
  targetLabel?: string;
}

export interface TierWinRates {
  good: { rate: number; count: number; revenue: number };
  better: { rate: number; count: number; revenue: number };
  best: { rate: number; count: number; revenue: number };
  noTier: { rate: number; count: number; revenue: number };
  recommendedTier: 'good' | 'better' | 'best';
  insight: string;
}

// ============================================
// HOURS SAVED METRICS
// ============================================

export interface HoursSavedMetrics {
  // Period totals
  totalMinutesSaved: number;
  totalHoursSaved: number;

  // Breakdown by automation type
  byAutomationType: {
    type: AutomationType;
    minutesSaved: number;
    actionsCount: number;
    description: string;
  }[];

  // Comparison
  vsManualEstimate: number;          // Hours it would take manually
  efficiencyGain: number;            // Percentage improvement

  // Trending
  trend: 'increasing' | 'stable' | 'decreasing';
  projectedMonthlySavings: number;   // Hours

  // Value calculation
  hourlyRateUsed: number;
  monetaryValue: number;             // Hours × Hourly rate
}

export type AutomationType =
  | 'quote-generation'
  | 'quote-followup'
  | 'invoice-generation'
  | 'invoice-collection'
  | 'scheduling'
  | 'document-processing'
  | 'compliance-tracking'
  | 'reporting'
  | 'customer-communication'
  | 'material-ordering'
  | 'other';

// ============================================
// AUTOMATION ROI
// ============================================

export interface AutomationROI {
  // Subscription cost (if applicable)
  monthlyCost: number;

  // Value generated
  hoursSavedValue: number;
  revenueFromFasterConversion: number;
  savingsFromSmartPurchasing: number;
  reducedOverdueInvoices: number;

  totalValue: number;
  netROI: number;
  roiMultiple: number;              // totalValue ÷ monthlyCost

  // Breakdown
  breakdown: {
    category: string;
    value: number;
    description: string;
  }[];
}

// ============================================
// METRIC HISTORY & TRENDS
// ============================================

export interface MetricHistory {
  metricName: string;
  dataPoints: MetricDataPoint[];
  periodType: 'day' | 'week' | 'month';
}

export interface MetricDataPoint {
  periodStart: string;
  periodEnd: string;
  value: number;
  benchmark?: number;
}

// ============================================
// INSIGHTS & RECOMMENDATIONS
// ============================================

export interface ROIInsight {
  id: string;
  type: 'positive' | 'negative' | 'neutral' | 'opportunity';
  category: 'time' | 'money' | 'conversion' | 'efficiency' | 'automation';

  title: string;
  description: string;

  // Quantified impact
  impact?: {
    value: number;
    unit: string;
    isPositive: boolean;
  };

  // Action
  actionable: boolean;
  suggestedAction?: string;
  actionType?: string;

  // Priority
  priority: 'low' | 'medium' | 'high';

  createdAt: string;
}

export interface ROIGoal {
  id: string;
  metricName: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  deadline: string;
  progress: number;            // 0-100
  status: 'on-track' | 'at-risk' | 'behind' | 'achieved';
  createdAt: string;
}

// ============================================
// DASHBOARD SUMMARY
// ============================================

export interface ROIDashboardSummary {
  // Hero metrics
  hoursSavedThisWeek: number;
  hoursSavedThisMonth: number;
  moneyValueThisMonth: number;

  // Key performance
  quoteToCashDays: number;
  quoteToCashTrend: 'improving' | 'stable' | 'declining';
  quoteWinRate: number;
  quoteWinRateTrend: 'improving' | 'stable' | 'declining';
  effectiveHourlyRate: number;
  effectiveHourlyRateTrend: 'improving' | 'stable' | 'declining';

  // Comparisons
  vsBenchmark: {
    metric: string;
    yourValue: number;
    benchmark: number;
    percentDiff: number;
    isAbove: boolean;
  }[];

  // Active insights
  topInsights: ROIInsight[];

  // Goals progress
  activeGoals: ROIGoal[];

  // Automation summary
  automationSummary: {
    actionsThisWeek: number;
    topAutomations: {
      type: AutomationType;
      count: number;
      timeSaved: number;
    }[];
  };
}

// ============================================
// BENCHMARK DATA
// ============================================

export interface IndustryBenchmark {
  trade: string;
  region: string;
  metrics: {
    metricName: string;
    median: number;
    p25: number;        // 25th percentile
    p75: number;        // 75th percentile
    topPerformer: number;
    unit: string;
  }[];
  sampleSize: number;
  lastUpdated: string;
}

// Default benchmarks for Dutch contractors
export const DEFAULT_DUTCH_BENCHMARKS: Record<string, { median: number; unit: string; goodThreshold: number }> = {
  quoteWinRate: { median: 45, unit: '%', goodThreshold: 55 },
  quoteToCashDays: { median: 42, unit: 'days', goodThreshold: 30 },
  avgInvoicePaymentDays: { median: 28, unit: 'days', goodThreshold: 21 },
  effectiveHourlyRate: { median: 55, unit: '€/hour', goodThreshold: 65 },
  utilizationRate: { median: 65, unit: '%', goodThreshold: 75 },
  repeatCustomerRate: { median: 35, unit: '%', goodThreshold: 45 },
  materialMargin: { median: 15, unit: '%', goodThreshold: 20 },
  customerSatisfaction: { median: 4.2, unit: 'stars', goodThreshold: 4.5 },
};

// ============================================
// HOURS SAVED DISPLAY
// ============================================

export interface HoursSavedDisplayData {
  // Headline
  headline: string;              // "Vasco saved you 12 hours this week"
  subheadline: string;           // "That's €660 in time value"

  // Visual breakdown
  breakdown: {
    category: string;
    icon: string;
    hours: number;
    description: string;
  }[];

  // Comparison
  comparison: {
    label: string;
    value: string;
  };                              // "Like getting a free half-day every week"

  // Trend
  trendText: string;              // "Up 15% from last week"
  trendDirection: 'up' | 'down' | 'stable';

  // CTA
  ctaText?: string;
  ctaAction?: string;
}
