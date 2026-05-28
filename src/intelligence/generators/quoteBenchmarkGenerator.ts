// =============================================================================
// QUOTE BENCHMARK GENERATOR
// =============================================================================
// Compares current quote pricing against past accepted quotes for same job type.
// Warns if pricing is >15% above/below median. Shows acceptance rate.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';
import { useCohortAcceptLag } from '../../services/quoteResponseLagMoatService';

export function useQuoteBenchmarkInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { quotes, jobs, businessProfile } = useAppState();
  // R216: cohort accept-lag — evidence line cites how long cohort typically
  // takes to accept, so contractor knows if their outstanding quotes are slow.
  const acceptLag = useCohortAcceptLag(
    businessProfile?.trade ?? 'general',
    businessProfile?.country ?? 'NL',
    null,
  );

  // Need at least 3 past quotes to benchmark
  const sentOrAccepted = quotes.filter(q => q.status === 'sent');
  const allQuotes = quotes;
  if (allQuotes.length < 3) return null;

  // Group quotes by job type (using the job description field)
  const jobTypeMap = new Map<string, number[]>();
  for (const q of allQuotes) {
    const jobKey = q.job.toLowerCase().trim();
    if (!jobTypeMap.has(jobKey)) jobTypeMap.set(jobKey, []);
    jobTypeMap.get(jobKey)!.push(q.amount);
  }

  // Find the most common job type with enough data
  let bestJobType = '';
  let bestAmounts: number[] = [];
  for (const [jobType, amounts] of jobTypeMap) {
    if (amounts.length > bestAmounts.length) {
      bestJobType = jobType;
      bestAmounts = amounts;
    }
  }

  if (bestAmounts.length < 2) return null;

  // Calculate median and acceptance rate
  const sorted = [...bestAmounts].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const acceptedCount = sentOrAccepted.filter(q =>
    q.job.toLowerCase().trim() === bestJobType
  ).length;
  const totalForType = bestAmounts.length;
  const acceptanceRate = totalForType > 0 ? Math.round((acceptedCount / totalForType) * 100) : 0;

  // Record metric for trend tracking
  recordMetricSnapshot('quoteMedian', median);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'quote-benchmark',
    predictedAt: new Date().toISOString(),
    prediction: `Median quote for "${bestJobType}": ${gtMoney(median, ctx.country)}`,
    predictedValue: median,
  });

  // Get trend
  const trend = getTrend(ctx.profile, 'quoteMedian', 4);
  const trendText = trend
    ? trend.direction === 'improving'
      ? ' ' + gt('qb_trend_up', ctx.language)
      : trend.direction === 'declining'
        ? ' ' + gt('qb_trend_down', ctx.language)
        : ''
    : '';

  return {
    id: 'quote-benchmark',
    generatorId: 'quote-benchmark',
    category: 'financial',
    priority: 'medium',
    title: gt('qb_title', ctx.language, { type: bestJobType }),
    message: gt('qb_message', ctx.language, { median: gtMoney(median, ctx.country), rate: acceptanceRate }),
    detail: gt('qb_detail', ctx.language, { count: bestAmounts.length, min: gtMoney(sorted[0], ctx.country), max: gtMoney(sorted[sorted.length - 1], ctx.country) }) + trendText,
    icon: 'analytics',
    actionLabel: gt('qb_action', ctx.language),
    source: gt('source_quote_benchmark', ctx.language),
    metric: { label: gt('qb_metric_median', ctx.language), value: gtMoney(median, ctx.country), trend: 'neutral' },

    rootCauseTags: ['pricing', 'quotes'],
    rawScore: 0,
    reasoning: {
      observation: gt('qb_obs', ctx.language, { count: bestAmounts.length, type: bestJobType }),
      evidence: acceptLag && acceptLag.medianHours !== null && acceptLag.contractorCount >= 5
        ? gt('qb_evidence_cohort', ctx.language, { median: gtMoney(median, ctx.country), rate: acceptanceRate, days: Math.round(acceptLag.medianHours / 24), p75: Math.round(acceptLag.p75Hours! / 24) })
        : gt('qb_evidence', ctx.language, { median: gtMoney(median, ctx.country), rate: acceptanceRate }),
      implication: gt('qb_impl', ctx.language),
      suggestion: acceptanceRate < 50
        ? gt('qb_sugg_lower', ctx.language)
        : gt('qb_sugg_keep', ctx.language),
    },
    dataPoints: bestAmounts.length,
    confidence: Math.min(0.9, 0.5 + bestAmounts.length * 0.1),
    freshness: 2,
  };
}
