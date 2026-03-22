// =============================================================================
// LABOR EFFICIENCY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useLaborCosts } from '../../services/laborCostService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { logPrediction } from '../calibration';
import { isAboveThreshold, detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';
import { gt } from '../generatorTranslations';

export const laborEfficiencyGenerator: InsightGenerator = {
  id: 'labor-efficiency',
  screens: ['today', 'decisions'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useLaborEfficiencyInsight(ctx: GeneratorContext): ScoredInsight | null {
  const labor = useLaborCosts();

  // Record metric snapshot for trend tracking
  recordMetricSnapshot('idlePercent', labor.idleTime.idlePercent);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'labor-efficiency',
    predictedAt: new Date().toISOString(),
    prediction: `Leegloop: ${labor.idleTime.idlePercent}% (€${labor.idleTime.idleCost} kosten)`,
    predictedValue: labor.idleTime.idlePercent,
  });

  // Use adaptive threshold instead of hardcoded >10%
  if (!isAboveThreshold(ctx.profile, 'idlePercent', labor.idleTime.idlePercent)) return null;

  // Get week-over-week trend
  const trend = getTrend(ctx.profile, 'idlePercent', 4);
  const trendText = trend
    ? trend.direction === 'declining'
      ? ` Leegloop verbetert: ${Math.round(trend.previousValue)}% → ${Math.round(trend.currentValue)}%.`
      : trend.direction === 'improving'
        ? ` Leegloop verslechtert: ${Math.round(trend.previousValue)}% → ${Math.round(trend.currentValue)}%.`
        : ''
    : '';

  const totalHours = Math.round(labor.idleTime.totalIdleHours / (labor.idleTime.idlePercent / 100));

  // Anomaly detection: escalate on sudden idle time spikes
  const anomaly = detectAnomaly(ctx.profile, 'idlePercent', labor.idleTime.idlePercent);

  // Seasonal context
  const seasonMult = getSeasonalMultiplier('idlePercent');
  const seasonNote = seasonMult > 1.10 ? ' Hogere leegloop is normaal in het laagseizoen.' : '';

  return {
    id: 'labor-idle-warning',
    generatorId: 'labor-efficiency',
    category: 'tip',
    priority: anomaly.severity === 'severe' ? 'high'
      : anomaly.severity === 'moderate' ? 'medium'
      : labor.idleTime.idlePercent > 20 ? 'medium' : 'low',
    title: `${labor.idleTime.idlePercent}% leegloop deze maand`,
    message: `${labor.idleTime.totalIdleHours} uur niet-productief. ${labor.idleTime.suggestion}${seasonNote}`,
    detail: trendText ? trendText.trim() : undefined,
    icon: 'time',
    source: gt('source_labor', ctx.language),
    metric: { label: 'Verloren waarde', value: `€${labor.idleTime.idleCost}`, trend: 'down' },

    rootCauseTags: ['idle-time', 'labor'],
    rawScore: 0,
    reasoning: {
      observation: `${labor.idleTime.idlePercent}% van de werktijd is niet-productief`,
      evidence: `Op basis van ${totalHours} geregistreerde uren${trend ? `, trend: ${trend.direction}` : ''}${anomaly.isAnomaly ? ` — anomalie gedetecteerd (${anomaly.zScore.toFixed(1)}σ)` : ''}`,
      implication: `€${labor.idleTime.idleCost} aan gemiste productiviteit${trendText}`,
      suggestion: labor.idleTime.suggestion || 'Optimaliseer reistijd en wachttijden tussen klussen',
    },
    dataPoints: totalHours,
    confidence: anomaly.isAnomaly ? Math.min(0.95, 0.8 + 0.05) : 0.8,
    freshness: 6,
  };
}
