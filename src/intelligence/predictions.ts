// =============================================================================
// AI PREDICTIONS CLIENT — calls Supabase Edge Functions
// =============================================================================
// Used by quote builder, job scheduler, and invoice screens
// Falls back to local heuristics when offline
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { loadProfile } from './learningStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricePrediction {
  suggestedPrice: number | null;
  confidence: number;
  p25: number;
  median: number;
  p75: number;
  sampleSize: number;
  acceptanceRate: number;
  avgMargin: number | null;
  adjustments: { regional: number; seasonal: number };
}

export interface DurationPrediction {
  predictedHours: number | null;
  adjustmentFactor: number;
  confidence: number;
  sampleSize: number;
  risks: { scopeChangeRate: number; materialDelayRate: number };
  insight: string;
}

export interface DSOPrediction {
  predictedDSO: number;
  confidence: number;
  historicalAvg: number;
  paymentCount: number;
  onTimeRate: number;
}

// ---------------------------------------------------------------------------
// Price prediction
// ---------------------------------------------------------------------------

export async function predictPrice(params: {
  trade: string;
  country: string;
  jobType?: string;
  lineDescription?: string;
  region?: string;
}): Promise<PricePrediction> {
  if (!isSupabaseConfigured) {
    return fallbackPricePredictionFromProfile(params.trade);
  }

  try {
    const { data, error } = await supabase.functions.invoke('predict-price', {
      body: params,
    });

    if (error || !data) return fallbackPricePredictionFromProfile(params.trade);
    return data as PricePrediction;
  } catch {
    return fallbackPricePredictionFromProfile(params.trade);
  }
}

async function fallbackPricePredictionFromProfile(trade: string): Promise<PricePrediction> {
  try {
    const profile = await loadProfile();
    const recentJobs = profile.jobCompletionHistory || [];

    if (recentJobs.length >= 3) {
      // Compute average hourly rate from contractor's own completed jobs
      const rates = recentJobs
        .filter(j => j.actualHours > 0)
        .map(j => j.actualCost / j.actualHours);

      if (rates.length >= 3) {
        const avgRate = rates.reduce((s, r) => s + r, 0) / rates.length;
        const sorted = [...rates].sort((a, b) => a - b);
        const p25 = sorted[Math.floor(sorted.length * 0.25)];
        const median = sorted[Math.floor(sorted.length * 0.5)];
        const p75 = sorted[Math.floor(sorted.length * 0.75)];
        const avgMargin = recentJobs.reduce((s, j) => s + j.marginPercent, 0) / recentJobs.length;

        return {
          suggestedPrice: Math.round(avgRate * 100) / 100,
          confidence: Math.min(0.8, 0.3 + rates.length * 0.05),
          p25: Math.round(p25 * 100) / 100,
          median: Math.round(median * 100) / 100,
          p75: Math.round(p75 * 100) / 100,
          sampleSize: rates.length,
          acceptanceRate: 0,
          avgMargin: Math.round(avgMargin * 10) / 10,
          adjustments: { regional: 0, seasonal: 0 },
        };
      }
    }
  } catch {
    // Fall through to static defaults
  }

  return fallbackPricePredictionStatic(trade);
}

function fallbackPricePredictionStatic(trade: string): PricePrediction {
  // Trade-specific hourly rate defaults (NL market) — final fallback
  const rates: Record<string, number> = {
    plumbing: 55,
    electrical: 52,
    gas: 58,
    painting: 42,
    carpentry: 48,
    general: 50,
    other: 45,
  };
  const rate = rates[trade] ?? 50;
  return {
    suggestedPrice: rate,
    confidence: 0,
    p25: rate * 0.8,
    median: rate,
    p75: rate * 1.2,
    sampleSize: 0,
    acceptanceRate: 0,
    avgMargin: null,
    adjustments: { regional: 0, seasonal: 0 },
  };
}

// ---------------------------------------------------------------------------
// Duration prediction
// ---------------------------------------------------------------------------

