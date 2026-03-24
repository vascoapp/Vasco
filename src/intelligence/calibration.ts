// =============================================================================
// CALIBRATION SYSTEM - Track prediction accuracy over time
// =============================================================================
// When a generator makes a quantitative prediction, log it.
// When the outcome is known, compare and score.
// Generators with poor calibration get confidence reduced.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useRef } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { MS_PER_DAY } from '../utils/timeConstants';
import {
  insertCalibrationEntry as dbInsertCalibration,
  resolveCalibrationEntry as dbResolveCalibration,
  getAllCalibrationScores as dbGetCalibrationScores,
  getCalibrationEntriesByGenerator as dbGetCalibrationByGen,
} from '../lib/intelligenceDataProvider';

// =============================================================================
// TYPES
// =============================================================================

export interface CalibrationEntry {
  id: string;
  generatorId: string;
  predictedAt: string;
  prediction: string;         // "DSO zal stijgen boven 30 dagen"
  predictedValue?: number;
  actualValue?: number;
  resolvedAt?: string;
  accurate?: boolean;
}

export interface CalibrationScore {
  generatorId: string;
  totalPredictions: number;
  resolvedPredictions: number;
  accurateCount: number;
  accuracyRate: number;        // 0-1 (time-weighted)
  dataQuality: number;         // 0-1 (higher = more resolved + recent data)
}

interface CalibrationStore {
  entries: CalibrationEntry[];
  lastUpdated: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = '@vasco_calibration';
const MAX_ENTRIES = 200;

// In-memory deduplication: prevent duplicate logPrediction calls from re-renders
const recentPredictions = new Map<string, number>(); // key -> timestamp
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// PERSISTENCE
// =============================================================================

async function loadStore(): Promise<CalibrationStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Silent
  }
  return { entries: [], lastUpdated: new Date().toISOString() };
}

