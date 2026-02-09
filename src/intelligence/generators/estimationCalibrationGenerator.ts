// =============================================================================
// ESTIMATION CALIBRATION GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useEstimationAccuracy } from '../../services/estimationFeedbackService';

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

  if (!accuracy || accuracy.overallScore >= 90) return null;

  const priority = accuracy.overallScore < 70 ? 'medium' : 'low';
  const avgDeviation = Math.round(accuracy.averageHoursDeviation);

  return {
    id: 'estimation-drift',
    generatorId: 'estimation-calibration',
    category: 'tip',
    priority,
    title: 'Vasco leert van je klussen',
    message: `Je offertenauwkeurigheid is ${accuracy.overallScore}%.${avgDeviation > 10 ? ` Uren wijken gemiddeld ${avgDeviation}% af van de begroting.` : ''}`,
    detail: 'Gebruik de Vasco Kalibratie bij je volgende offerte om automatisch betere schattingen te maken.',
    icon: 'analytics',
    actionLabel: 'Bekijk kalibratie',
    actionRoute: '/(contractor)/besparen',
    source: 'Offerte-analyse',
    metric: { label: 'Nauwkeurigheid', value: `${accuracy.overallScore}%`, trend: accuracy.trend === 'improving' ? 'up' : 'down' },

    rawScore: 0,
    reasoning: {
      observation: `Offertenauwkeurigheid staat op ${accuracy.overallScore}%`,
      evidence: `Op basis van ${accuracy.totalJobsAnalyzed} afgeronde klussen`,
      implication: accuracy.overallScore < 70
        ? 'Onnauwkeurige offertes kosten je gemiddeld 10-15% marge per klus'
        : 'Kleine verbeteringen in schattingen beschermen je marge',
      suggestion: 'Gebruik historische data om je schattingen te verbeteren',
    },
    dataPoints: accuracy.totalJobsAnalyzed,
    confidence: 0.7 + (accuracy.totalJobsAnalyzed > 20 ? 0.15 : accuracy.totalJobsAnalyzed * 0.0075),
    freshness: 12,
  };
}
