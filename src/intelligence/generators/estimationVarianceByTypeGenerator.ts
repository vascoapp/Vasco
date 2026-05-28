// =============================================================================
// ESTIMATION VARIANCE BY TYPE GENERATOR
// =============================================================================
// Uses job completion history from the learning profile to identify which
// job types have the worst estimation accuracy, providing targeted feedback.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';

export const estimationVarianceByTypeGenerator: InsightGenerator = {
  id: 'estimation-variance-type',
  screens: ['today', 'savings', 'decisions'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

interface TypeVariance {
  jobType: string;
  count: number;
  avgCostRatio: number;   // actual/estimated (>1 = overrun)
  avgHoursRatio: number;  // actual/estimated (>1 = overrun)
  totalOverrun: number;   // total € overrun
}

export function useEstimationVarianceByTypeInsight(ctx: GeneratorContext): ScoredInsight | null {
  const jobs = ctx.profile.jobCompletionHistory;
  if (jobs.length < 3) return null; // need minimum data

  // Group by job type
  const byType = new Map<string, TypeVariance>();
  for (const job of jobs) {
    const type = job.jobType || gt('job_type_unknown', ctx.language);
    const existing = byType.get(type) || {
      jobType: type,
      count: 0,
      avgCostRatio: 0,
      avgHoursRatio: 0,
      totalOverrun: 0,
    };

    existing.count++;
    if (job.estimatedCost > 0) {
      existing.avgCostRatio += job.actualCost / job.estimatedCost;
    }
    if (job.estimatedHours > 0) {
      existing.avgHoursRatio += job.actualHours / job.estimatedHours;
    }
    const overrun = job.actualCost - job.estimatedCost;
    if (overrun > 0) existing.totalOverrun += overrun;

    byType.set(type, existing);
  }

  // Finalize averages and find worst type
  const types: TypeVariance[] = [];
  for (const [, tv] of byType) {
    if (tv.count < 2) continue; // need at least 2 jobs per type
    tv.avgCostRatio /= tv.count;
    tv.avgHoursRatio /= tv.count;
    types.push(tv);
  }

  if (types.length === 0) return null;

  // Sort by worst cost ratio (highest overrun first)
  types.sort((a, b) => b.avgCostRatio - a.avgCostRatio);
  const worst = types[0];

  // Only trigger if the worst type has >10% cost overrun
  if (worst.avgCostRatio < 1.10) return null;

  // Log prediction for calibration
  logPrediction({
    generatorId: 'estimation-variance-type',
    predictedAt: new Date().toISOString(),
    prediction: `${worst.jobType} jobs exceed budget by ${Math.round((worst.avgCostRatio - 1) * 100)}%`,
    predictedValue: worst.avgCostRatio,
  });

  const overrunPct = Math.round((worst.avgCostRatio - 1) * 100);
  const hoursOverrunPct = Math.round((worst.avgHoursRatio - 1) * 100);

  return {
    id: `est-variance-${worst.jobType}`,
    generatorId: 'estimation-variance-type',
    category: 'tip',
    priority: overrunPct > 25 ? 'high' : overrunPct > 15 ? 'medium' : 'low',
    title: gt('est_variance_type_title', ctx.language, { type: worst.jobType, pct: overrunPct }),
    message: gt('est_variance_type_message', ctx.language, { type: worst.jobType }),
    detail: hoursOverrunPct > 5
      ? gt('est_variance_type_detail_hours', ctx.language, { hoursPct: hoursOverrunPct, amount: gtMoney(worst.totalOverrun, ctx.country), count: worst.count })
      : gt('est_variance_type_detail', ctx.language, { amount: gtMoney(worst.totalOverrun, ctx.country), count: worst.count }),
    icon: 'bar-chart',
    actionLabel: gt('est_variance_type_action', ctx.language),
    actionRoute: '/(contractor)/besparen',
    source: gt('source_estimation', ctx.language),
    metric: {
      label: gt('est_variance_type_metric_label', ctx.language),
      value: `+${overrunPct}%`,
      trend: 'down',
    },

    rootCauseTags: ['estimation', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: gt('est_variance_type_observation', ctx.language, { type: worst.jobType, pct: overrunPct }),
      evidence: gt('est_variance_type_evidence', ctx.language, { count: worst.count, type: worst.jobType }),
      implication: gt('est_variance_type_implication', ctx.language, { amount: gtMoney(worst.totalOverrun, ctx.country) }),
      suggestion: worst.avgHoursRatio > 1.15
        ? gt('est_variance_type_suggestion_hours', ctx.language, { type: worst.jobType, hoursPct: hoursOverrunPct })
        : gt('est_variance_type_suggestion_materials', ctx.language, { type: worst.jobType }),
    },
    dataPoints: worst.count,
    confidence: Math.min(0.9, 0.6 + worst.count * 0.05),
    freshness: 24, // weekly refresh is fine for this insight
  };
}
