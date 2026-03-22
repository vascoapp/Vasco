// =============================================================================
// CAPACITY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCapacityForecast } from '../../services/capacityPlanningService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { logPrediction } from '../calibration';
import { getSeasonalMultiplier, detectAnomaly, getAdaptiveThreshold } from '../adaptiveThresholds';
import { gt } from '../generatorTranslations';

export const capacityGenerator: InsightGenerator = {
  id: 'capacity',
  screens: ['today', 'decisions'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useCapacityInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { data: forecast } = useCapacityForecast(undefined, 7);

  if (!forecast || forecast.length === 0) return null;

  // Use adaptive threshold for capacity utilization (stored as percentage, e.g. 85)
  const capThreshold = getAdaptiveThreshold(ctx.profile, 'capacityUtilization');
  const overCapThreshold = capThreshold.threshold;  // e.g. 85%
  const underCapThreshold = Math.max(20, overCapThreshold - 35);  // e.g. 50% (relative to over-threshold)
  const lowCapDays = forecast.filter(slot => slot.utilization < underCapThreshold);
  const overCapDays = forecast.filter(slot => slot.utilization > overCapThreshold);

  if (lowCapDays.length === 0 && overCapDays.length === 0) return null;

  // Record metric snapshot for adaptive thresholds
  const peakUtil = forecast.reduce((max, s) => Math.max(max, s.utilization), 0);
  const avgUtil = forecast.reduce((sum, s) => sum + s.utilization, 0) / forecast.length;
  recordMetricSnapshot('capacityUtilization', avgUtil);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'capacity',
    predictedAt: new Date().toISOString(),
    prediction: overCapDays.length > 0
      ? `${overCapDays.length} overbelaste dagen (piek ${peakUtil}%)`
      : `${lowCapDays.length} onderbezette dagen`,
    predictedValue: peakUtil,
  });

  // Anomaly detection on capacity utilization
  const anomaly = detectAnomaly(ctx.profile, 'capacityUtilization', avgUtil);

  // Seasonal context: capacity expectations vary by month
  const seasonMult = getSeasonalMultiplier('capacityUtilization');
  const seasonNote = seasonMult > 1.05 ? ' (hoogseizoen — hogere bezetting normaal)'
    : seasonMult < 0.95 ? ' (laagseizoen — lagere bezetting verwacht)'
    : '';

  if (overCapDays.length > 0) {
    const priority = anomaly.severity === 'severe' ? 'critical'
      : anomaly.severity === 'moderate' ? 'high' : 'medium';
    return {
      id: 'capacity-overload',
      generatorId: 'capacity',
      category: 'alert',
      priority,
      title: `${overCapDays.length} overbelaste dag${overCapDays.length > 1 ? 'en' : ''} deze week`,
      message: `Je planning is ${overCapDays.length > 1 ? 'op meerdere dagen' : 'op een dag'} boven ${Math.round(overCapThreshold)}% bezetting. Overweeg om klussen te verschuiven.${seasonNote}${anomaly.isAnomaly ? ` ${anomaly.description}` : ''}`,
      icon: 'alert-circle',
      actionLabel: 'Planning bekijken',
      source: gt('source_capacity', ctx.language),

      rootCauseTags: ['capacity', 'schedule'],
      rawScore: 0,
      reasoning: {
        observation: `${overCapDays.length} van ${forecast.length} dagen boven ${Math.round(overCapThreshold)}% bezetting`,
        evidence: `Op basis van ${forecast.length}-daagse capaciteitsvoorspelling${anomaly.isAnomaly ? ` — anomalie gedetecteerd (${anomaly.zScore.toFixed(1)}σ)` : ''}${(() => { const t = getTrend(ctx.profile, 'capacityUtilization', 4); return t && t.slope !== 0 ? ` — bezettingstrend: ${t.direction}` : ''; })()}`,
        implication: 'Overbelasting leidt tot uitloop, kwaliteitsverlies en stress',
        suggestion: 'Verschuif niet-urgente klussen naar dagen met meer ruimte',
      },
      dataPoints: forecast.length,
      confidence: anomaly.isAnomaly ? Math.min(0.95, 0.8 + 0.05) : 0.8,
      freshness: 2,
      action: {
        type: 'schedule_job',
        label: 'Planning optimaliseren',
        params: { utilizationRate: peakUtil },
        requiresApproval: false,
      },
    };
  }

  return {
    id: 'capacity-available',
    generatorId: 'capacity',
    category: 'opportunity',
    priority: 'low',
    title: `${lowCapDays.length} dag${lowCapDays.length > 1 ? 'en' : ''} met ruimte`,
    message: `Je hebt ruimte in je planning — ideaal om offertes op te volgen of extra klussen aan te nemen.${seasonNote}`,
    icon: 'calendar',
    source: gt('source_capacity', ctx.language),

    rootCauseTags: ['capacity', 'schedule'],
    rawScore: 0,
    reasoning: {
      observation: `${lowCapDays.length} van ${forecast.length} dagen onder ${Math.round(underCapThreshold)}% bezetting`,
      evidence: `Op basis van ${forecast.length}-daagse capaciteitsvoorspelling${(() => { const t = getTrend(ctx.profile, 'capacityUtilization', 4); return t && t.slope !== 0 ? ` — bezettingstrend: ${t.direction}` : ''; })()}`,
      implication: 'Onbenutte capaciteit is gemiste omzet',
      suggestion: 'Gebruik de vrije dagen om nieuwe leads te benaderen of administratie in te halen',
    },
    dataPoints: forecast.length,
    confidence: 0.75,
    freshness: 4,
    action: {
      type: 'schedule_job',
      label: 'Planning optimaliseren',
      params: { utilizationRate: avgUtil },
      requiresApproval: false,
    },
  };
}
