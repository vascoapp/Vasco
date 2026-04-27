// =============================================================================
// TIME-OF-DAY ACCEPTANCE SERVICE (R260)
// =============================================================================
// Reads `get_time_of_day_acceptance` RPC (migration 20260427000001) and turns
// the (hour × day-of-week) acceptance matrix into a single actionable hint:
// "Tuesday morning — 22% higher acceptance than your worst slot."
//
// The RPC enforces k-anonymity (>=5 contractors per cell). When all cells are
// gated out we surface nothing rather than guessing.
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface TimeOfDayBucket {
  hourOfDay: number;          // 0..23
  dayOfWeek: number;          // 0=Sun … 6=Sat
  acceptanceRate: number;     // 0..1
  sampleSize: number;
  contractorCount: number;
}

export interface TimeOfDayHint {
  bestBucket: TimeOfDayBucket;
  worstBucket: TimeOfDayBucket;
  liftPoints: number;         // bestRate - worstRate, in percentage points
  totalSamples: number;
}

export interface ContextualTimingTone {
  tone: 'send_now' | 'send_later' | 'neutral';
  // Lift between the best bucket and the current bucket, in percentage points.
  // Positive = best is better than now; 0 = now is the best slot.
  liftVsNow: number;
}

const MIN_BUCKETS_FOR_HINT = 4;
const MIN_LIFT_POINTS = 0.08;

export async function fetchTimeOfDayBuckets(
  trade: string,
  country: string,
  months = 6,
): Promise<TimeOfDayBucket[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('get_time_of_day_acceptance', {
      p_trade: trade,
      p_country: country,
      p_months: months,
    });
    if (error || !Array.isArray(data)) return [];
    return data
      .map((r: any): TimeOfDayBucket => ({
        hourOfDay: Number(r.hour_of_day),
        dayOfWeek: Number(r.day_of_week),
        acceptanceRate: Number(r.acceptance_rate ?? 0),
        sampleSize: Number(r.sample_size ?? 0),
        contractorCount: Number(r.contractor_count ?? 0),
      }))
      .filter((b) => Number.isFinite(b.hourOfDay) && Number.isFinite(b.dayOfWeek));
  } catch {
    return [];
  }
}

export function buildTimeOfDayHint(buckets: TimeOfDayBucket[]): TimeOfDayHint | null {
  if (buckets.length < MIN_BUCKETS_FOR_HINT) return null;

  let best = buckets[0];
  let worst = buckets[0];
  let total = 0;
  for (const b of buckets) {
    total += b.sampleSize;
    if (b.acceptanceRate > best.acceptanceRate) best = b;
    if (b.acceptanceRate < worst.acceptanceRate) worst = b;
  }
  const lift = best.acceptanceRate - worst.acceptanceRate;
  if (lift < MIN_LIFT_POINTS) return null;

  return {
    bestBucket: best,
    worstBucket: worst,
    liftPoints: lift,
    totalSamples: total,
  };
}

export function dayPart(hour: number): 'morning' | 'midday' | 'afternoon' | 'evening' {
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

const SIGNIFICANT_LIFT = 0.05;

/**
 * Given the cohort buckets and the current (hour, dow), classify whether the
 * user should send now, wait, or that timing doesn't matter much. The current
 * bucket may not exist in the data (k-anonymity gated it out) — in that case
 * we fall back to the average across all buckets.
 */
export function classifyNow(
  buckets: TimeOfDayBucket[],
  nowHour: number,
  nowDow: number,
): ContextualTimingTone {
  if (buckets.length < MIN_BUCKETS_FOR_HINT) {
    return { tone: 'neutral', liftVsNow: 0 };
  }
  const best = buckets.reduce((a, b) => (b.acceptanceRate > a.acceptanceRate ? b : a));
  const nowBucket = buckets.find((b) => b.hourOfDay === nowHour && b.dayOfWeek === nowDow);
  const nowRate = nowBucket
    ? nowBucket.acceptanceRate
    : buckets.reduce((sum, b) => sum + b.acceptanceRate * b.sampleSize, 0) /
      Math.max(1, buckets.reduce((sum, b) => sum + b.sampleSize, 0));

  const lift = best.acceptanceRate - nowRate;
  if (lift < SIGNIFICANT_LIFT) return { tone: 'send_now', liftVsNow: 0 };
  return { tone: 'send_later', liftVsNow: lift };
}

export function useTimeOfDayHint(trade: string | undefined, country: string | undefined) {
  const [hint, setHint] = useState<TimeOfDayHint | null>(null);
  const [buckets, setBuckets] = useState<TimeOfDayBucket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!trade || !country) {
      setHint(null);
      setBuckets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchTimeOfDayBuckets(trade, country)
      .then((b) => {
        if (cancelled) return;
        setBuckets(b);
        setHint(buildTimeOfDayHint(b));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trade, country]);

  return { hint, buckets, loading };
}
