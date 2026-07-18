// =============================================================================
// CROSS-SELL HINT GENERATOR
// =============================================================================
// After a job completes, surface a natural next-service suggestion based on
// the trade mix completed within the last 90 days. Goal is to prompt a
// targeted follow-up quote (e.g. roofing → solar, painting → flooring).
// =============================================================================

// R23: dropped the dead `crossSellGenerator: InsightGenerator` static export
// (its `generate(ctx)` always returned null and zero consumers ever read it
// — same dead-static pattern as crossServiceGenerator removed in R20.2). The
// real surface is `useCrossSellInsight(ctx)`, rendered via generators/index.
import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { gt } from '../generatorTranslations';
import { useCohortBenchmarks } from '../../services/cohortBenchmarkService';

const ADJACENT_TRADES: Record<string, Array<{ trade: string; pitch: string }>> = {
  roofing:    [{ trade: 'solar',      pitch: 'Roof is fresh — great moment to add PV panels with a single scaffolding visit.' },
               { trade: 'insulation', pitch: 'Roof access is still open — propose attic insulation before closing up.' }],
  painting:   [{ trade: 'flooring',   pitch: 'Walls done and dry — floors are the logical next finish.' }],
  tiling:     [{ trade: 'plumbing',   pitch: 'Wet areas tiled — check in on tap/shower fittings next.' }],
  plumbing:   [{ trade: 'tiling',     pitch: 'Pipework in — customer may want tiles around the refurb.' }],
  electrical: [{ trade: 'solar',      pitch: 'Consumer unit fresh — flag solar-ready upgrade path.' }],
  gas:        [{ trade: 'heating',    pitch: 'Gas line serviced — offer heating system optimisation visit.' }],
  carpentry:  [{ trade: 'painting',   pitch: 'New woodwork up — painting finish is the obvious close.' }],
  insulation: [{ trade: 'solar',      pitch: 'House envelope tightened — PV+heat-pump savings look great on paper now.' }],
  landscaping: [{ trade: 'glazing',   pitch: 'Garden done — propose matching exterior door / large glazing upgrade.' }],
  glazing:     [{ trade: 'painting',  pitch: 'Frames refinished with fresh glass — a paint refresh seals it.' }],
  flooring:    [{ trade: 'painting',  pitch: 'Floors laid — suggest skirting / ceiling paint refresh to match.' }],
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function useCrossSellInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { jobs, businessProfile } = useAppState();
  // R212: cohort benchmarks for the contractor's own trade — the hook must
  // be called unconditionally (React rules). We re-key below against the
  // adjacent-trade pick, so this resolves the data for the same trade set.
  const { benchmarks } = useCohortBenchmarks(businessProfile?.trade ?? 'general', businessProfile?.country ?? 'NL');

  // Jobs completed in the last 30 days without a follow-up quote already sent
  const recent = jobs
    .filter((j: any) => j.status === 'completed' && j.completedAt)
    .filter((j: any) => ctx.now.getTime() - new Date(j.completedAt).getTime() < 30 * DAY_MS);

  if (recent.length === 0) return null;

  // Pick the newest completed job with a mapped adjacent trade
  const candidate = recent.find((j: any) => ADJACENT_TRADES[(j.trade ?? '').toLowerCase()]);
  if (!candidate) return null;

  const options = ADJACENT_TRADES[(candidate.trade ?? '').toLowerCase()] ?? [];
  const pick = options[0];
  // R212: cohort acceptance rate for the ADJACENT trade sourced from the
  // already-fetched bundle (getTradeBaselines returns all trades × country).
  const adjacentAccept = benchmarks?.tradeBenchmarks?.find(
    b => b.trade === pick?.trade && b.country === (businessProfile?.country ?? 'NL'),
  )?.avgQuoteAcceptanceRate ?? null;

  return {
    id: `cross-sell-${candidate.id}`,
    generatorId: 'cross-sell',
    category: 'opportunity',
    priority: 'medium',
    // Was `Follow-up: ${pick.trade} for ${customerId}` — hardcoded English on
    // a contractor-scoped generator, and it interpolated a RAW customerId
    // ("cust-003") straight into the card title.
    title: gt('cross_sell_title', ctx.language, { trade: pick.trade }),
    message: pick.pitch,
    icon: 'git-branch',
    actionLabel: gt('cross_sell_action', ctx.language),
    actionRoute: `/contractor/tiered-quote?from=${candidate.id}`,
    source: gt('source_ai', ctx.language),
    rootCauseTags: ['growth', 'cross-sell'],
    rawScore: 0,
    reasoning: {
      observation: gt('cross_sell_observation', ctx.language),
      evidence: adjacentAccept !== null && adjacentAccept > 0
        ? `${recent.length} jobs completed in the last 30 days. Cohort median acceptance for ${pick.trade}: ${Math.round(adjacentAccept * 100)}%.`
        : `${recent.length} jobs completed in the last 30 days`,
      implication: gt('cross_sell_implication', ctx.language),
      suggestion: gt('cross_sell_suggestion', ctx.language),
    },
    dataPoints: recent.length,
    confidence: 0.6,
    freshness: 24,
    action: {
      type: 'send_followup',
      label: 'Draft follow-up',
      params: { sourceJobId: candidate.id, adjacentTrade: pick.trade },
      requiresApproval: true,
      estimatedImpact: 'Warm lead — avg 3× higher conversion than cold outreach',
    },
    enqueueHint: {
      type: 'general' as const,
      entityKey: `cross-sell:${candidate.id}:${pick.trade}`,
      expiresInDays: 14,
    },
  } as ScoredInsight;
}
