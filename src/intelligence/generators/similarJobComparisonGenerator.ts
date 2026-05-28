// =============================================================================
// SIMILAR JOB COMPARISON GENERATOR
// =============================================================================
// Finds past jobs with similar title/type and compares duration, margin,
// materials used. Surfaces "Vergelijkbare klus X duurde 2 dagen langer".
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';

export function useSimilarJobComparisonInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { jobs, quotes } = useAppState();

  // Need completed jobs to compare against
  const completedJobs = jobs.filter(j =>
    ['completed', 'invoiced', 'paid'].includes(j.status)
  );

  if (completedJobs.length < 2) return null;

  // Find job pairs with similar titles (simple word overlap)
  const activeJobs = jobs.filter(j =>
    ['lead', 'quoted', 'accepted', 'scheduled', 'in-progress'].includes(j.status)
  );

  if (activeJobs.length === 0) return null;

  // For each active job, find the most similar completed job
  let bestMatch: {
    activeJob: typeof jobs[0];
    pastJob: typeof jobs[0];
    similarity: number;
    durationDiff?: number;
    marginDiff?: number;
  } | null = null;

  for (const activeJob of activeJobs) {
    const activeWords = new Set(activeJob.title.toLowerCase().split(/\s+/));

    for (const pastJob of completedJobs) {
      const pastWords = new Set(pastJob.title.toLowerCase().split(/\s+/));
      const intersection = [...activeWords].filter(w => pastWords.has(w) && w.length > 2);
      const union = new Set([...activeWords, ...pastWords]);
      const similarity = union.size > 0 ? intersection.length / union.size : 0;

      // Also check trade match
      const tradeMatch = activeJob.trade && pastJob.trade && activeJob.trade === pastJob.trade;
      const adjustedSimilarity = tradeMatch ? similarity + 0.2 : similarity;

      if (adjustedSimilarity > 0.3 && (!bestMatch || adjustedSimilarity > bestMatch.similarity)) {
        // Calculate duration difference
        let durationDiff: number | undefined;
        if (activeJob.estimatedDuration && pastJob.estimatedDuration) {
          durationDiff = pastJob.estimatedDuration - activeJob.estimatedDuration;
        }

        // Calculate margin difference
        let marginDiff: number | undefined;
        const activeQuoted = activeJob.agreedAmount ?? activeJob.quotedAmount;
        const pastQuoted = pastJob.agreedAmount ?? pastJob.quotedAmount;
        if (activeQuoted && pastQuoted) {
          marginDiff = pastQuoted - activeQuoted;
        }

        bestMatch = {
          activeJob,
          pastJob,
          similarity: adjustedSimilarity,
          durationDiff,
          marginDiff,
        };
      }
    }
  }

  if (!bestMatch || bestMatch.similarity < 0.3) return null;

  const { activeJob, pastJob, durationDiff, marginDiff } = bestMatch;

  // Build insight message
  let comparisonNote = '';
  if (durationDiff !== undefined && durationDiff !== 0) {
    const absDiff = Math.abs(durationDiff);
    comparisonNote = durationDiff > 0
      ? gt('similar_dur_longer', ctx.language, { title: pastJob.title, hours: absDiff })
      : gt('similar_dur_faster', ctx.language, { title: pastJob.title, hours: absDiff });
  }
  if (marginDiff !== undefined && marginDiff !== 0) {
    const pastQuoted = pastJob.agreedAmount ?? pastJob.quotedAmount ?? 0;
    comparisonNote += ' ' + gt('similar_quote_was', ctx.language, { amount: gtMoney(pastQuoted, ctx.country) });
  }

  if (!comparisonNote) {
    comparisonNote = gt('similar_done_before', ctx.language, { title: pastJob.title });
  }

  // Log prediction
  logPrediction({
    generatorId: 'similar-job-comparison',
    predictedAt: new Date().toISOString(),
    prediction: `Similar job found: "${pastJob.title}" (similarity: ${Math.round(bestMatch.similarity * 100)}%)`,
    predictedValue: bestMatch.similarity,
  });

  return {
    id: 'similar-job-comparison',
    generatorId: 'similar-job-comparison',
    category: 'operational',
    priority: 'medium',
    title: gt('similar_title', ctx.language, { title: pastJob.title }),
    message: comparisonNote,
    detail: gt('similar_detail', ctx.language, { active: activeJob.title, past: pastJob.title }),
    icon: 'git-compare',
    actionLabel: gt('similar_action_view', ctx.language),
    source: gt('source_job_comparison', ctx.language),
    metric: pastJob.agreedAmount
      ? { label: gt('similar_metric_prev', ctx.language), value: gtMoney(pastJob.agreedAmount, ctx.country), trend: 'neutral' }
      : undefined,

    rootCauseTags: ['planning', 'estimation'],
    rawScore: 0,
    reasoning: {
      observation: gt('similar_obs', ctx.language, { title: activeJob.title }),
      evidence: gt('similar_evidence', ctx.language, { title: pastJob.title, pct: Math.round(bestMatch.similarity * 100) })
        + (pastJob.trade ? gt('similar_evidence_trade', ctx.language, { trade: pastJob.trade }) : ''),
      implication: gt('similar_impl', ctx.language),
      suggestion: durationDiff && durationDiff > 0
        ? gt('similar_sugg_time', ctx.language)
        : gt('similar_sugg_ref', ctx.language),
    },
    dataPoints: completedJobs.length,
    confidence: Math.min(0.85, bestMatch.similarity + 0.3),
    freshness: 6,
  };
}