async function saveStore(store: CalibrationStore): Promise<void> {
  try {
    store.lastUpdated = new Date().toISOString();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Silent
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

export async function logPrediction(entry: Omit<CalibrationEntry, 'id'>): Promise<string> {
  // Dedup: skip if same generator + same value was logged recently (prevents re-render spam)
  const dedupKey = `${entry.generatorId}:${entry.predictedValue ?? ''}`;
  const now = Date.now();
  const lastLogged = recentPredictions.get(dedupKey);
  if (lastLogged && now - lastLogged < DEDUP_WINDOW_MS) {
    return ''; // Already logged recently, skip
  }
  recentPredictions.set(dedupKey, now);

  // Prune stale dedup entries periodically
  if (recentPredictions.size > 50) {
    for (const [key, ts] of recentPredictions) {
      if (now - ts > DEDUP_WINDOW_MS) recentPredictions.delete(key);
    }
  }

  const store = await loadStore();
  const id = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.entries.push({ ...entry, id });

  if (store.entries.length > MAX_ENTRIES) {
    store.entries = store.entries.slice(-MAX_ENTRIES);
  }

  await saveStore(store);

  // Persist to Supabase (fire-and-forget)
  if (isSupabaseConfigured) {
    dbInsertCalibration({
      generator_id: entry.generatorId,
      prediction: entry.prediction,
      predicted_value: entry.predictedValue,
    }).catch(() => {});
  }

  return id;
}

export async function resolvePrediction(
  entryId: string,
  actualValue: number,
  tolerancePercent: number = 15,
): Promise<void> {
  const store = await loadStore();
  const entry = store.entries.find(e => e.id === entryId);
  if (!entry) return;

  entry.actualValue = actualValue;
  entry.resolvedAt = new Date().toISOString();

  if (entry.predictedValue !== undefined) {
    const diff = Math.abs(entry.predictedValue - actualValue);
    const tolerance = Math.abs(entry.predictedValue) * (tolerancePercent / 100);
    entry.accurate = diff <= tolerance;
  }

  await saveStore(store);

  // Persist to Supabase
  if (isSupabaseConfigured) {
    dbResolveCalibration(entryId, actualValue, entry.accurate ?? false).catch(() => {});
  }
}

export async function getCalibrationScores(): Promise<CalibrationScore[]> {
  // Prefer Supabase when available
  if (isSupabaseConfigured) {
    try {
      const dbScores = await dbGetCalibrationScores();
      if (dbScores.length > 0) {
        return dbScores.map((s) => ({
          generatorId: s.generator_id,
          totalPredictions: s.total,
          resolvedPredictions: s.resolved,
          accurateCount: s.accurate,
          accuracyRate: s.rate,
          dataQuality: Math.min(1, s.resolved / 20) * (s.resolved > 0 ? 1 : 0.3),
        }));
      }
    } catch { /* fall through to local */ }
  }

  const store = await loadStore();
  const byGenerator = new Map<string, CalibrationEntry[]>();

  for (const entry of store.entries) {
    const existing = byGenerator.get(entry.generatorId) || [];
    existing.push(entry);
    byGenerator.set(entry.generatorId, existing);
  }

  const now = Date.now();
  const scores: CalibrationScore[] = [];
  for (const [generatorId, entries] of byGenerator) {
    const resolved = entries.filter(e => e.resolvedAt);

    // Time-weighted accuracy: recent resolutions count more
    let weightedAccurate = 0;
    let totalWeight = 0;
    for (const entry of resolved) {
      const ageDays = (now - new Date(entry.resolvedAt!).getTime()) / MS_PER_DAY;
      const weight = ageDays < 7 ? 1.0
        : ageDays < 14 ? 0.8
        : ageDays < 30 ? 0.5
        : 0.2;
      totalWeight += weight;
      if (entry.accurate === true) weightedAccurate += weight;
    }

    const accuracyRate = totalWeight > 0 ? weightedAccurate / totalWeight : 0.5;

    // Data quality: higher when more resolved predictions + recent data
    const resolvedCount = resolved.length;
    const volumeScore = Math.min(1, resolvedCount / 20); // saturates at 20 resolutions
    const recentResolutions = resolved.filter(e => {
      const age = (now - new Date(e.resolvedAt!).getTime()) / MS_PER_DAY;
      return age < 14;
    }).length;
    const recencyScore = resolvedCount > 0 ? Math.min(1, recentResolutions / Math.max(1, resolvedCount * 0.3)) : 0;
    const dataQuality = volumeScore * 0.6 + recencyScore * 0.4;

    scores.push({
      generatorId,
      totalPredictions: entries.length,
      resolvedPredictions: resolvedCount,
      accurateCount: resolved.filter(e => e.accurate === true).length,
      accuracyRate,
      dataQuality,
    });
  }

  return scores;
}

// =============================================================================
// AUTO-RESOLUTION - Resolve pending predictions when outcomes arrive
// =============================================================================

/**
 * Resolve all unresolved predictions for a generator by comparing against actual value.
 * Called when outcome data becomes available (e.g., job completes, invoice paid).
 */
export async function resolveByGenerator(
  generatorId: string,
  actualValue: number,
  tolerancePercent: number = 15,
  maxAge: number = 30 * MS_PER_DAY, // only resolve predictions < 30 days old
): Promise<number> {
  const store = await loadStore();
  let resolved = 0;

  const now = Date.now();
  for (const entry of store.entries) {
    if (entry.generatorId !== generatorId) continue;
    if (entry.resolvedAt) continue; // already resolved
    if (entry.predictedValue === undefined) continue;

    // Skip predictions older than maxAge
    const age = now - new Date(entry.predictedAt).getTime();
    if (age > maxAge) continue;

    entry.actualValue = actualValue;
    entry.resolvedAt = new Date().toISOString();
    const diff = Math.abs(entry.predictedValue - actualValue);
    const tolerance = Math.abs(entry.predictedValue) * (tolerancePercent / 100);
    entry.accurate = diff <= tolerance;
    resolved++;
  }

  if (resolved > 0) {
    await saveStore(store);
  }
  return resolved;
}

/**
 * Batch-resolve predictions from multiple generators based on outcome data.
 * Use this when job/invoice/payment outcomes arrive to update all relevant predictions.
 */
export async function resolveCalibrationPredictions(outcomes: {
  generatorId: string;
  actualValue: number;
  tolerancePercent?: number;
}[]): Promise<number> {
  let totalResolved = 0;
  for (const outcome of outcomes) {
    const count = await resolveByGenerator(
      outcome.generatorId,
      outcome.actualValue,
      outcome.tolerancePercent ?? 15,
    );
    totalResolved += count;
  }
  return totalResolved;
}

/**
 * Smooth logistic confidence multiplier.
 * Maps calibration rate (0-1) to multiplier (0.7-1.1) using a logistic curve.
 * Centered at 0.6 accuracy (neutral = 1.0). No cliff effects.
 */
export function getConfidenceMultiplier(calibrationRate: number): number {
  // Logistic: 0.7 + 0.4 / (1 + e^(-k*(x - midpoint)))
  // At rate=0.6 → ~1.0, rate=0.8 → ~1.08, rate=0.3 → ~0.73
  const k = 8;  // steepness
  const midpoint = 0.6;
  return 0.7 + 0.4 / (1 + Math.exp(-k * (calibrationRate - midpoint)));
}

// =============================================================================
// HOOK: useCalibrationScores
// =============================================================================

export function useCalibrationScores(): {
  scores: CalibrationScore[];
  loading: boolean;
  overallAccuracy: number;
} {
  const [scores, setScores] = useState<CalibrationScore[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    getCalibrationScores().then(s => {
      if (mounted.current) {
        setScores(s);
        setLoading(false);
      }
    });
    return () => { mounted.current = false; };
  }, []);

  const overallAccuracy = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.accuracyRate, 0) / scores.length
    : 0.5;

  return { scores, loading, overallAccuracy };
}
