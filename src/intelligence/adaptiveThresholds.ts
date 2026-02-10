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

// =============================================================================
// ANOMALY DETECTION - Z-score based spike detection
// =============================================================================
// Detects sudden changes that deviate significantly from the contractor's
// recent baseline. Returns severity: null (normal), 'moderate' (>2σ), or
// 'severe' (>3σ). Requires at least 4 data points.
// =============================================================================

export type AnomalySeverity = 'moderate' | 'severe';

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: AnomalySeverity | null;
  zScore: number;
  mean: number;
  stddev: number;
  direction: 'spike' | 'drop';  // relative to mean
  description: string;           // Dutch explanation
}

const Z_MODERATE = 2.0;
const Z_SEVERE = 3.0;

// Seasonal multipliers by month (0=Jan). Construction activity peaks in spring/summer.
// These adjust what "normal" means by season.
const SEASONAL_MULTIPLIERS: Record<MetricKey, number[]> = {
  dso:                   [1.15, 1.10, 1.05, 1.0, 0.95, 0.95, 1.0, 1.0, 1.0, 1.05, 1.10, 1.20],
  marginLeakage:         [1.10, 1.05, 1.0, 0.95, 0.90, 0.90, 0.95, 1.0, 1.0, 1.05, 1.10, 1.15],
  idlePercent:           [1.20, 1.15, 1.05, 0.90, 0.85, 0.85, 0.90, 0.95, 1.0, 1.05, 1.15, 1.25],
  estimationAccuracy:    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  savingsTotal:          [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  overdueAmount:         [1.10, 1.05, 1.0, 0.95, 0.90, 0.90, 0.95, 1.0, 1.0, 1.05, 1.10, 1.15],
  complianceScore:       [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  capacityUtilization:   [0.85, 0.90, 0.95, 1.05, 1.10, 1.10, 1.05, 1.0, 1.0, 1.05, 0.95, 0.85],
};

/**
 * Get seasonal adjustment factor for a metric at the current month.
 * Returns multiplier applied to the mean before computing z-score.
 */
export function getSeasonalMultiplier(metric: MetricKey, month: number = new Date().getMonth()): number {
  const multipliers = SEASONAL_MULTIPLIERS[metric];
  return multipliers ? multipliers[month] : 1.0;
}

/**
 * Detect anomalies using z-score with optional seasonal adjustment.
 * Returns severity when current value deviates >2σ from baseline.
 */
export function detectAnomaly(
  profile: ContractorLearningProfile,
  metric: MetricKey,
  currentValue: number,
  seasonalAdjust: boolean = true,
): AnomalyResult {
  const neutral: AnomalyResult = {
    isAnomaly: false,
    severity: null,
    zScore: 0,
    mean: currentValue,
    stddev: 0,
    direction: 'spike',
    description: '',
  };

  const snapshots = profile.metricHistory
    .filter(s => s.metric === metric)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

  if (snapshots.length < MIN_WEEKS_FOR_ADAPTIVE) return neutral;

  const values = snapshots.map(s => s.value);
  const rawMean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - rawMean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  if (stddev < 0.001) return { ...neutral, mean: rawMean, stddev };

  // Apply seasonal adjustment to mean
  const seasonalMult = seasonalAdjust ? getSeasonalMultiplier(metric) : 1.0;
  const adjustedMean = rawMean * seasonalMult;

  const zScore = (currentValue - adjustedMean) / stddev;
  const absZ = Math.abs(zScore);

  const isLowerBad = LOWER_IS_BAD.includes(metric);
  // For "higher is bad" metrics: positive z = spike (bad), negative z = drop (good)
  // For "lower is bad" metrics: negative z = drop (bad), positive z = spike (good)
  const isBadDirection = isLowerBad ? zScore < -Z_MODERATE : zScore > Z_MODERATE;
  const direction = zScore > 0 ? 'spike' as const : 'drop' as const;

  if (absZ < Z_MODERATE) return { ...neutral, mean: adjustedMean, stddev, zScore };

  const severity: AnomalySeverity = absZ >= Z_SEVERE ? 'severe' : 'moderate';
  const metricLabel = metric === 'dso' ? 'DSO'
    : metric === 'marginLeakage' ? 'marge-lek'
    : metric === 'idlePercent' ? 'leegloop'
    : metric === 'overdueAmount' ? 'openstaand bedrag'
    : metric === 'complianceScore' ? 'compliance-score'
    : metric === 'capacityUtilization' ? 'bezettingsgraad'
    : metric;

  const description = severity === 'severe'
    ? `Ongebruikelijke ${direction === 'spike' ? 'stijging' : 'daling'} in ${metricLabel} — significant afwijkend van je normaal (${absZ.toFixed(1)}σ)`
    : `${metricLabel} wijkt af van je gebruikelijke patroon (${absZ.toFixed(1)}σ ${direction === 'spike' ? 'boven' : 'onder'} gemiddelde)`;

  return {
    isAnomaly: true,
    severity,
    zScore,
    mean: adjustedMean,
    stddev,
    direction,
    description,
  };
}
