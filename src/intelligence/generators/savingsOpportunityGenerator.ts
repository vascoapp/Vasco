// =============================================================================
// SAVINGS OPPORTUNITY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { usePredictiveSavingsSummary } from '../../services/predictiveSavingsService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';

export const savingsOpportunityGenerator: InsightGenerator = {
  id: 'savings-opportunity',
  screens: ['today', 'savings'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useSavingsOpportunityInsight(ctx: GeneratorContext): ScoredInsight | null {
  const predictive = usePredictiveSavingsSummary();

  const urgentOpps = predictive.opportunities.filter(p => p.urgency === 'high');
  if (urgentOpps.length === 0) return null;

  const totalPotential = predictive.opportunities.reduce((sum, o) => sum + o.potentialSaving, 0);

  // Record metric snapshot for adaptive thresholds
  recordMetricSnapshot('savingsTotal', totalPotential);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'savings-opportunity',
    predictedAt: new Date().toISOString(),
    prediction: `Savings potential: ${gtMoney(totalPotential, ctx.country)} (${urgentOpps.length} urgent)`,
    predictedValue: totalPotential,
  });

  const top = urgentOpps[0];

  return {
    id: `predictive-${top.id}`,
    generatorId: 'savings-opportunity',
    category: 'opportunity',
    priority: 'medium',
    title: top.title,
    message: top.description,
    icon: top.icon as VascoInsight['icon'],
    actionLabel: top.actionLabel,
    actionRoute: '/(contractor)/besparen',
    source: gt('source_savings', ctx.language),
    metric: { label: gt('savings_opportunity_metric_label', ctx.language), value: gtMoney(top.potentialSaving, ctx.country), trend: 'up' },

    rootCauseTags: ['savings', 'procurement'],
    rawScore: 0,
    reasoning: {
      observation: gt('savings_opportunity_observation', ctx.language, { count: urgentOpps.length }),
      evidence: `${gt('savings_opportunity_evidence', ctx.language, { count: predictive.opportunities.length })}${(() => { const t = getTrend(ctx.profile, 'savingsTotal', 4); return t && t.slope !== 0 ? ` ${gt(t.slope > 0 ? 'savings_opportunity_evidence_trend_up' : 'savings_opportunity_evidence_trend_down', ctx.language)}` : ''; })()}`,
      implication: gt('savings_opportunity_implication', ctx.language, { amount: gtMoney(totalPotential, ctx.country) }),
      suggestion: top.actionLabel || gt('savings_opportunity_suggestion', ctx.language),
    },
    dataPoints: predictive.opportunities.length,
    confidence: 0.75,
    freshness: 4,
  };
}
