// =============================================================================
// CASH GAP GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCollectionsAgent } from '../../services/collectionsAgentService';
import { useDSOMetrics } from '../../services/collectionsAgentService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';

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

  // Get DSO trend
  const dsoTrend = getTrend(ctx.profile, 'dso', 4);
  const dsoTrendText = dsoTrend
    ? dsoTrend.direction === 'declining'
      ? ` DSO verbetert: ${Math.round(dsoTrend.previousValue)} → ${Math.round(dsoTrend.currentValue)} dagen.`
      : dsoTrend.direction === 'improving'
        ? '' // for DSO, "improving" from getTrend means value is increasing which is BAD
        : ''
    : '';
  // Note: for DSO lower is better, so "declining" slope is actually "improving"
  const dsoWorsening = dsoTrend && dsoTrend.direction === 'declining';

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
          totalIntervals += (curr.getTime() - prev.getTime()) / 86400000;
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
    priority: top.severity === 'kritiek' ? 'high' : 'medium',
    title: top.title || 'Cash flow waarschuwing',
    message: `${top.description || 'Openstaande incasso-acties vereisen aandacht.'} DSO: ${dso.currentDSO} dagen (doel: ${dso.targetDSO}).`,
    detail: `${nextPaymentETA}. ${velocityNote}${dsoTrendText}`,
    icon: 'alert-circle',
    actionLabel: 'Incasso bekijken',
    actionRoute: '/(contractor)/facturen',
    source: 'Incasso Agent',
    metric: { label: 'DSO', value: `${dso.currentDSO}d`, trend: dso.currentDSO > dso.targetDSO ? 'down' : 'up' },

    rawScore: 0,
    reasoning: {
      observation: `${criticalAlerts.length} kritieke incasso-waarschuwing${criticalAlerts.length > 1 ? 'en' : ''} — DSO ${dso.currentDSO} dagen`,
      evidence: `Op basis van ${sequences.length} actieve dunning-sequences, DSO trend: ${dso.trend}`,
      implication: `Cash flow druk: ${nextPaymentETA}.${dsoWorsening ? ' DSO-trend is dalend (positief).' : ''}`,
      suggestion: activeSequences.length > 0
        ? `${activeSequences.length} automatische herinneringen lopen — controleer of handmatige opvolging nodig is`
        : 'Schakel automatische herinneringen in voor snellere incasso',
    },
    dataPoints: sequences.length + 1, // +1 for DSO metric
    confidence: 0.85,
    freshness: 1,
  };
}
