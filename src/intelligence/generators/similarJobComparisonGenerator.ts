// =============================================================================
// SIMILAR JOB COMPARISON GENERATOR
// =============================================================================
// Finds past jobs with similar title/type and compares duration, margin,
// materials used. Surfaces "Vergelijkbare klus X duurde 2 dagen langer".
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

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
      ? `Vergelijkbare klus "${pastJob.title}" duurde ${absDiff}u langer dan geschat.`
      : `Vergelijkbare klus "${pastJob.title}" was ${absDiff}u sneller dan geschat.`;
  }
  if (marginDiff !== undefined && marginDiff !== 0) {
    const pastQuoted = pastJob.agreedAmount ?? pastJob.quotedAmount ?? 0;
    comparisonNote += ` Offerte was €${pastQuoted.toLocaleString('nl-NL')}.`;
  }

  if (!comparisonNote) {
    comparisonNote = `Vergelijkbare klus "${pastJob.title}" is eerder uitgevoerd.`;
  }

  // Log prediction
  logPrediction({
    generatorId: 'similar-job-comparison',
    predictedAt: new Date().toISOString(),
    prediction: `Vergelijkbare klus gevonden: "${pastJob.title}" (similarity: ${Math.round(bestMatch.similarity * 100)}%)`,
    predictedValue: bestMatch.similarity,
  });

  return {
    id: 'similar-job-comparison',
    generatorId: 'similar-job-comparison',
    category: 'operational',
    priority: 'medium',
    title: `Vergelijkbaar: ${pastJob.title}`,
    message: comparisonNote,
    detail: `Klus "${activeJob.title}" lijkt op eerdere klus "${pastJob.title}". Gebruik eerdere ervaring om beter te plannen en te prijzen.`,
    icon: 'git-compare',
    actionLabel: 'Bekijk details',
    source: gt('source_job_comparison', ctx.language),
    metric: pastJob.agreedAmount
      ? { label: 'Vorige offerte', value: `€${pastJob.agreedAmount.toLocaleString('nl-NL')}`, trend: 'neutral' }
      : undefined,

    rootCauseTags: ['planning', 'estimation'],
    rawScore: 0,
    reasoning: {
      observation: `Klus "${activeJob.title}" heeft een vergelijkbare eerdere klus`,
      evidence: `"${pastJob.title}" — ${Math.round(bestMatch.similarity * 100)}% overeenkomst${pastJob.trade ? `, vak: ${pastJob.trade}` : ''}`,
      implication: 'Gebruik historische data om realistische schattingen te maken',
      suggestion: durationDiff && durationDiff > 0
        ? 'Plan extra tijd in — vergelijkbare klussen duurden langer dan geschat'
        : 'Gebruik de offerte van de vorige klus als referentie',
    },
    dataPoints: completedJobs.length,
    confidence: Math.min(0.85, bestMatch.similarity + 0.3),
    freshness: 6,
  };
}
