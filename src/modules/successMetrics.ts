// BuildOS Success Metrics Tracking
// ROI-focused metrics for demonstrating platform value

import type { Currency } from '../types/buildos';

// ============================================
// METRIC TYPES
// ============================================

export type MetricCategory =
  | 'financial'
  | 'efficiency'
  | 'compliance'
  | 'risk'
  | 'quality';

export type MetricPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type MetricTrend = 'improving' | 'stable' | 'declining';

// ============================================
// METRIC DEFINITIONS
// ============================================

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  category: MetricCategory;
  unit: string;
  direction: 'higher-better' | 'lower-better' | 'target';
  target?: number;
  benchmark?: number;
  industryBenchmark?: number;
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // Financial Metrics
  {
    id: 'dso',
    name: 'Days Sales Outstanding',
    description: 'Average days to collect payment after invoicing',
    category: 'financial',
    unit: 'days',
    direction: 'lower-better',
    target: 30,
    industryBenchmark: 45,
  },
  {
    id: 'invoice-cycle-time',
    name: 'Invoice Processing Time',
    description: 'Time from receipt to approval of invoices',
    category: 'financial',
    unit: 'days',
    direction: 'lower-better',
    target: 3,
    industryBenchmark: 7,
  },
  {
    id: 'payment-cert-cycle',
    name: 'Payment Certificate Cycle',
    description: 'Time from application to certified payment',
    category: 'financial',
    unit: 'days',
    direction: 'lower-better',
    target: 5,
    industryBenchmark: 14,
  },
  {
    id: 'cost-savings',
    name: 'Cost Savings Identified',
    description: 'Value of cost savings identified through analytics',
    category: 'financial',
    unit: 'currency',
    direction: 'higher-better',
  },
  {
    id: 'change-order-value',
    name: 'Change Order Savings',
    description: 'Savings from negotiated change orders',
    category: 'financial',
    unit: 'currency',
    direction: 'higher-better',
  },
  // Efficiency Metrics
  {
    id: 'hours-saved',
    name: 'Hours Saved',
    description: 'Manual hours saved through automation',
    category: 'efficiency',
    unit: 'hours',
    direction: 'higher-better',
  },
  {
    id: 'report-generation-time',
    name: 'Report Generation Time',
    description: 'Time to generate standard reports',
    category: 'efficiency',
    unit: 'minutes',
    direction: 'lower-better',
    target: 2,
    benchmark: 120, // Manual process
  },
  {
    id: 'document-processing-rate',
    name: 'Document Processing Rate',
    description: 'Documents processed per hour',
    category: 'efficiency',
    unit: 'docs/hour',
    direction: 'higher-better',
    target: 50,
    benchmark: 10, // Manual rate
  },
  {
    id: 'rfi-response-time',
    name: 'RFI Response Time',
    description: 'Average time to respond to RFIs',
    category: 'efficiency',
    unit: 'days',
    direction: 'lower-better',
    target: 3,
    industryBenchmark: 7,
  },
  {
    id: 'change-order-cycle',
    name: 'Change Order Approval Cycle',
    description: 'Time from submission to decision',
    category: 'efficiency',
    unit: 'days',
    direction: 'lower-better',
    target: 7,
    industryBenchmark: 21,
  },
  // Compliance Metrics
  {
    id: 'permit-on-time',
    name: 'Permit On-Time Rate',
    description: 'Percentage of permits decided within statutory period',
    category: 'compliance',
    unit: '%',
    direction: 'higher-better',
    target: 95,
  },
  {
    id: 'condition-discharge-rate',
    name: 'Condition Discharge Rate',
    description: 'Rate of planning condition discharge',
    category: 'compliance',
    unit: '%',
    direction: 'higher-better',
    target: 100,
  },
  {
    id: 's106-compliance',
    name: 'S106 Compliance Rate',
    description: 'Percentage of S106 obligations met on time',
    category: 'compliance',
    unit: '%',
    direction: 'higher-better',
    target: 100,
  },
  {
    id: 'audit-findings',
    name: 'Audit Findings',
    description: 'Number of audit findings per period',
    category: 'compliance',
    unit: 'count',
    direction: 'lower-better',
    target: 0,
  },
  // Risk Metrics
  {
    id: 'risks-mitigated',
    name: 'Risks Mitigated',
    description: 'Number of risks successfully mitigated',
    category: 'risk',
    unit: 'count',
    direction: 'higher-better',
  },
  {
    id: 'risk-exposure-reduction',
    name: 'Risk Exposure Reduction',
    description: 'Reduction in total risk exposure value',
    category: 'risk',
    unit: 'currency',
    direction: 'higher-better',
  },
  {
    id: 'overdue-invoices',
    name: 'Overdue Invoice Rate',
    description: 'Percentage of invoices past due',
    category: 'risk',
    unit: '%',
    direction: 'lower-better',
    target: 5,
    industryBenchmark: 15,
  },
  {
    id: 'schedule-variance',
    name: 'Schedule Variance',
    description: 'Days ahead or behind schedule',
    category: 'risk',
    unit: 'days',
    direction: 'target',
    target: 0,
  },
  // Quality Metrics
  {
    id: 'defect-closure-rate',
    name: 'Defect Closure Rate',
    description: 'Percentage of defects closed within SLA',
    category: 'quality',
    unit: '%',
    direction: 'higher-better',
    target: 95,
  },
  {
    id: 'first-time-right',
    name: 'First Time Right Rate',
    description: 'Percentage of work approved on first submission',
    category: 'quality',
    unit: '%',
    direction: 'higher-better',
    target: 90,
  },
  {
    id: 'rework-cost',
    name: 'Rework Cost',
    description: 'Total cost of rework and corrections',
    category: 'quality',
    unit: 'currency',
    direction: 'lower-better',
  },
];

