// =============================================================================
// PROFITABILITY GENERATOR (CFO/Director)
// =============================================================================
// Returns composite of top 3 insights (warnings + opportunities),
// showing total impact instead of just the first warning.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { useProjectProfitability } from '../../services/projectProfitabilityService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold } from '../adaptiveThresholds';
import { gt, gtMoney } from '../generatorTranslations';

export const profitabilityGenerator: InsightGenerator = {
  id: 'profitability',
  screens: ['overview'],
  roles: ['contractor', 'cfo', 'director'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useProfitabilityInsight(ctx: GeneratorContext): ScoredInsight | null {
  const profitability = useProjectProfitability();

  const warnings = profitability.insights.filter(i => i.type === 'warning');
  const opportunities = profitability.insights.filter(i => i.type === 'opportunity');
  const actionable = [...warnings, ...opportunities].slice(0, 3);

  if (actionable.length === 0) return null;

  // Log prediction for calibration
  const totalImpactForLog = actionable.reduce((sum, i) => sum + Math.abs(i.impact), 0);
  logPrediction({
    generatorId: 'profitability',
    predictedAt: new Date().toISOString(),
    prediction: `Profitability impact: ${gtMoney(totalImpactForLog, ctx.country)} (${warnings.length} risks, ${opportunities.length} opportunities)`,
    predictedValue: totalImpactForLog,
  });

  // Record margin leakage metric for trend tracking
  recordMetricSnapshot('marginLeakage', totalImpactForLog);

  // Compute total impact across top insights
  const totalImpact = actionable.reduce((sum, i) => sum + Math.abs(i.impact), 0);
  const warningImpact = warnings.reduce((sum, i) => sum + Math.abs(i.impact), 0);
  const oppImpact = opportunities.reduce((sum, i) => sum + Math.abs(i.impact), 0);

  // Build composite message
  const parts: string[] = [];
  if (warnings.length > 0) {
    parts.push(gt(warnings.length > 1 ? 'profitability_risks_multi' : 'profitability_risks_single', ctx.language, { count: warnings.length, amount: gtMoney(warningImpact, ctx.country) }));
  }
  if (opportunities.length > 0) {
    parts.push(gt(opportunities.length > 1 ? 'profitability_opps_multi' : 'profitability_opps_single', ctx.language, { count: opportunities.length, amount: gtMoney(oppImpact, ctx.country) }));
  }

  // Use adaptive threshold for margin leakage to determine priority
  const isHighImpact = isAboveThreshold(ctx.profile, 'marginLeakage', warningImpact);
  const priority = warnings.length >= 2 || isHighImpact ? 'high' : 'medium';
  const topInsight = actionable[0];

  // Detail: list top 3 insights
  const detailLines = actionable.map((i, idx) => {
    const emoji = i.type === 'warning' ? '⚠' : '✦';
    return `${emoji} ${i.title}: ${gtMoney(Math.abs(i.impact), ctx.country)}`;
  });

  return {
    id: `profit-composite`,
    generatorId: 'profitability',
    category: 'alert',
    priority,
    title: gt('profitability_title', ctx.language, { amount: gtMoney(totalImpact, ctx.country) }),
    message: parts.join(' + '),
    detail: detailLines.join('\n'),
    icon: topInsight.icon as VascoInsight['icon'],
    source: gt('source_profitability', ctx.language),
    metric: {
      label: gt('profitability_metric_label', ctx.language),
      value: `${gtMoney(totalImpact, ctx.country)}`,
      trend: warnings.length > opportunities.length ? 'down' : 'up',
    },

    rootCauseTags: ['margin', 'profitability'],
    rawScore: 0,
    reasoning: {
      observation: gt('profitability_observation', ctx.language, { count: actionable.length }),
      evidence: gt('profitability_evidence', ctx.language, { count: profitability.insights.length, margin: profitability.overallMargin, trend: profitability.profitTrend }) + (() => { const t = getTrend(ctx.profile, 'marginLeakage', 4); return t && t.slope !== 0 ? gt('profitability_evidence_trend', ctx.language, { direction: t.direction }) : ''; })(),
      implication: gt('profitability_implication', ctx.language, { amount: gtMoney(totalImpact, ctx.country), risks: warnings.length, opps: opportunities.length }),
      suggestion: topInsight.description,
    },
    dataPoints: profitability.insights.length,
    confidence: 0.80,
    freshness: 12,
  };
}
