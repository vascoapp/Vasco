// =============================================================================
// COMPLIANCE ALERT GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useComplianceAlerts } from '../../services/complianceService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { logPrediction } from '../calibration';
import { detectAnomaly } from '../adaptiveThresholds';

export const complianceAlertGenerator: InsightGenerator = {
  id: 'compliance-alert',
  screens: ['today', 'meer'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useComplianceAlertInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { alerts } = useComplianceAlerts();

  const critical = alerts.filter(a => a.severity === 'critical');
  const high = alerts.filter(a => a.severity === 'high');
  const criticalAndHigh = [...critical, ...high];

  if (criticalAndHigh.length === 0) return null;

  // Compute compliance score (0-100): penalize based on alert severity
  const totalAlerts = alerts.length;
  const criticalPenalty = critical.length * 15;
  const highPenalty = high.length * 8;
  const mediumPenalty = alerts.filter(a => a.severity === 'medium').length * 3;
  const complianceScore = Math.max(0, Math.min(100, 100 - criticalPenalty - highPenalty - mediumPenalty));

  // Record metric snapshot for trend tracking
  recordMetricSnapshot('complianceScore', complianceScore);

  // Anomaly detection: sudden compliance score drops
  const anomaly = detectAnomaly(ctx.profile, 'complianceScore', complianceScore);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'compliance-alert',
    predictedAt: new Date().toISOString(),
    prediction: `Compliance-score: ${complianceScore}/100 (${criticalAndHigh.length} waarschuwingen)`,
    predictedValue: complianceScore,
  });

  // Get trend from profile
  const trend = getTrend(ctx.profile, 'complianceScore', 4);
  const trendText = trend
    ? trend.direction === 'declining'
      ? ` Compliance-score daalt (van ${Math.round(trend.previousValue)} → ${Math.round(trend.currentValue)}).`
      : trend.direction === 'improving'
        ? ` Compliance-score verbetert (van ${Math.round(trend.previousValue)} → ${Math.round(trend.currentValue)}).`
        : ''
    : '';

  const top = criticalAndHigh[0];
  const priority = critical.length > 0 ? 'critical' : 'high';

  return {
    id: `compliance-${top.id}`,
    generatorId: 'compliance-alert',
    category: 'compliance',
    priority,
    title: `${criticalAndHigh.length} compliance-${criticalAndHigh.length === 1 ? 'waarschuwing' : 'waarschuwingen'}`,
    message: `${critical.length > 0 ? `${critical.length} kritiek` : ''}${critical.length > 0 && high.length > 0 ? ', ' : ''}${high.length > 0 ? `${high.length} hoog` : ''} — score: ${complianceScore}/100.`,
    detail: `Totaal ${totalAlerts} actieve checks.${trendText}`,
    icon: 'shield-checkmark',
    actionLabel: 'Bekijk details',
    actionRoute: '/(contractor)/certificaten',
    source: 'Compliance Monitor',
    timestamp: 'Nu',
    metric: { label: 'Score', value: `${complianceScore}/100`, trend: complianceScore < 70 ? 'down' : 'up' },

    rootCauseTags: ['compliance', 'risk'],
    rawScore: 0,
    reasoning: {
      observation: `${criticalAndHigh.length} compliance-waarschuwing${criticalAndHigh.length > 1 ? 'en' : ''} vereisen actie (${critical.length} kritiek, ${high.length} hoog)`,
      evidence: `Op basis van ${totalAlerts} actieve compliance-checks — score ${complianceScore}/100${anomaly.isAnomaly ? ` — anomalie gedetecteerd (${anomaly.zScore.toFixed(1)}σ)` : ''}`,
      implication: critical.length > 0
        ? `Niet-naleving kan leiden tot boetes of werkstop${trendText}`
        : `Tijdige actie voorkomt escalatie naar kritiek niveau${trendText}`,
      suggestion: 'Controleer je certificaten en vergunningen op verloopdatums',
    },
    dataPoints: totalAlerts,
    confidence: anomaly.isAnomaly ? Math.min(0.98, 0.95 + 0.02) : 0.95,
    freshness: 0.5,
  };
}
