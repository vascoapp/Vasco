// =============================================================================
// CALIBRATION SYSTEM - Track prediction accuracy over time
// =============================================================================
// When a generator makes a quantitative prediction, log it.
// When the outcome is known, compare and score.
// Generators with poor calibration get confidence reduced.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useRef } from 'react';

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
  accuracyRate: number;        // 0-1
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
  const store = await loadStore();
  const id = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.entries.push({ ...entry, id });

  if (store.entries.length > MAX_ENTRIES) {
    store.entries = store.entries.slice(-MAX_ENTRIES);
  }

  await saveStore(store);
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
}

export async function getCalibrationScores(): Promise<CalibrationScore[]> {
  const store = await loadStore();
  const byGenerator = new Map<string, CalibrationEntry[]>();

  for (const entry of store.entries) {
    const existing = byGenerator.get(entry.generatorId) || [];
    existing.push(entry);
    byGenerator.set(entry.generatorId, existing);
  }

  const scores: CalibrationScore[] = [];
  for (const [generatorId, entries] of byGenerator) {
    const resolved = entries.filter(e => e.resolvedAt);
    const accurate = resolved.filter(e => e.accurate === true);

    scores.push({
      generatorId,
      totalPredictions: entries.length,
      resolvedPredictions: resolved.length,
      accurateCount: accurate.length,
      accuracyRate: resolved.length > 0 ? accurate.length / resolved.length : 0.5,
    });
  }

  return scores;
}

export function getConfidenceMultiplier(calibrationRate: number): number {
  // Good calibration (>80%) → boost confidence
  // Poor calibration (<50%) → reduce confidence
  if (calibrationRate >= 0.8) return 1.1;
  if (calibrationRate >= 0.6) return 1.0;
  if (calibrationRate >= 0.4) return 0.85;
  return 0.7;
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