export async function predictDuration(params: {
  trade: string;
  country: string;
  jobType?: string;
  estimatedHours?: number;
  propertyType?: string;
  jobComplexity?: string;
}): Promise<DurationPrediction> {
  if (!isSupabaseConfigured) {
    return {
      predictedHours: params.estimatedHours ?? null,
      adjustmentFactor: 1.0,
      confidence: 0,
      sampleSize: 0,
      risks: { scopeChangeRate: 0, materialDelayRate: 0 },
      insight: 'Nog niet genoeg data',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('predict-duration', {
      body: params,
    });

    if (error || !data) {
      return {
        predictedHours: params.estimatedHours ?? null,
        adjustmentFactor: 1.0,
        confidence: 0,
        sampleSize: 0,
        risks: { scopeChangeRate: 0, materialDelayRate: 0 },
        insight: 'Voorspelling niet beschikbaar',
      };
    }
    return data as DurationPrediction;
  } catch {
    return {
      predictedHours: params.estimatedHours ?? null,
      adjustmentFactor: 1.0,
      confidence: 0,
      sampleSize: 0,
      risks: { scopeChangeRate: 0, materialDelayRate: 0 },
      insight: 'Verbinding mislukt',
    };
  }
}

// ---------------------------------------------------------------------------
// Customer DSO prediction (uses Supabase RPC)
// ---------------------------------------------------------------------------

export async function predictCustomerDSO(customerId: string): Promise<DSOPrediction> {
  if (!isSupabaseConfigured) {
    return { predictedDSO: 14, confidence: 0, historicalAvg: 14, paymentCount: 0, onTimeRate: 1 };
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return { predictedDSO: 14, confidence: 0, historicalAvg: 14, paymentCount: 0, onTimeRate: 1 };
    }

    const { data, error } = await supabase.rpc('predict_customer_dso', {
      p_user_id: userData.user.id,
      p_customer_id: customerId,
    });

    if (error || !data?.[0]) {
      return { predictedDSO: 14, confidence: 0, historicalAvg: 14, paymentCount: 0, onTimeRate: 1 };
    }

    const row = data[0];
    return {
      predictedDSO: row.predicted_dso,
      confidence: row.confidence,
      historicalAvg: row.historical_avg,
      paymentCount: Number(row.payment_count),
      onTimeRate: row.on_time_rate,
    };
  } catch {
    return { predictedDSO: 14, confidence: 0, historicalAvg: 14, paymentCount: 0, onTimeRate: 1 };
  }
}

// ---------------------------------------------------------------------------
// Similar job search (uses pgvector)
// ---------------------------------------------------------------------------

export interface SimilarJob {
  jobId: string;
  jobDescription: string;
  jobType: string;
  actualCost: number;
  actualHours: number;
  marginPercent: number;
  similarity: number;
}

export async function findSimilarJobs(params: {
  jobDescription: string;
  trade: string;
  country?: string;
  limit?: number;
}): Promise<SimilarJob[]> {
  if (!isSupabaseConfigured) return [];

  // In production: generate embedding via OpenAI/Cohere, then call RPC
  // For now: return empty (embedding generation requires API key)
  return [];
}

// ---------------------------------------------------------------------------
// Trade pricing benchmarks (cohort data)
// ---------------------------------------------------------------------------

export interface TradeBenchmark {
  avgHourlyRate: number;
  medianHourlyRate: number;
  avgMargin: number;
  acceptanceRate: number;
  sampleSize: number;
}

export async function getTradeBenchmark(
  trade: string,
  country: string,
  jobType?: string,
): Promise<TradeBenchmark | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.rpc('get_trade_pricing_stats', {
      p_trade: trade,
      p_country: country,
      p_job_type: jobType ?? null,
    });

    if (error || !data?.[0]) return null;
    const row = data[0];
    return {
      avgHourlyRate: row.avg_hourly_rate ?? 0,
      medianHourlyRate: row.median_hourly_rate ?? 0,
      avgMargin: row.avg_margin ?? 0,
      acceptanceRate: row.acceptance_rate ?? 0,
      sampleSize: Number(row.sample_size ?? 0),
    };
  } catch {
    return null;
  }
}
