// =============================================================================
// MARGIN ROOT CAUSE GENERATOR (Cross-Service)
// =============================================================================
// Chains: jobCostTracking → laborCost → estimationFeedback to identify the
// PRIMARY cause of margin loss. Instead of showing isolated warnings, this
// generator traces variance back to its root: estimation error, idle time,
// supplier overcharge, or scope creep.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useJobCostSummary } from '../../services/jobCostTrackingService';
import { useLaborCosts } from '../../services/laborCostService';
import { useEstimationAccuracy } from '../../services/estimationFeedbackService';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { logPrediction } from '../calibration';
import { isAboveThreshold, getAdaptiveThreshold } from '../adaptiveThresholds';
import { gt, gtMoney } from '../generatorTranslations';
import { useAppState } from '../../state/AppState';
import { useMarginDrift } from '../../services/marginDriftService';

export function useMarginRootCauseInsight(ctx: GeneratorContext): ScoredInsight | null {
  const costSummary = useJobCostSummary();
  const labor = useLaborCosts();
  const estimation = useEstimationAccuracy();
  const { businessProfile } = useAppState();
  // R217: cohort margin drift — when trade-wide compression is present,
  // the root cause analysis adds a 5th cause: market-wide margin pressure.
  const marginDrift = useMarginDrift(
    businessProfile?.trade ?? 'general',
    businessProfile?.country ?? 'NL',
  );

  // Record margin leakage snapshot
  recordMetricSnapshot('marginLeakage', costSummary.totalMarginLeakage);
  recordMetricSnapshot('estimationAccuracy', estimation.overallScore);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'margin-root-cause',
    predictedAt: new Date().toISOString(),
    prediction: `Margin leak root cause: ${gtMoney(costSummary.totalMarginLeakage, ctx.country)}`,
    predictedValue: costSummary.totalMarginLeakage,
  });

  // Only trigger if margin leakage exceeds contractor's adaptive threshold
  if (!isAboveThreshold(ctx.profile, 'marginLeakage', costSummary.totalMarginLeakage)) return null;

  // Identify root causes and rank by contribution
  interface RootCause {
    id: string;
    label: string;
    amount: number;
    explanation: string;
  }

  const causes: RootCause[] = [];

  // 1. Estimation accuracy issues (adaptive: alert when below contractor's threshold)
  if (isAboveThreshold(ctx.profile, 'estimationAccuracy', estimation.overallScore)) {
    const estImpact = costSummary.totalMarginLeakage * (1 - estimation.overallScore / 100);
    causes.push({
      id: 'estimation',
      label: gt('margin_rc_label_estimation', ctx.language),
      amount: Math.round(estImpact),
      explanation: gt('margin_rc_expl_estimation', ctx.language, {
        score: estimation.overallScore,
        hours: `${estimation.averageHoursDeviation > 0 ? '+' : ''}${estimation.averageHoursDeviation.toFixed(1)}`,
        qty: `${estimation.averageMaterialQuantityDeviation > 0 ? '+' : ''}${estimation.averageMaterialQuantityDeviation.toFixed(1)}`,
        price: `${estimation.averageMaterialPriceDeviation > 0 ? '+' : ''}${estimation.averageMaterialPriceDeviation.toFixed(1)}`,
      }),
    });
  }

  // 2. Idle time / labor inefficiency (adaptive threshold)
  if (isAboveThreshold(ctx.profile, 'idlePercent', labor.idleTime.idlePercent)) {
    causes.push({
      id: 'idle',
      label: gt('margin_rc_label_idle', ctx.language),
      amount: labor.idleTime.idleCost,
      explanation: gt('margin_rc_expl_idle', ctx.language, { pct: labor.idleTime.idlePercent, cost: gtMoney(labor.idleTime.idleCost, ctx.country) }),
    });
  }

  // 3. Variance by category from job cost tracking
  for (const reason of costSummary.topVarianceReasons) {
    if (reason.amount > 100) {
      const categoryLabel = reason.category === 'uren' ? gt('margin_rc_label_hours', ctx.language)
        : reason.category === 'materiaal' ? gt('margin_rc_label_materials', ctx.language)
        : reason.category === 'reistijd' ? gt('margin_rc_label_travel', ctx.language)
        : reason.category === 'herwerk' ? gt('margin_rc_label_rework', ctx.language)
        : gt('margin_rc_label_unforeseen', ctx.language);
      causes.push({
        id: reason.category,
        label: categoryLabel,
        amount: reason.amount,
        explanation: gt('margin_rc_expl_variance', ctx.language, { count: reason.count, category: categoryLabel.toLowerCase(), amount: gtMoney(reason.amount, ctx.country) }),
      });
    }
  }

  if (causes.length === 0) return null;

  // Sort by impact
  causes.sort((a, b) => b.amount - a.amount);
  const primaryCause = causes[0];
  const totalIdentified = causes.reduce((sum, c) => sum + c.amount, 0);

  // Build chain reasoning
  const chainSteps = causes.slice(0, 3).map(c => `${c.label}: ${gtMoney(c.amount, ctx.country)}`);

  return {
    id: 'margin-root-cause',
    generatorId: 'margin-root-cause',
    category: 'financial',
    priority: costSummary.totalMarginLeakage > 1000 ? 'high' : 'medium',
    title: gt('margin_rc_title', ctx.language, { cause: primaryCause.label }),
    message: gt('margin_rc_message', ctx.language, { total: gtMoney(costSummary.totalMarginLeakage, ctx.country), cause: primaryCause.label, amount: gtMoney(primaryCause.amount, ctx.country) }),
    detail: `${gt('margin_rc_detail_header', ctx.language)}\n${chainSteps.join('\n')}`,
    icon: 'git-branch',
    actionLabel: gt('margin_rc_action_label', ctx.language),
    actionRoute: '/(contractor)/decisions',
    source: gt('source_cross_service', ctx.language),
    metric: {
      label: gt('margin_rc_metric_label', ctx.language),
      value: gtMoney(costSummary.totalMarginLeakage, ctx.country),
      trend: 'down',
    },

    rootCauseTags: ['margin', primaryCause.id],
    rawScore: 0,
    reasoning: {
      observation: gt('margin_rc_observation', ctx.language, { total: gtMoney(costSummary.totalMarginLeakage, ctx.country) }),
      evidence: `${gt('margin_rc_evidence', ctx.language, { count: causes.length })}${(() => { const t = getTrend(ctx.profile, 'marginLeakage', 4); return t && t.slope !== 0 ? ` — ${gt('margin_rc_evidence_trend', ctx.language, { trend: t.slope > 0 ? gt('margin_rc_trend_rising', ctx.language) : gt('margin_rc_trend_falling', ctx.language), direction: t.direction })}` : ''; })()}${marginDrift && marginDrift.driftPp < -2 ? ` — ${gt('margin_rc_evidence_cohort', ctx.language, { drift: marginDrift.driftPp.toFixed(1) })}` : ''}`,
      implication: `${primaryCause.explanation}. ${gt('margin_rc_implication', ctx.language, { explained: gtMoney(totalIdentified, ctx.country), total: gtMoney(costSummary.totalMarginLeakage, ctx.country) })}${marginDrift && marginDrift.driftPp < -2 ? ` ${gt('margin_rc_implication_cohort', ctx.language, { drift: marginDrift.driftPp.toFixed(1) })}` : ''}`,
      suggestion: primaryCause.id === 'estimation'
        ? gt('margin_rc_suggestion_estimation', ctx.language)
        : primaryCause.id === 'idle'
          ? gt('margin_rc_suggestion_idle', ctx.language)
          : gt('margin_rc_suggestion_default', ctx.language, { cause: primaryCause.label.toLowerCase() }),
    },
    dataPoints: costSummary.topVarianceReasons.reduce((sum, r) => sum + r.count, 0),
    confidence: 0.82,
    freshness: 8,
  };
}
