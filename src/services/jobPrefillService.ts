// =============================================================================
// JOB PREFILL — ML-driven defaults on job create
// =============================================================================
// When a contractor drops a fresh job with only a title + trade, ask the
// duration predictor for a sensible default so the scheduling UI doesn't
// leave them staring at empty fields.
// =============================================================================

import { predictJobDuration } from '../intelligence/mlModels';

export interface JobPrefillInput {
  trade: string;
  title: string;
  materialCount?: number;
}

export interface JobPrefillResult {
  suggestedHours: number;
  suggestedPriceLow: number;
  suggestedPriceHigh: number;
  confidence: number;
}

const LABOR_RATE: Record<string, number> = {
  plumbing: 55, electrical: 55, gas: 65, heating: 60, carpentry: 50,
  painting: 45, roofing: 60, tiling: 50, plastering: 50, flooring: 45,
  insulation: 50, solar: 65, glazing: 55, landscaping: 45,
  general: 50,
};

export async function prefillJob(input: JobPrefillInput): Promise<JobPrefillResult> {
  const trade = input.trade.toLowerCase();
  const rate = LABOR_RATE[trade] ?? LABOR_RATE.general;

  // Rough heuristic seed: most one-person jobs run 2-4 hours; anchor there.
  const seedHours = /install|renovate|renovation|extension|build/i.test(input.title) ? 6
    : /replace|repair|fix/i.test(input.title) ? 3
    : /check|inspect|quote/i.test(input.title) ? 1
    : 3;

  let suggestedHours = seedHours;
  let confidence = 0.4;
  try {
    const pred = await predictJobDuration({
      trade,
      estimatedHours: seedHours,
      materialCount: input.materialCount ?? 0,
      crewSize: 1,
    });
    suggestedHours = Math.round(((pred as any).expectedHours ?? seedHours) * 10) / 10;
    confidence = (pred as any).confidence ?? confidence;
  } catch {}

  const suggestedPriceLow = Math.round(suggestedHours * rate * 1.2);
  const suggestedPriceHigh = Math.round(suggestedHours * rate * 1.5);
  return { suggestedHours, suggestedPriceLow, suggestedPriceHigh, confidence };
}
