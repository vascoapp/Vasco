// =============================================================================
// TIME-OF-DAY PAYMENT TIMING SERVICE (R261)
// =============================================================================
// Reads `get_time_of_day_payment_timing` RPC (migration 20260427000002).
// Returns the (hour × dow) bucket where invoices sent at that time get paid
// fastest (lowest median days-to-paid) AND most reliably (highest paid_rate).
//
// We score each bucket as: paid_rate × max(0, 30 - median_days_to_paid).
// Buckets with no payment data (median null) score 0. The hint surfaces only
// when the best bucket beats the worst by a meaningful margin.
//
// k-anonymity ≥5 contractors enforced server-side.
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PaymentTimingBucket {
  hourOfDay: number;            // 0..23
  dayOfWeek: number;            // 0=Sun … 6=Saturday
  paidRate: number;             // 0..1
  medianDaysToPaid: number | null;
  sampleSize: number;
  contractorCount: number;
}

export interface PaymentTimingHint {
  bestBucket: PaymentTimingBucket;
  worstBucket: PaymentTimingBucket;
  daysSavedVsWorst: number;     // worst - best, positive = best pays N days faster
  paidRateLiftPoints: number;   // bestRate - worstRate
  totalSamples: number;
}

const MIN_BUCKETS_FOR_HINT = 4;
const MIN_DAYS_SAVED = 2;
const MIN_PAID_RATE_LIFT = 0.08;

export async function fetchPaymentTimingBuckets(
  trade: string,
  country: string,
  months = 6,
): Promise<PaymentTimingBucket[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('get_time_of_day_payment_timing', {
      p_trade: trade,
      p_country: country,
      p_months: months,
    });
    if (error || !Array.isArray(data)) return [];
    return data
      .map((r: any): PaymentTimingBucket => ({
        hourOfDay: Number(r.hour_of_day),
        dayOfWeek: Number(r.day_of_week),
        paidRate: Number(r.paid_rate ?? 0),
        medianDaysToPaid: r.median_days_to_paid !== null ? Number(r.median_days_to_paid) : null,
        sampleSize: Number(r.sample_size ?? 0),
        contractorCount: Number(r.contractor_count ?? 0),
      }))
      .filter((b) => Number.isFinite(b.hourOfDay) && Number.isFinite(b.dayOfWeek));
  } catch {
    return [];
  }
}

export function buildPaymentTimingHint(buckets: PaymentTimingBucket[]): PaymentTimingHint | null {
  if (buckets.length < MIN_BUCKETS_FOR_HINT) return null;

  // Score: prioritise paid_rate, then days-to-paid (faster better).
  // For ranking: we want the highest paidRate AND lowest medianDaysToPaid.
  // Combine into a single score = paidRate − (median / 60) so a 1pp paidRate
  // bump is roughly equivalent to 0.6 days faster.
  const score = (b: PaymentTimingBucket) => {
    const days = b.medianDaysToPaid ?? 60;
    return b.paidRate - days / 60;
  };

  let best = buckets[0];
  let worst = buckets[0];
  let bestScore = score(best);
  let worstScore = score(worst);
  let total = 0;
  for (const b of buckets) {
    total += b.sampleSize;
    const sc = score(b);
    if (sc > bestScore) { best = b; bestScore = sc; }
    if (sc < worstScore) { worst = b; worstScore = sc; }
  }

  const bestDays = best.medianDaysToPaid ?? Infinity;
  const worstDays = worst.medianDaysToPaid ?? Infinity;
  const daysSaved = Number.isFinite(bestDays) && Number.isFinite(worstDays)
    ? worstDays - bestDays
    : 0;
  const paidRateLift = best.paidRate - worst.paidRate;

  // Only show hint if at least one of the two thresholds is met.
  if (daysSaved < MIN_DAYS_SAVED && paidRateLift < MIN_PAID_RATE_LIFT) return null;

  return {
    bestBucket: best,
    worstBucket: worst,
    daysSavedVsWorst: Math.max(0, daysSaved),
    paidRateLiftPoints: paidRateLift,
    totalSamples: total,
  };
}

export function dayPart(hour: number): 'morning' | 'midday' | 'afternoon' | 'evening' {
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function useTimeOfDayPaymentHint(trade: string | undefined, country: string | undefined) {
  const [hint, setHint] = useState<PaymentTimingHint | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!trade || !country) {
      setHint(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPaymentTimingBuckets(trade, country)
      .then((buckets) => {
        if (cancelled) return;
        setHint(buildPaymentTimingHint(buckets));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trade, country]);

  return { hint, loading };
}
