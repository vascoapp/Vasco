// =============================================================================
// ESTIMATION VARIANCE BY TYPE GENERATOR
// =============================================================================
// Uses job completion history from the learning profile to identify which
// job types have the worst estimation accuracy, providing targeted feedback.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

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
    const type = job.jobType || 'onbekend';
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
    prediction: `${worst.jobType}-klussen overschrijden budget met ${Math.round((worst.avgCostRatio - 1) * 100)}%`,
    predictedValue: worst.avgCostRatio,
  });

  const overrunPct = Math.round((worst.avgCostRatio - 1) * 100);
  const hoursOverrunPct = Math.round((worst.avgHoursRatio - 1) * 100);

  return {
    id: `est-variance-${worst.jobType}`,
    generatorId: 'estimation-variance-type',
    category: 'tip',
    priority: overrunPct > 25 ? 'high' : overrunPct > 15 ? 'medium' : 'low',
    title: `"${worst.jobType}"-klussen lopen ${overrunPct}% over budget`,
    message: `Je schattingen voor ${worst.jobType}-klussen wijken structureel af. Pas je offertemodel aan voor dit type.`,
    detail: hoursOverrunPct > 5
      ? `Uren wijken gemiddeld ${hoursOverrunPct}% af. Totale overschrijding: €${worst.totalOverrun.toLocaleString('nl-NL')} over ${worst.count} klussen.`
      : `Totale overschrijding: €${worst.totalOverrun.toLocaleString('nl-NL')} over ${worst.count} klussen.`,
    icon: 'bar-chart',
    actionLabel: 'Bekijk kalibratie',
    actionRoute: '/(contractor)/besparen',
    source: gt('source_estimation', ctx.language),
    metric: {
      label: 'Overschrijding',
      value: `+${overrunPct}%`,
      trend: 'down',
    },

    rootCauseTags: ['estimation', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: `${worst.jobType}-klussen overschrijden het budget met gemiddeld ${overrunPct}%`,
      evidence: `Op basis van ${worst.count} afgeronde ${worst.jobType}-klussen uit je geschiedenis`,
      implication: `€${worst.totalOverrun.toLocaleString('nl-NL')} marge verloren aan dit klustype`,
      suggestion: worst.avgHoursRatio > 1.15
        ? `Verhoog je uurschatting voor ${worst.jobType}-klussen met ~${hoursOverrunPct}%`
        : `Controleer materiaalkosten voor ${worst.jobType}-klussen — uren kloppen redelijk`,
    },
    dataPoints: worst.count,
    confidence: Math.min(0.9, 0.6 + worst.count * 0.05),
    freshness: 24, // weekly refresh is fine for this insight
  };
}
