// =============================================================================
// CASH GAP GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCollectionsAgent } from '../../services/collectionsAgentService';
import { useDSOMetrics } from '../../services/collectionsAgentService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { logPrediction } from '../calibration';
import { getSeasonalMultiplier, detectAnomaly } from '../adaptiveThresholds';
import { gt } from '../generatorTranslations';
import { MS_PER_DAY } from '../../utils/timeConstants';

export const cashGapGenerator: InsightGenerator = {
  id: 'cash-gap',
  screens: ['today', 'invoices'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useCashGapInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { alerts, sequences } = useCollectionsAgent();
  const dso = useDSOMetrics();

  const criticalAlerts = alerts.filter(a => a.severity === 'kritiek' || a.severity === 'waarschuwing');
  if (criticalAlerts.length === 0) return null;

  const top = criticalAlerts[0];
  const activeSequences = sequences.filter(s => s.autoSendEnabled);

  // Record DSO snapshot for trend tracking
  recordMetricSnapshot('dso', dso.currentDSO);

  // Anomaly detection on DSO
  const anomaly = detectAnomaly(ctx.profile, 'dso', dso.currentDSO);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'cash-gap',
    predictedAt: new Date().toISOString(),
    prediction: `Cash gap: DSO ${dso.currentDSO}d, ${criticalAlerts.length} kritieke alerts`,
    predictedValue: dso.currentDSO,
  });

  // Get DSO trend (for DSO, lower is better — "declining" slope = improving)
  const dsoTrend = getTrend(ctx.profile, 'dso', 4);
  const dsoTrendText = dsoTrend
    ? dsoTrend.slope < -0.5
      ? ` DSO verbetert: ${Math.round(dsoTrend.previousValue)} → ${Math.round(dsoTrend.currentValue)} dagen.`
      : dsoTrend.slope > 0.5
        ? ` DSO verslechtert: ${Math.round(dsoTrend.previousValue)} → ${Math.round(dsoTrend.currentValue)} dagen.`
        : ''
    : '';
  const dsoImproving = dsoTrend && dsoTrend.slope < -0.5;

  // Seasonal context
  const seasonMult = getSeasonalMultiplier('dso');
  const seasonNote = seasonMult > 1.05 ? ' Seizoenseffect: langere incassotermijnen in wintermaanden.' : '';

  // Compute payment velocity from dunning step intervals
  const sequencesWithSteps = sequences.filter(s => s.steps && s.steps.length >= 2);
  let avgStepIntervalDays = 0;
  if (sequencesWithSteps.length > 0) {
    let totalIntervals = 0;
    let intervalCount = 0;
    for (const seq of sequencesWithSteps) {
      for (let i = 1; i < seq.steps.length; i++) {
        const prev = new Date(seq.steps[i - 1].sentDate || seq.steps[i - 1].scheduledDate || '');
        const curr = new Date(seq.steps[i].sentDate || seq.steps[i].scheduledDate || '');
        if (prev.getTime() > 0 && curr.getTime() > 0) {
          totalIntervals += (curr.getTime() - prev.getTime()) / MS_PER_DAY;
          intervalCount++;
        }
      }
    }
    avgStepIntervalDays = intervalCount > 0 ? Math.round(totalIntervals / intervalCount) : 0;
  }

  // Predict next cash arrival ETA
  const nextPaymentETA = dso.currentDSO > dso.targetDSO
    ? `~${Math.round(dso.currentDSO - dso.targetDSO)} extra dagen tot betaling verwacht`
    : `Betalingen lopen op schema (DSO ${dso.currentDSO}d vs doel ${dso.targetDSO}d)`;

  const velocityNote = avgStepIntervalDays > 0
    ? `Gem. ${avgStepIntervalDays} dagen tussen dunning-stappen.`
    : '';

  return {
    id: `cash-gap-${top.id}`,
    generatorId: 'cash-gap',
    category: 'financial',
    priority: anomaly.severity === 'severe' ? 'critical'
      : anomaly.severity === 'moderate' ? 'high'
      : top.severity === 'kritiek' ? 'high' : 'medium',
    title: top.title || 'Cash flow waarschuwing',
    message: `${top.description || 'Openstaande incasso-acties vereisen aandacht.'} DSO: ${dso.currentDSO} dagen (doel: ${dso.targetDSO}).${anomaly.isAnomaly ? ` ${anomaly.description}` : ''}`,
    detail: `${nextPaymentETA}. ${velocityNote}${dsoTrendText}${seasonNote}`,
    icon: 'alert-circle',
    actionLabel: 'Incasso bekijken',
    actionRoute: '/(contractor)/facturen',
    source: gt('source_collections', ctx.language),
    metric: { label: 'DSO', value: `${dso.currentDSO}d`, trend: dso.currentDSO > dso.targetDSO ? 'down' : 'up' },

    rootCauseTags: ['cashflow', 'cash-gap'],
    rawScore: 0,
    reasoning: {
      observation: `${criticalAlerts.length} kritieke incasso-waarschuwing${criticalAlerts.length > 1 ? 'en' : ''} — DSO ${dso.currentDSO} dagen`,
      evidence: `Op basis van ${sequences.length} actieve dunning-sequences, DSO trend: ${dso.trend}. Cohort mediaan (jouw land): ${dso.industryAverage}d — jij zit ${dso.currentDSO - dso.industryAverage > 0 ? '+' : ''}${dso.currentDSO - dso.industryAverage}d ${dso.currentDSO > dso.industryAverage ? 'boven' : 'onder'} het gemiddelde.${anomaly.isAnomaly ? ` Anomalie gedetecteerd (${anomaly.zScore.toFixed(1)}σ).` : ''}`,
      implication: `Cash flow druk: ${nextPaymentETA}.${dsoImproving ? ' DSO-trend is dalend (positief).' : ''}`,
      suggestion: activeSequences.length > 0
        ? `${activeSequences.length} automatische herinneringen lopen — controleer of handmatige opvolging nodig is`
        : 'Schakel automatische herinneringen in voor snellere incasso',
    },
    dataPoints: sequences.length + 1, // +1 for DSO metric
    confidence: anomaly.isAnomaly ? Math.min(0.95, 0.85 + 0.05) : 0.85,
    freshness: 1,
    action: {
      type: 'send_reminder',
      label: 'Incasso versnellen',
      params: { gapAmount: dso.currentDSO - dso.targetDSO },
      requiresApproval: false,
    },
  };
}
