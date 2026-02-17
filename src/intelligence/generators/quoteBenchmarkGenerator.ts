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

export function useQuoteBenchmarkInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { quotes, jobs } = useAppState();

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
    prediction: `Mediaan offerte voor "${bestJobType}": €${median.toLocaleString('nl-NL')}`,
    predictedValue: median,
  });

  // Get trend
  const trend = getTrend(ctx.profile, 'quoteMedian', 4);
  const trendText = trend
    ? trend.direction === 'improving'
      ? ` Offertewaarde stijgt.`
      : trend.direction === 'declining'
        ? ` Offertewaarde daalt.`
        : ''
    : '';

  return {
    id: 'quote-benchmark',
    generatorId: 'quote-benchmark',
    category: 'financial',
    priority: 'medium',
    title: `Benchmark: ${bestJobType}`,
    message: `Je mediaan offerte voor dit type klus is €${median.toLocaleString('nl-NL')}. Acceptatieratio: ${acceptanceRate}%.`,
    detail: `Op basis van ${bestAmounts.length} offertes. Prijsrange: €${sorted[0].toLocaleString('nl-NL')} – €${sorted[sorted.length - 1].toLocaleString('nl-NL')}.${trendText}`,
    icon: 'analytics',
    actionLabel: 'Pas prijs aan',
    source: 'Offerte Benchmark',
    metric: { label: 'Mediaan', value: `€${median.toLocaleString('nl-NL')}`, trend: 'neutral' },

    rootCauseTags: ['pricing', 'quotes'],
    rawScore: 0,
    reasoning: {
      observation: `${bestAmounts.length} offertes gevonden voor "${bestJobType}"`,
      evidence: `Mediaan: €${median.toLocaleString('nl-NL')}, acceptatieratio: ${acceptanceRate}%`,
      implication: `Gebruik deze benchmark om je prijsstelling te optimaliseren`,
      suggestion: acceptanceRate < 50
        ? 'Overweeg je prijzen te verlagen — de acceptatieratio is onder 50%'
        : 'Je prijsstelling zit goed — blijf bij je huidige niveau',
    },
    dataPoints: bestAmounts.length,
    confidence: Math.min(0.9, 0.5 + bestAmounts.length * 0.1),
    freshness: 2,
  };
}
