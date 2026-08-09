// =============================================================================
// COST VARIANCE GENERATOR
// =============================================================================
// Flags in-progress or recently-completed jobs where actual cost blew past
// the quoted amount by more than 20%. Surfaces an insight + emits a queue
// item so the contractor can adjust future quotes for the same job type.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { gt, gtMoney } from '../generatorTranslations';
import { useAppState } from '../../state/AppState';
import { useCohortCostVariance } from '../../services/costVarianceMoatService';

export const costVarianceGenerator: InsightGenerator = {
  id: 'cost-variance',
  screens: ['today', 'jobs-list', 'werk'],
  roles: ['contractor'],
  generate(_ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

// Fallback labour cost per hour. This generator runs without a worker in
// scope, so it cannot read `Worker.hourlyCost`; it is a screening heuristic
// for "which jobs are running over", not an accounting figure.
const LABOUR_COST_PER_HOUR = 45;

const OVERRUN_PCT = 0.2;

export function useCostVarianceInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { jobs, businessProfile } = useAppState();
  // R210: cohort baseline — when available, use it to contextualize the
  // overrun as "vs cohort" rather than just "vs your own quote".
  const cohortBaseline = useCohortCostVariance(
    businessProfile?.trade ?? 'general',
    businessProfile?.country ?? 'NL',
  );

  const problem = jobs
    .filter((j: any) => (j.status === 'completed' || j.status === 'in-progress') && (j.quotedAmount ?? 0) > 0)
    .map((j: any) => {
      const quoted = j.quotedAmount ?? j.agreedAmount ?? 0;
      const materialCost = (j.materials ?? []).reduce((s: number, m: any) => s + (m.totalCost ?? 0), 0);
      // Same defect as getProjectPnL: `timeEntries` is an array nothing
      // writes, so labour was always 0 and this generator only ever flagged
      // MATERIAL overruns. Hours land on `actualHours` via recordHours.
      const entryHours = (j.timeEntries ?? []).reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
      const laborHours = entryHours || j.actualHours || 0;
      const laborCost = laborHours * LABOUR_COST_PER_HOUR;
      const actual = materialCost + laborCost;
      const overrun = quoted > 0 ? (actual - quoted) / quoted : 0;
      return { j, quoted, actual, overrun };
    })
    .filter((x) => x.overrun > OVERRUN_PCT)
    .sort((a, b) => b.overrun - a.overrun);

  if (problem.length === 0) return null;

  const worst = problem[0];
  const overrunPct = Math.round(worst.overrun * 100);
  const diff = Math.round(worst.actual - worst.quoted);

  return {
    id: `cost-variance-${worst.j.id}`,
    generatorId: 'cost-variance',
    category: 'financial',
    priority: overrunPct > 40 ? 'high' : 'medium',
    title: `${worst.j.title}: ${overrunPct}% over budget`,
    message: `Actual cost ${gtMoney(worst.actual, ctx.country)} vs quoted ${gtMoney(worst.quoted, ctx.country)} — ${gtMoney(diff, ctx.country)} over.${problem.length > 1 ? ` ${problem.length - 1} more jobs show similar drift.` : ''}`,
    icon: 'trending-up',
    actionLabel: 'Review costs',
    actionRoute: `/contractor/job/${worst.j.id}`,
    source: gt('source_cost_tracking', ctx.language),
    metric: { label: 'Overrun', value: `+${gtMoney(diff, ctx.country)}`, trend: 'down' as const },

    rootCauseTags: ['margin', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: `Actual cost of "${worst.j.title}" is ${overrunPct}% over the quoted amount`,
      evidence: cohortBaseline && cohortBaseline.medianRatio !== null && cohortBaseline.contractorCount >= 5
        ? `Materials + labour summed against quotedAmount. Cohort median lands at ${Math.round(cohortBaseline.medianRatio * 100)}% of quote (${Math.round((cohortBaseline.overrunRate ?? 0) * 100)}% of cohort jobs overrun).`
        : `Materials + labour summed against quotedAmount`,
      implication: cohortBaseline && cohortBaseline.medianRatio !== null && cohortBaseline.medianRatio < 1 + (worst.overrun)
        ? `Your overrun is worse than the cohort median — not just the quote error, also ~${Math.round((worst.overrun - (cohortBaseline.medianRatio - 1)) * 100)}pp above typical.`
        : `If this pattern repeats across 5 similar jobs you'd lose ${gtMoney(diff * 5, ctx.country)} next quarter`,
      suggestion: 'Bump your quote template for this trade by 10-15% or add a contingency line',
    },
    dataPoints: problem.length,
    confidence: 0.8,
    freshness: 1,
    action: {
      type: 'adjust_quote',
      label: 'Adjust future quotes',
      params: { trade: worst.j.trade, overrunPct },
      requiresApproval: true,
      estimatedImpact: `Prevents ~${gtMoney(diff, ctx.country)} loss per similar job`,
    },
    enqueueHint: {
      type: 'general' as const,
      entityKey: `cost-variance:${worst.j.id}`,
      expiresInDays: 7,
    },
  } as ScoredInsight;
}
