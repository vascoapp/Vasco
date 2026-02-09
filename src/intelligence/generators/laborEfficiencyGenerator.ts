// =============================================================================
// LABOR EFFICIENCY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useLaborCosts } from '../../services/laborCostService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold } from '../adaptiveThresholds';

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

  return {
    id: 'labor-idle-warning',
    generatorId: 'labor-efficiency',
    category: 'tip',
    priority: labor.idleTime.idlePercent > 20 ? 'medium' : 'low',
    title: `${labor.idleTime.idlePercent}% leegloop deze maand`,
    message: `${labor.idleTime.totalIdleHours} uur niet-productief. ${labor.idleTime.suggestion}`,
    detail: trendText ? trendText.trim() : undefined,
    icon: 'time',
    source: 'Arbeidsanalyse',
    metric: { label: 'Verloren waarde', value: `€${labor.idleTime.idleCost}`, trend: 'down' },

    rawScore: 0,
    reasoning: {
      observation: `${labor.idleTime.idlePercent}% van de werktijd is niet-productief`,
      evidence: `Op basis van ${totalHours} geregistreerde uren${trend ? `, trend: ${trend.direction}` : ''}`,
      implication: `€${labor.idleTime.idleCost} aan gemiste productiviteit${trendText}`,
      suggestion: labor.idleTime.suggestion || 'Optimaliseer reistijd en wachttijden tussen klussen',
    },
    dataPoints: totalHours,
    confidence: 0.8,
    freshness: 6,
  };
}
