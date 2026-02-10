// =============================================================================
// DSO TREND GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useDSOMetrics } from '../../services/collectionsAgentService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';

export const dsoTrendGenerator: InsightGenerator = {
  id: 'dso-trend',
  screens: ['today', 'invoices'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useDSOTrendInsight(ctx: GeneratorContext): ScoredInsight | null {
  const dso = useDSOMetrics();

  if (!dso) return null;

  // Record DSO metric for trend tracking
  recordMetricSnapshot('dso', dso.currentDSO);

  if (dso.currentDSO <= dso.targetDSO) return null;

  // Log prediction for calibration: "DSO will remain above target"
  logPrediction({
    generatorId: 'dso-trend',
    predictedAt: new Date().toISOString(),
    prediction: `DSO blijft boven target: ${dso.currentDSO}d (doel ${dso.targetDSO}d)`,
    predictedValue: dso.currentDSO,
  });

  const dsoGap = dso.currentDSO - dso.targetDSO;

  // Anomaly detection: escalate on sudden DSO spikes
  const anomaly = detectAnomaly(ctx.profile, 'dso', dso.currentDSO);

  // Seasonal context
  const seasonMult = getSeasonalMultiplier('dso');
  const seasonNote = seasonMult > 1.05 ? ' Langere betaaltermijnen zijn normaal in het laagseizoen.' : '';
  const priority = anomaly.severity === 'severe' ? 'critical'
    : anomaly.severity === 'moderate' ? 'high'
    : dsoGap > 10 ? 'high' : 'medium';

  return {
    id: 'dso-warning',
    generatorId: 'dso-trend',
    category: 'financial',
    priority,
    title: `DSO opgelopen naar ${dso.currentDSO} dagen`,
    message: `Je betaaltermijn is ${dsoGap} dagen boven je doel van ${dso.targetDSO}d. Automatische herinneringen versnellen je incasso.${anomaly.isAnomaly ? ` ${anomaly.description}` : ''}`,
    icon: 'timer',
    actionLabel: 'Incasso bekijken',
    actionRoute: '/(contractor)/facturen',
    source: 'Incasso Agent',
    metric: { label: 'DSO', value: `${dso.currentDSO}d`, trend: 'down' },

    rootCauseTags: ['cashflow', 'dso'],
    rawScore: 0,
    reasoning: {
      observation: `DSO gestegen naar ${dso.currentDSO} dagen (doel: ${dso.targetDSO}d), was ${dso.previousDSO}d`,
      evidence: `Op basis van je factuurhistorie (branche-gemiddelde: ${dso.industryAverage}d)${anomaly.isAnomaly ? ` — anomalie gedetecteerd (${anomaly.zScore.toFixed(1)}σ)` : ''}${(() => { const t = getTrend(ctx.profile, 'dso', 4); return t && t.slope !== 0 ? ` — DSO-trend: ${t.direction}` : ''; })()}`,
      implication: `Langere betaaltermijnen beperken je cashflow en werkkapitaal.${seasonNote}`,
      suggestion: dsoGap > 10
        ? 'Stuur herinneringen eerder — op dag 7 i.p.v. dag 14'
        : 'Schakel automatische herinneringen in voor facturen ouder dan 7 dagen',
    },
    dataPoints: 1,
    confidence: anomaly.isAnomaly ? Math.min(0.95, 0.85 + 0.05) : 0.85,
    freshness: 2,
  };
}