// ============================================
// METRIC VALUES
// ============================================

export interface MetricValue {
  metricId: string;
  projectId?: string; // Optional - null for org-wide
  period: MetricPeriod;
  periodStart: string;
  periodEnd: string;
  value: number;
  previousValue?: number;
  trend: MetricTrend;
  percentChange?: number;
}

export interface MetricTimeSeries {
  metricId: string;
  projectId?: string;
  period: MetricPeriod;
  values: {
    date: string;
    value: number;
  }[];
}

// ============================================
// ROI CALCULATIONS
// ============================================

export interface ROICalculation {
  metricId: string;
  description: string;
  savingsType: 'time' | 'cost' | 'risk-avoidance';
  calculation: {
    beforeValue: number;
    afterValue: number;
    improvement: number;
    improvementPercent: number;
  };
  monetaryValue?: {
    amount: number;
    currency: Currency;
    basis: string; // e.g., "hourly rate £75"
  };
}

export function calculateHoursSavedValue(
  hoursSaved: number,
  hourlyRate: number = 75,
  currency: Currency = 'GBP'
): { value: number; currency: Currency; annualized: number } {
  const value = hoursSaved * hourlyRate;
  const annualized = value * 12; // Monthly to annual

  return { value, currency, annualized };
}

export function calculateDSOImprovement(
  beforeDSO: number,
  afterDSO: number,
  annualRevenue: number,
  interestRate: number = 0.05
): { daysSaved: number; workingCapitalFreed: number; interestSaved: number } {
  const daysSaved = beforeDSO - afterDSO;
  const dailyRevenue = annualRevenue / 365;
  const workingCapitalFreed = daysSaved * dailyRevenue;
  const interestSaved = workingCapitalFreed * interestRate;

  return { daysSaved, workingCapitalFreed, interestSaved };
}

export function calculateProcessEfficiency(
  beforeTime: number,
  afterTime: number,
  volumePerPeriod: number
): { timePercentImprovement: number; totalTimeSaved: number } {
  const timePercentImprovement = beforeTime > 0 ? ((beforeTime - afterTime) / beforeTime) * 100 : 0;
  const totalTimeSaved = (beforeTime - afterTime) * volumePerPeriod;

  return { timePercentImprovement, totalTimeSaved };
}

// ============================================
// DASHBOARD SUMMARY
// ============================================

export interface MetricsSummary {
  // High-level KPIs
  totalValueDelivered: number;
  currency: Currency;
  hoursSaved: number;
  dsoImprovement: number;
  complianceRate: number;
  // Category summaries
  byCategory: {
    category: MetricCategory;
    metricsOnTarget: number;
    metricsTotal: number;
    percentOnTarget: number;
  }[];
  // Top improvements
  topImprovements: {
    metricId: string;
    metricName: string;
    improvement: number;
    unit: string;
  }[];
  // Areas needing attention
  attentionRequired: {
    metricId: string;
    metricName: string;
    currentValue: number;
    targetValue: number;
    gap: number;
    unit: string;
  }[];
}

