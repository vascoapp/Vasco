// =============================================================================
// POSTCODE-LEVEL COHORT BENCHMARK (R265)
// =============================================================================
// Reads `get_postcode_cohort_stats` RPC (migration 20260426000001). Closes the
// dormant loop where the RPC was added but had no consumer.
//
// Per-country prefix length: NL/Nordics = 4 digits, UK = 4-char outward,
// DE/FR/ES/IT = 3 digits. K-anonymity ≥5 contractors enforced server-side.
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PostcodeCohort {
  avgUnitPrice: number | null;
  medianUnitPrice: number | null;
  avgMargin: number | null;
  acceptanceRate: number | null;
  sampleSize: number;
  contractorCount: number;
}

export function postcodePrefixLengthFor(country: string): number {
  switch (country?.toUpperCase()) {
    case 'NL': case 'SE': case 'NO': case 'DK': case 'FI': return 4;
    case 'UK': return 4;
    default: return 3;
  }
}

export async function getPostcodeCohort(
  trade: string,
  country: string,
  postcode: string | undefined | null,
): Promise<PostcodeCohort | null> {
  if (!isSupabaseConfigured || !postcode) return null;
  const prefix = String(postcode).replace(/\s/g, '').slice(0, postcodePrefixLengthFor(country));
  if (prefix.length < 2) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_postcode_cohort_stats', {
      p_trade: trade,
      p_country: country,
      p_postcode_prefix: prefix,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      avgUnitPrice: row.avg_unit_price ?? null,
      medianUnitPrice: row.median_unit_price ?? null,
      avgMargin: row.avg_margin ?? null,
      acceptanceRate: row.acceptance_rate ?? null,
      sampleSize: Number(row.sample_size ?? 0),
      contractorCount: Number(row.contractor_count ?? 0),
    };
  } catch {
    return null;
  }
}

export function usePostcodeCohort(
  trade: string | undefined,
  country: string | undefined,
  postcode: string | undefined | null,
) {
  const [data, setData] = useState<PostcodeCohort | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!trade || !country || !postcode) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getPostcodeCohort(trade, country, postcode)
      .then((res) => { if (!cancelled) setData(res); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trade, country, postcode]);

  return { cohort: data, loading };
}
