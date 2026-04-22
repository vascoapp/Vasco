// =============================================================================
// ML PREFILL SERVICE
// =============================================================================
// Shared adapter that pulls the ML predictors (duration, quote win, payment
// timing) and returns quote-builder-ready defaults. Used by:
//   • tiered-quote builder (default hours + expected win chance + payment ETA)
//   • AI-draft-from-photo flow (pre-filled hours on each detected line item)
//   • Job detail "predict completion date" chip
// =============================================================================

import { predictJobDuration, predictQuoteWin, predictPaymentTiming } from '../intelligence/mlModels';

export interface QuotePrefillInput {
  trade: string;
  estimatedHours: number;
  materialCount: number;
  crewSize?: number;
  amount: number;
  customerId?: string;
  customerType?: string;
  country?: string;         // R194: required to activate the cohort-trained quote-win model
  priceVsMarketPct?: number;
}

export interface QuotePrefill {
  durationHours: number;
  durationLow: number;
  durationHigh: number;
  winChancePct: number;
  winConfidence: number;
  expectedDaysToPay?: number;
  paymentConfidence?: number;
  recommendation?: string;
}

/** Pull every ML prediction relevant to a quote in one call. Safe to run when
 *  the user has no history — falls back to industry defaults. */
export async function prefillFromQuote(input: QuotePrefillInput): Promise<QuotePrefill> {
  const crew = input.crewSize ?? 1;
  const [duration, win] = await Promise.all([
    predictJobDuration({
      trade: input.trade,
      estimatedHours: input.estimatedHours,
      materialCount: input.materialCount,
      crewSize: crew,
    }).catch(() => null),
    predictQuoteWin({
      trade: input.trade,
      country: input.country,           // R194: threads through to trained LR path
      customerType: input.customerType,
      amount: input.amount,
      priceVsMarketPct: input.priceVsMarketPct ?? 0,
      customerId: input.customerId,
    } as any).catch(() => null),
  ]);

  let payment: { expectedDaysToPay?: number; paymentConfidence?: number } = {};
  if (input.customerId) {
    try {
      const p = await predictPaymentTiming({
        customerId: input.customerId,
        amount: input.amount,
      } as any);
      payment = {
        expectedDaysToPay: Math.round(((p as any).expectedDaysToPay ?? 14)),
        paymentConfidence: (p as any).confidence,
      };
    } catch {}
  }

  const durationHours = Math.round(((duration as any)?.expectedHours ?? input.estimatedHours) * 10) / 10;
  const durationLow = Math.round(((duration as any)?.range?.low ?? durationHours * 0.85) * 10) / 10;
  const durationHigh = Math.round(((duration as any)?.range?.high ?? durationHours * 1.2) * 10) / 10;

  const winChancePct = Math.round(((win as any)?.probability ?? 0.5) * 100);
  const winConfidence = (win as any)?.confidence ?? 0.4;

  const recommendation = (() => {
    if (winChancePct < 35) return 'Low win chance — consider tightening price or adding a lower tier';
    if (winChancePct > 75) return 'Strong win signal — keep the margin';
    return '';
  })();

  return {
    durationHours,
    durationLow,
    durationHigh,
    winChancePct,
    winConfidence,
    ...payment,
    recommendation: recommendation || undefined,
  };
}

/** Lighter pre-fill: duration-only. Used per line item when a human just
 *  typed a rough scope and we want a hours default before they hit send. */
export async function prefillDurationForLine(args: {
  trade: string;
  description: string;
  quantity: number;
}): Promise<number> {
  // Rough heuristic: 1 unit ≈ 1 hour for "install", "replace"; 0.5h for
  // "connect", "check"; scaled by predictor's accuracy ratio.
  const verb = args.description.toLowerCase().split(/\s+/)[0];
  const basePerUnit = ['connect', 'check', 'inspect', 'clean'].includes(verb) ? 0.5
    : ['install', 'replace', 'wire', 'mount', 'fit', 'paint'].includes(verb) ? 1.0
    : 0.75;
  const rough = basePerUnit * Math.max(1, args.quantity);

  try {
    const pred = await predictJobDuration({
      trade: args.trade,
      estimatedHours: rough,
      materialCount: 0,
      crewSize: 1,
    });
    return Math.round(((pred as any)?.expectedHours ?? rough) * 10) / 10;
  } catch {
    return Math.round(rough * 10) / 10;
  }
}
