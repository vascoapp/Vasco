// =============================================================================
// OPTIMIZATION STATS (R255)
// =============================================================================
// Records route-optimization events locally (AsyncStorage) so the Vandaag
// widget can show "Vasco saved you Xkm + Ymin this week."
//
// Each event captures: when, jobs reordered, drive km/min before vs after,
// warnings count. Naive savings calc: previousTotal - optimizedTotal — when
// the contractor accepts the new order. Rejected/dismissed optimizations
// don't count as savings.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_optimization_events';
const MAX_EVENTS = 200;

export interface OptimizationEvent {
  id: string;
  date: string;
  jobCount: number;
  driveKmBefore: number;
  driveMinBefore: number;
  driveKmAfter: number;
  driveMinAfter: number;
  warnings: number;
  applied: boolean;            // contractor accepted the new order
  recordedAt: string;
}

async function loadEvents(): Promise<OptimizationEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function recordOptimization(input: Omit<OptimizationEvent, 'id' | 'recordedAt'>): Promise<OptimizationEvent> {
  const events = await loadEvents();
  const event: OptimizationEvent = {
    ...input,
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    recordedAt: new Date().toISOString(),
  };
  events.push(event);
  const trimmed = events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return event;
}

export interface WeeklyOptimizationStats {
  weekKmSaved: number;
  weekMinSaved: number;
  weekOptimizationCount: number;
  weekJobsReordered: number;
  monthKmSaved: number;
  monthMinSaved: number;
  totalLifetime: number;
}

export async function getWeeklyStats(): Promise<WeeklyOptimizationStats> {
  const events = await loadEvents();
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const monthAgo = now - 30 * 86400000;

  let weekKm = 0, weekMin = 0, weekCount = 0, weekJobs = 0;
  let monthKm = 0, monthMin = 0;

  for (const e of events) {
    if (!e.applied) continue;
    const t = new Date(e.recordedAt).getTime();
    const km = Math.max(0, e.driveKmBefore - e.driveKmAfter);
    const min = Math.max(0, e.driveMinBefore - e.driveMinAfter);
    if (t >= weekAgo) {
      weekKm += km;
      weekMin += min;
      weekCount += 1;
      weekJobs += e.jobCount;
    }
    if (t >= monthAgo) {
      monthKm += km;
      monthMin += min;
    }
  }

  return {
    weekKmSaved: Math.round(weekKm * 10) / 10,
    weekMinSaved: Math.round(weekMin),
    weekOptimizationCount: weekCount,
    weekJobsReordered: weekJobs,
    monthKmSaved: Math.round(monthKm * 10) / 10,
    monthMinSaved: Math.round(monthMin),
    totalLifetime: events.filter((e) => e.applied).length,
  };
}

export async function __resetForTest(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
