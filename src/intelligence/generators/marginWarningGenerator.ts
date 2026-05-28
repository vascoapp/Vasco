// =============================================================================
// MARGIN WARNING GENERATOR
// =============================================================================
// Real-time margin check — compares material costs + estimated labor against
// quoted price. Fires if projected margin < 15%.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { recordMetricSnapshot } from '../learningStorage';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';
import { useMarginDrift } from '../../services/marginDriftService';

export function useMarginWarningInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { jobs, jobMaterials, quotes, businessProfile } = useAppState();
  // R217: cohort margin drift — when the cohort is compressing, a low
  // margin on one job is a trade-wide pattern, not just this job's issue.
  const marginDrift = useMarginDrift(
    businessProfile?.trade ?? 'general',
    businessProfile?.country ?? 'NL',
  );

  // Find jobs with both a quoted amount and materials
  const jobsWithCosts = jobs.filter(j => {
    const quoted = j.agreedAmount ?? j.quotedAmount;
    const mats = jobMaterials[j.id];
    return quoted && quoted > 0 && mats && mats.length > 0;
  });

  if (jobsWithCosts.length === 0) return null;

  // Find the job with the lowest margin
  let worstJob: typeof jobs[0] | null = null;
  let worstMargin = 1;
  let worstMaterialCost = 0;
  let worstQuoted = 0;

  for (const job of jobsWithCosts) {
    const quoted = (job.agreedAmount ?? job.quotedAmount)!;
    const mats = jobMaterials[job.id] ?? [];
    const materialCost = mats.reduce((sum, m) => sum + (m.totalPrice ?? 0), 0);

    // Estimate labor at 40% of quoted (typical construction trade split)
    const estimatedLabor = quoted * 0.4;
    const totalCost = materialCost + estimatedLabor;
    const margin = quoted > 0 ? (quoted - totalCost) / quoted : 0;

    if (margin < worstMargin) {
      worstMargin = margin;
      worstJob = job;
      worstMaterialCost = materialCost;
      worstQuoted = quoted;
    }
  }

  if (!worstJob || worstMargin >= 0.15) return null;

  const marginPct = Math.round(worstMargin * 100);

  // Record metric for trend tracking
  recordMetricSnapshot('jobMargin', worstMargin);

  // Log prediction
  logPrediction({
    generatorId: 'margin-warning',
    predictedAt: new Date().toISOString(),
    prediction: `Job "${worstJob.title}" has a margin of ${marginPct}%`,
    predictedValue: worstMargin,
  });

  const isNegative = worstMargin < 0;
  const estimatedLabor = worstQuoted * 0.4;
  const totalCost = worstMaterialCost + estimatedLabor;

  return {
    id: 'margin-warning',
    generatorId: 'margin-warning',
    category: 'financial',
    priority: isNegative ? 'critical' : worstMargin < 0.05 ? 'high' : 'medium',
    title: isNegative
      ? gt('margin_warning_title_loss', ctx.language, { job: worstJob.title })
      : gt('margin_warning_title_low', ctx.language, { job: worstJob.title }),
    message: isNegative
      ? gt('margin_warning_message_loss', ctx.language, { pct: marginPct, materials: gtMoney(worstMaterialCost, ctx.country), quoted: gtMoney(worstQuoted, ctx.country) })
      : gt('margin_warning_message_low', ctx.language, { pct: marginPct, job: worstJob.title, materials: gtMoney(worstMaterialCost, ctx.country) }),
    detail: gt('margin_warning_detail', ctx.language, { quoted: gtMoney(worstQuoted, ctx.country), materials: gtMoney(worstMaterialCost, ctx.country), labor: gtMoney(estimatedLabor, ctx.country), total: gtMoney(totalCost, ctx.country) }),
    icon: 'warning',
    actionLabel: gt('margin_warning_action_label', ctx.language),
    source: gt('source_margin', ctx.language),
    metric: { label: gt('margin_warning_metric_label', ctx.language), value: `${marginPct}%`, trend: isNegative ? 'down' : 'neutral' },

    rootCauseTags: ['margin', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: gt('margin_warning_observation', ctx.language, { job: worstJob.title, pct: marginPct }),
      evidence: marginDrift && marginDrift.driftPp < -2
        ? gt('margin_warning_evidence_cohort', ctx.language, { materials: gtMoney(worstMaterialCost, ctx.country), quoted: gtMoney(worstQuoted, ctx.country), drift: marginDrift.driftPp.toFixed(1), count: marginDrift.recentContractorCount })
        : gt('margin_warning_evidence', ctx.language, { materials: gtMoney(worstMaterialCost, ctx.country), quoted: gtMoney(worstQuoted, ctx.country) }),
      implication: isNegative
        ? gt('margin_warning_implication_loss', ctx.language)
        : marginDrift && marginDrift.driftPp < -2
          ? gt('margin_warning_implication_cohort', ctx.language)
          : gt('margin_warning_implication_risk', ctx.language),
      suggestion: isNegative
        ? gt('margin_warning_suggestion_loss', ctx.language)
        : gt('margin_warning_suggestion_low', ctx.language),
    },
    dataPoints: jobsWithCosts.length,
    confidence: 0.85,
    freshness: 1,
  };
}
