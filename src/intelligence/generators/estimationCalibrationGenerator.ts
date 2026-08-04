// =============================================================================
// ESTIMATION CALIBRATION GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useEstimationAccuracy } from '../../services/estimationFeedbackService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold } from '../adaptiveThresholds';
import { gt } from '../generatorTranslations';

export const estimationCalibrationGenerator: InsightGenerator = {
  id: 'estimation-calibration',
  screens: ['today', 'savings'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useEstimationCalibrationInsight(ctx: GeneratorContext): ScoredInsight | null {
  const accuracy = useEstimationAccuracy();

  // No completed job with both an estimate and actual hours means there is no
  // accuracy to report. This used to arrive as a confident 100, which both fed
  // the trend store a fake perfect reading and let the generator reason about a
  // score derived from nothing.
  const score = accuracy?.overallScore ?? null;

  if (score !== null) {
    recordMetricSnapshot('estimationAccuracy', score);
  }

  // Only trigger if estimation accuracy is below contractor's adaptive threshold
  // isAboveThreshold for estimationAccuracy returns true when value is BELOW threshold (lower-is-bad)
  if (score === null || !isAboveThreshold(ctx.profile, 'estimationAccuracy', score)) return null;

  // Log prediction for calibration
  logPrediction({
    generatorId: 'estimation-calibration',
    predictedAt: new Date().toISOString(),
    prediction: `Schattingsnauwkeurigheid: ${score}%`,
    predictedValue: score,
  });

  const priority = score < 70 ? 'medium' : 'low';
  const avgDeviation = Math.round(accuracy.averageHoursDeviation);

  return {
    id: 'estimation-drift',
    generatorId: 'estimation-calibration',
    category: 'tip',
    priority,
    title: 'Vasco leert van je klussen',
    message: `Je offertenauwkeurigheid is ${score}%.${avgDeviation > 10 ? ` Uren wijken gemiddeld ${avgDeviation}% af van de begroting.` : ''}`,
    detail: 'Gebruik de Vasco Kalibratie bij je volgende offerte om automatisch betere schattingen te maken.',
    icon: 'analytics',
    actionLabel: 'Bekijk kalibratie',
    actionRoute: '/(contractor)/besparen',
    source: gt('source_estimation', ctx.language),
    metric: { label: 'Nauwkeurigheid', value: `${score}%`, // trend is not computed yet; omit rather than defaulting to 'down',
      // which asserted a decline on every insight.
      trend: accuracy.trend === 'improving' ? 'up' : accuracy.trend === 'declining' ? 'down' : undefined },

    rootCauseTags: ['estimation', 'accuracy'],
    rawScore: 0,
    reasoning: {
      observation: `Offertenauwkeurigheid staat op ${score}%`,
      evidence: `Op basis van ${accuracy.totalJobsAnalyzed} afgeronde klussen${(() => { const t = getTrend(ctx.profile, 'estimationAccuracy', 4); return t && t.slope !== 0 ? ` — nauwkeurigheidstrend: ${t.direction}` : ''; })()}`,
      implication: score < 70
        ? 'Onnauwkeurige offertes kosten je gemiddeld 10-15% marge per klus'
        : 'Kleine verbeteringen in schattingen beschermen je marge',
      suggestion: 'Gebruik historische data om je schattingen te verbeteren',
    },
    dataPoints: accuracy.totalJobsAnalyzed,
    confidence: 0.7 + (accuracy.totalJobsAnalyzed > 20 ? 0.15 : accuracy.totalJobsAnalyzed * 0.0075),
    freshness: 12,
  };
}