export function generateMetricsSummary(
  values: MetricValue[],
  currency: Currency = 'GBP'
): MetricsSummary {
  const definitions = METRIC_DEFINITIONS;

  // Calculate category summaries
  const byCategory = (['financial', 'efficiency', 'compliance', 'risk', 'quality'] as MetricCategory[]).map(
    (category) => {
      const categoryDefs = definitions.filter((d) => d.category === category);
      const categoryValues = values.filter((v) =>
        categoryDefs.some((d) => d.id === v.metricId)
      );

      const onTarget = categoryValues.filter((v) => {
        const def = definitions.find((d) => d.id === v.metricId);
        if (!def?.target) return true;
        if (def.direction === 'higher-better') return v.value >= def.target;
        if (def.direction === 'lower-better') return v.value <= def.target;
        return Math.abs(v.value - def.target) <= def.target * 0.1;
      }).length;

      return {
        category,
        metricsOnTarget: onTarget,
        metricsTotal: categoryValues.length,
        percentOnTarget: categoryValues.length > 0 ? (onTarget / categoryValues.length) * 100 : 100,
      };
    }
  );

  // Find top improvements
  const topImprovements = values
    .filter((v) => v.percentChange && v.trend === 'improving')
    .sort((a, b) => Math.abs(b.percentChange || 0) - Math.abs(a.percentChange || 0))
    .slice(0, 5)
    .map((v) => {
      const def = definitions.find((d) => d.id === v.metricId);
      return {
        metricId: v.metricId,
        metricName: def?.name || v.metricId,
        improvement: v.percentChange || 0,
        unit: def?.unit || '',
      };
    });

  // Find areas needing attention
  const attentionRequired = values
    .filter((v) => {
      const def = definitions.find((d) => d.id === v.metricId);
      if (!def?.target) return false;
      if (def.direction === 'higher-better') return v.value < def.target * 0.9;
      if (def.direction === 'lower-better') return v.value > def.target * 1.1;
      return Math.abs(v.value - def.target) > def.target * 0.1;
    })
    .map((v) => {
      const def = definitions.find((d) => d.id === v.metricId)!;
      return {
        metricId: v.metricId,
        metricName: def.name,
        currentValue: v.value,
        targetValue: def.target!,
        gap: Math.abs(v.value - def.target!),
        unit: def.unit,
      };
    });

  // Calculate totals (using mock values for demo)
  const hoursSavedMetric = values.find((v) => v.metricId === 'hours-saved');
  const dsoMetric = values.find((v) => v.metricId === 'dso');
  const complianceMetrics = values.filter((v) =>
    ['permit-on-time', 's106-compliance', 'condition-discharge-rate'].includes(v.metricId)
  );

  const hoursSaved = hoursSavedMetric?.value || 0;
  const dsoImprovement = dsoMetric?.previousValue
    ? dsoMetric.previousValue - dsoMetric.value
    : 0;
  const complianceRate =
    complianceMetrics.length > 0
      ? complianceMetrics.reduce((sum, m) => sum + m.value, 0) / complianceMetrics.length
      : 0;

  // Estimate total value
  const hoursSavedValue = calculateHoursSavedValue(hoursSaved, 75, currency);
  const totalValueDelivered = hoursSavedValue.value;

  return {
    totalValueDelivered,
    currency,
    hoursSaved,
    dsoImprovement,
    complianceRate,
    byCategory,
    topImprovements,
    attentionRequired,
  };
}

// ============================================
// MOCK DATA
// ============================================

export const MOCK_METRIC_VALUES: MetricValue[] = [
  {
    metricId: 'dso',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 32,
    previousValue: 45,
    trend: 'improving',
    percentChange: -29,
  },
  {
    metricId: 'hours-saved',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 120,
    previousValue: 85,
    trend: 'improving',
    percentChange: 41,
  },
  {
    metricId: 'report-generation-time',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 3,
    previousValue: 120,
    trend: 'improving',
    percentChange: -97.5,
  },
  {
    metricId: 'permit-on-time',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 92,
    previousValue: 78,
    trend: 'improving',
    percentChange: 18,
  },
  {
    metricId: 's106-compliance',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 100,
    previousValue: 100,
    trend: 'stable',
    percentChange: 0,
  },
  {
    metricId: 'change-order-cycle',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 8,
    previousValue: 18,
    trend: 'improving',
    percentChange: -56,
  },
  {
    metricId: 'invoice-cycle-time',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 4,
    previousValue: 7,
    trend: 'improving',
    percentChange: -43,
  },
  {
    metricId: 'defect-closure-rate',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 88,
    previousValue: 75,
    trend: 'improving',
    percentChange: 17,
  },
  {
    metricId: 'overdue-invoices',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 8,
    previousValue: 18,
    trend: 'improving',
    percentChange: -56,
  },
  {
    metricId: 'rfi-response-time',
    period: 'monthly',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    value: 4,
    previousValue: 8,
    trend: 'improving',
    percentChange: -50,
  },
];

// ============================================
// VALUE PROPOSITION SUMMARY
// ============================================

export interface ValueProposition {
  headline: string;
  metrics: {
    label: string;
    value: string;
    comparison?: string;
  }[];
  testimonialQuote?: string;
}

export function generateValueProposition(summary: MetricsSummary): ValueProposition {
  const formatCurrency = (amount: number, currency: Currency) => {
    const symbol = currency === 'GBP' ? '£' : '€';
    return `${symbol}${amount.toLocaleString()}`;
  };

  return {
    headline: `Delivering ${formatCurrency(summary.totalValueDelivered, summary.currency)} in measurable value`,
    metrics: [
      {
        label: 'Hours Saved Monthly',
        value: `${summary.hoursSaved}`,
        comparison: 'vs manual processes',
      },
      {
        label: 'DSO Improvement',
        value: `${summary.dsoImprovement} days faster`,
        comparison: 'payment collection',
      },
      {
        label: 'Compliance Rate',
        value: `${summary.complianceRate.toFixed(0)}%`,
        comparison: 'on-time permit decisions',
      },
      {
        label: 'Metrics On Target',
        value: `${summary.byCategory.reduce((sum, c) => sum + c.metricsOnTarget, 0)}/${summary.byCategory.reduce((sum, c) => sum + c.metricsTotal, 0)}`,
        comparison: 'across all categories',
      },
    ],
  };
}
