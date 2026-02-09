// =============================================================================
// ADAPTIVE THRESHOLDS - Personalized alert thresholds per contractor
// =============================================================================
// Uses metric history to compute contractor's own baseline (mean + stddev).
// Alerts trigger at 1 stddev above baseline. Falls back to defaults for
// contractors with < 4 weeks of data.
// =============================================================================

import type { ContractorLearningProfile, MetricKey } from './learningStorage';

// =============================================================================
// DEFAULT THRESHOLDS (for < 4 weeks of data)
// =============================================================================

const DEFAULT_THRESHOLDS: Record<MetricKey, number> = {
  dso: 21,
  marginLeakage: 500,
  idlePercent: 12,
  estimationAccuracy: 70,    // alert if below
  savingsTotal: 0,           // not used for alerting
  overdueAmount: 2000,
  complianceScore: 80,       // alert if below
  capacityUtilization: 85,   // alert if below
};

// Metrics where LOWER values are bad (alert when below threshold)
const LOWER_IS_BAD: MetricKey[] = ['estimationAccuracy', 'complianceScore', 'capacityUtilization'];

const MIN_WEEKS_FOR_ADAPTIVE = 4;

// =============================================================================
// PUBLIC API
// =============================================================================

export interface AdaptiveThreshold {
  metric: MetricKey;
  threshold: number;
  isAdaptive: boolean;  // true if based on history, false if using defaults
  mean: number;
  stddev: number;
  dataPoints: number;
}

export function getAdaptiveThreshold(
  profile: ContractorLearningProfile,
  metric: MetricKey,
): AdaptiveThreshold {
  const snapshots = profile.metricHistory
    .filter(s => s.metric === metric)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

  if (snapshots.length < MIN_WEEKS_FOR_ADAPTIVE) {
    return {
      metric,
      threshold: DEFAULT_THRESHOLDS[metric],
      isAdaptive: false,
      mean: DEFAULT_THRESHOLDS[metric],
      stddev: 0,
      dataPoints: snapshots.length,
    };
  }

  const values = snapshots.map(s => s.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  // For "higher is bad" metrics (dso, marginLeakage, idlePercent, overdueAmount):
  //   threshold = mean + 1 stddev
  // For "lower is bad" metrics (estimationAccuracy, complianceScore, capacityUtilization):
  //   threshold = mean - 1 stddev
  const isLowerBad = LOWER_IS_BAD.includes(metric);
  const threshold = isLowerBad
    ? mean - stddev
    : mean + stddev;

  return {
    metric,
    threshold: Math.max(0, threshold),
    isAdaptive: true,
    mean,
    stddev,
    dataPoints: snapshots.length,
  };
}

export function isAboveThreshold(
  profile: ContractorLearningProfile,
  metric: MetricKey,
  value: number,
): boolean {
  const { threshold } = getAdaptiveThreshold(profile, metric);
  const isLowerBad = LOWER_IS_BAD.includes(metric);

  // "Higher is bad" metrics: alert when value > threshold
  // "Lower is bad" metrics: alert when value < threshold
  return isLowerBad ? value < threshold : value > threshold;
}
