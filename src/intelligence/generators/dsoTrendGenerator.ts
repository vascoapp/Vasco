// =============================================================================
// DSO TREND GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useDSOMetrics } from '../../services/collectionsAgentService';
import { logPrediction } from '../calibration';

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

  if (!dso || dso.currentDSO <= dso.targetDSO) return null;

  // Log prediction for calibration: "DSO will remain above target"
  logPrediction({
    generatorId: 'dso-trend',
    predictedAt: new Date().toISOString(),
    prediction: `DSO blijft boven target: ${dso.currentDSO}d (doel ${dso.targetDSO}d)`,
    predictedValue: dso.currentDSO,
  });

  const dsoGap = dso.currentDSO - dso.targetDSO;
  const priority = dsoGap > 10 ? 'high' : 'medium';

  return {
    id: 'dso-warning',
    generatorId: 'dso-trend',
    category: 'financial',
    priority,
    title: `DSO opgelopen naar ${dso.currentDSO} dagen`,
    message: `Je betaaltermijn is ${dsoGap} dagen boven je doel van ${dso.targetDSO}d. Automatische herinneringen versnellen je incasso.`,
    icon: 'timer',
    actionLabel: 'Incasso bekijken',
    actionRoute: '/(contractor)/facturen',
    source: 'Incasso Agent',
    metric: { label: 'DSO', value: `${dso.currentDSO}d`, trend: 'down' },

    rawScore: 0,
    reasoning: {
      observation: `DSO gestegen naar ${dso.currentDSO} dagen (doel: ${dso.targetDSO}d), was ${dso.previousDSO}d`,
      evidence: `Op basis van je factuurhistorie (branche-gemiddelde: ${dso.industryAverage}d)`,
      implication: 'Langere betaaltermijnen beperken je cashflow en werkkapitaal',
      suggestion: dsoGap > 10
        ? 'Stuur herinneringen eerder — op dag 7 i.p.v. dag 14'
        : 'Schakel automatische herinneringen in voor facturen ouder dan 7 dagen',
    },
    dataPoints: 0,
    confidence: 0.85,
    freshness: 2,
  };
}
