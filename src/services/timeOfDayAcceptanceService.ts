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

export function useTimeOfDayHint(trade: string | undefined, country: string | undefined) {
  const [hint, setHint] = useState<TimeOfDayHint | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!trade || !country) {
      setHint(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchTimeOfDayBuckets(trade, country)
      .then((buckets) => {
        if (cancelled) return;
        setHint(buildTimeOfDayHint(buckets));
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
