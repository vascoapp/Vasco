// =============================================================================
// COHORT BENCHMARK SERVICE — Cross-contractor pricing intelligence
// =============================================================================
// Aggregates anonymized pricing data across all Vasco users to create
// trade × region × material benchmarks. This is the core data moat.
// =============================================================================
// Data sources:
// 1. Quote line items (recordPricingData in dataCollector)
// 2. Invoice scans (feedPricingMoat in invoiceScanService)
// 3. Job outcomes (emitJobCompleted with actual costs)
// 4. Supplier catalog prices (supplier integrations)
// 5. Public price indexes (priceIndexService)
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getScanHistory } from './invoiceScanService';
import type { PriceRecommendation } from './invoiceScanService';

const CACHE_KEY = '@vasco_cohort_benchmarks';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaterialBenchmark {
  materialName: string;
  category: string;
  trade: string;
  country: string;
  // Price statistics
  avgPrice: number;
  medianPrice: number;
  p25: number;
  p75: number;
  minPrice: number;
  maxPrice: number;
  // Trend
  priceChange30d: number; // percentage
  priceChange90d: number;
  trend: 'rising' | 'stable' | 'falling';
  volatility: number; // 0-1 (stddev / mean)
  // Data quality
  sampleSize: number;
  lastUpdated: string;
}

export interface TradeBenchmark {
  trade: string;
  country: string;
  avgHourlyRate: number;
  medianHourlyRate: number;
  avgJobMargin: number;
  avgQuoteAcceptanceRate: number;
  avgDSO: number; // days sales outstanding
  sampleSize: number;
}

export interface CohortStats {
  materialBenchmarks: MaterialBenchmark[];
  tradeBenchmarks: TradeBenchmark[];
  lastSync: string;
  contractorsInCohort: number;
}

// ---------------------------------------------------------------------------
// Fetch from Supabase (when deployed)
// ---------------------------------------------------------------------------

async function fetchCohortFromCloud(trade: string, country: string): Promise<CohortStats | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // Call the RPC function that computes weekly stats
    const weekKey = getWeekKey();
    const { data, error } = await (supabase.rpc as any)('compute_weekly_cohort_stats', { week_key: weekKey });
    if (error || !data) return null;

    // Also fetch trade-specific pricing stats
    const { data: pricing } = await (supabase.rpc as any)('get_trade_pricing_stats', {
      p_trade: trade,
      p_country: country,
    });

    return {
      materialBenchmarks: pricing?.materials ?? [],
      tradeBenchmarks: pricing?.trades ?? [],
      lastSync: new Date().toISOString(),
      contractorsInCohort: data?.contractor_count ?? 0,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local benchmark computation (from scan history + AppState data)
// ---------------------------------------------------------------------------

async function computeLocalBenchmarks(trade: string, country: string): Promise<CohortStats> {
  const scanHistory = await getScanHistory();

  // Build material benchmarks from scan history
  const priceMap = new Map<string, number[]>();
  for (const scan of scanHistory) {
    for (const item of scan.lineItems) {
      const key = `${item.description.toLowerCase().trim()}|${item.category}`;
      const prices = priceMap.get(key) ?? [];
      prices.push(item.unitPrice);
      priceMap.set(key, prices);
    }
  }

  const materialBenchmarks: MaterialBenchmark[] = [];
  for (const [key, prices] of priceMap) {
    if (prices.length < 1) continue;
    const [name, category] = key.split('|');
    const sorted = [...prices].sort((a, b) => a - b);
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const stddev = Math.sqrt(prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length);

    materialBenchmarks.push({
      materialName: name,
      category: category || 'general',
      trade,
      country,
      avgPrice: Math.round(mean * 100) / 100,
      medianPrice: Math.round(median * 100) / 100,
      p25: sorted[Math.floor(sorted.length * 0.25)] ?? sorted[0],
      p75: sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1],
      minPrice: sorted[0],
      maxPrice: sorted[sorted.length - 1],
      priceChange30d: 0,
      priceChange90d: 0,
      trend: 'stable',
      volatility: mean > 0 ? Math.round((stddev / mean) * 100) / 100 : 0,
      sampleSize: prices.length,
      lastUpdated: new Date().toISOString(),
    });
  }

  return {
    materialBenchmarks: materialBenchmarks.sort((a, b) => b.sampleSize - a.sampleSize),
    tradeBenchmarks: [{
      trade,
      country,
      avgHourlyRate: country === 'UK' ? 45 : country === 'DE' ? 55 : 50,
      medianHourlyRate: country === 'UK' ? 42 : country === 'DE' ? 52 : 48,
      avgJobMargin: 22,
      avgQuoteAcceptanceRate: 0.65,
      avgDSO: 21,
      sampleSize: scanHistory.length,
    }],
    lastSync: new Date().toISOString(),
    contractorsInCohort: 1, // local only = 1 contractor
  };
}

// ---------------------------------------------------------------------------
// Main fetch with cache
// ---------------------------------------------------------------------------

export async function getCohortBenchmarks(trade: string, country: string): Promise<CohortStats> {
  // Check cache
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) return data;
    }
  } catch {}

  // Try cloud first
  const cloud = await fetchCohortFromCloud(trade, country);
  if (cloud) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: cloud, timestamp: Date.now() })).catch(() => {});
    return cloud;
  }

  // Fall back to local computation
  const local = await computeLocalBenchmarks(trade, country);
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: local, timestamp: Date.now() })).catch(() => {});
  return local;
}

// ---------------------------------------------------------------------------
// Compare contractor's price to cohort benchmark
// ---------------------------------------------------------------------------

export function compareToMarket(
  materialName: string,
  yourPrice: number,
  benchmarks: MaterialBenchmark[],
): { position: 'below' | 'average' | 'above' | 'unknown'; percentile: number; savings: number } {
  const match = benchmarks.find(b => b.materialName === materialName.toLowerCase().trim());
  if (!match || match.sampleSize < 2) return { position: 'unknown', percentile: 50, savings: 0 };

  if (yourPrice <= match.p25) return { position: 'below', percentile: 25, savings: 0 };
  if (yourPrice >= match.p75) return { position: 'above', percentile: 75, savings: Math.round((yourPrice - match.medianPrice) * 100) / 100 };
  return { position: 'average', percentile: 50, savings: 0 };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useCohortBenchmarks(trade: string = 'general', country: string = 'NL') {
  const [data, setData] = useState<CohortStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCohortBenchmarks(trade, country)
      .then(setData)
      .finally(() => setLoading(false));
  }, [trade, country]);

  return { benchmarks: data, loading };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
