// =============================================================================
// MARGIN DRIFT GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useJobCostSummary } from '../../services/jobCostTrackingService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';
import { gt, gtMoney } from '../generatorTranslations';
import { useAppState } from '../../state/AppState';
import { useMarginDrift } from '../../services/marginDriftService';

export const marginDriftGenerator: InsightGenerator = {
  id: 'margin-drift',
  screens: ['today', 'savings', 'decisions'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useMarginDriftInsight(ctx: GeneratorContext): ScoredInsight | null {
  const costSummary = useJobCostSummary();
  const { businessProfile } = useAppState();
  // R217: cohort margin drift — if the market is also compressing,
  // evidence distinguishes internal issues from trade-wide pressure.
  const cohortDrift = useMarginDrift(
    businessProfile?.trade ?? 'general',
    businessProfile?.country ?? 'NL',
  );

  // Record margin leakage for trend tracking
  recordMetricSnapshot('marginLeakage', costSummary.totalMarginLeakage);

  if (costSummary.totalMarginLeakage === 0) return null;

  // Log prediction for calibration: "margin leakage will be €X this month"
  logPrediction({
    generatorId: 'margin-drift',
    predictedAt: new Date().toISOString(),
    prediction: `Margin leakage this month: ${gtMoney(costSummary.totalMarginLeakage, ctx.country)}`,
    predictedValue: costSummary.totalMarginLeakage,
  });

  const isNegative = costSummary.totalMarginLeakage > 0;
  const amount = Math.abs(costSummary.totalMarginLeakage);
  const jobCount = costSummary.topVarianceReasons.reduce((sum, r) => sum + r.count, 0);

  // Anomaly detection: escalate on sudden margin spikes
  const anomaly = detectAnomaly(ctx.profile, 'marginLeakage', costSummary.totalMarginLeakage);

  // Seasonal context
  const seasonMult = getSeasonalMultiplier('marginLeakage');
  const seasonNote = seasonMult > 1.05 ? ' ' + gt('margin_season_note', ctx.language) : '';
  const priority = anomaly.severity === 'severe' ? 'critical'
    : anomaly.severity === 'moderate' ? 'high'
    : amount > 1000 ? 'high' : 'medium';

  return {
    id: 'margin-drift',
    generatorId: 'margin-drift',
    category: isNegative ? 'alert' : 'opportunity',
    priority,
    title: isNegative
      ? gt('margin_title_erosion2', ctx.language, { amount: gtMoney(amount, ctx.country) })
      : gt('margin_title_above2', ctx.language, { amount: gtMoney(amount, ctx.country) }),
    message: isNegative
      ? gt('margin_message_below', ctx.language) + seasonNote
      : gt('margin_message_above', ctx.language),
    detail: isNegative
      ? gt('margin_detail_below', ctx.language) + (anomaly.isAnomaly ? ` ${anomaly.description}` : '')
      : gt('margin_detail_above', ctx.language),
    icon: isNegative ? 'trending-down' : 'trending-up',
    actionLabel: isNegative ? gt('margin_action_view', ctx.language) : undefined,
    actionRoute: isNegative ? '/(contractor)/besparen' : undefined,
    source: gt('source_margin', ctx.language),
    metric: {
      label: gt('margin_metric_impact', ctx.language),
      value: `${isNegative ? '-' : '+'}${gtMoney(amount, ctx.country)}`,
      trend: isNegative ? 'down' : 'up',
    },

    rootCauseTags: ['margin', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: isNegative
        ? gt('margin_obs_below', ctx.language, { amount: gtMoney(amount, ctx.country) })
        : gt('margin_obs_above', ctx.language, { amount: gtMoney(amount, ctx.country) }),
      evidence: gt('margin_evidence', ctx.language, { count: jobCount })
        + (anomaly.isAnomaly ? gt('margin_evidence_anomaly', ctx.language, { z: anomaly.zScore.toFixed(1) }) : '')
        + (() => { const t = getTrend(ctx.profile, 'marginLeakage', 4); return t && t.slope !== 0 ? gt('margin_evidence_trend', ctx.language, { direction: t.direction }) : ''; })()
        + (cohortDrift && Math.abs(cohortDrift.driftPp) >= 2 ? gt('margin_evidence_cohort', ctx.language, { sign: cohortDrift.driftPp >= 0 ? '+' : '', pp: cohortDrift.driftPp.toFixed(1), count: cohortDrift.recentContractorCount }) : ''),
      implication: isNegative
        ? gt('margin_impl_below', ctx.language, { amount: gtMoney(amount * 12, ctx.country) })
        : gt('margin_impl_above', ctx.language, { amount: gtMoney(amount * 12, ctx.country) }),
      suggestion: isNegative
        ? gt('margin_sugg_below', ctx.language)
        : gt('margin_sugg_above', ctx.language),
    },
    dataPoints: jobCount,
    confidence: anomaly.isAnomaly ? Math.min(0.95, 0.85 + 0.05) : 0.85,
    freshness: 2,
    action: {
      type: 'adjust_quote',
      label: gt('margin_action_adjust', ctx.language),
      params: {},
      requiresApproval: true,
    },
    enqueueHint: isNegative ? {
      type: 'general' as const,
      entityKey: `margin-drift:${Math.round(amount / 100) * 100}`,
      expiresInDays: 7,
    } : undefined,
  } as ScoredInsight;
}
