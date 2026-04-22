// =============================================================================
// CUSTOMER RISK MOAT SERVICE (R201)
// =============================================================================
// Cohort-level customer-risk prior — overdue rate, average reminders sent,
// average days-to-payment — aggregated per (country, customer_type). For
// brand-new customers where the contractor has no personal history yet,
// this gives a grounded baseline instead of a naive zero-risk assumption.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_cohort_customer_risk';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CohortCustomerRisk {
  overdueRate: number | null;       // 0.0–1.0
  avgRemindersSent: number | null;  // mean reminders before payment
  avgDaysToPayment: number | null;
  sampleSize: number;
  contractorCount: number;
  fetchedAt: string;
}

export type RiskBand = 'low' | 'medium' | 'high';

/**
 * Map a cohort overdue rate to a coarse risk band the UI can colour.
 *   <20% → low · 20–40% → medium · ≥40% → high
 * Returns null when the cohort row was k-anonymity-suppressed.
 */
export function bandFor(overdueRate: number | null | undefined): RiskBand | null {
  if (overdueRate == null) return null;
  if (overdueRate < 0.2) return 'low';
  if (overdueRate < 0.4) return 'medium';
  return 'high';
}

function cacheKey(country: string, customerType?: string | null) {
  return `${CACHE_KEY}:${country}:${customerType ?? 'any'}`;
}

export async function getCohortOverdueRate(
  country: string,
  customerType?: string | null,
): Promise<CohortCustomerRisk | null> {
  const key = cacheKey(country, customerType);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CohortCustomerRisk;
      if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_cohort_overdue_rate', {
      p_country: country,
      p_customer_type: customerType ?? null,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const bundle: CohortCustomerRisk = {
      overdueRate: row.overdue_rate ?? null,
      avgRemindersSent: row.avg_reminders_sent ?? null,
      avgDaysToPayment: row.avg_days_to_payment ?? null,
      sampleSize: Number(row.sample_size ?? 0),
      contractorCount: Number(row.contractor_count ?? 0),
      fetchedAt: new Date().toISOString(),
    };
    void AsyncStorage.setItem(key, JSON.stringify(bundle)).catch(() => {});
    return bundle;
  } catch {
    return null;
  }
}

export const __internal = { CACHE_KEY, CACHE_TTL_MS, cacheKey };
