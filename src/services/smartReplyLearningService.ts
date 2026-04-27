// =============================================================================
// SMART-REPLY LEARNING LOOP (R271)
// =============================================================================
// Tracks which suggestion ids the contractor taps vs ignores, and exposes a
// per-id multiplier the smart-reply scorer uses to dampen unused chips and
// boost popular ones.
//
// Pattern mirrors R269's getGeneratorTrustMultiplier — same shape, simpler
// math because chips don't have the 14-dim insight context.
//
// AsyncStorage-only (no server). Cache in-memory between app sessions so the
// scorer stays sync.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_smart_reply_stats';
const MIN_IMPRESSIONS_FOR_LEARNING = 3;

interface ChipStats {
  impressions: number;     // shown to user
  taps: number;            // tapped → opened native composer
}

interface LearningState {
  byId: Record<string, ChipStats>;
  byKind: Record<string, ChipStats>;   // grouped — e.g. "quote-followup" base
}

let cache: LearningState | null = null;

async function load(): Promise<LearningState> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : { byId: {}, byKind: {} };
  } catch {
    cache = { byId: {}, byKind: {} };
  }
  if (!cache!.byId) cache!.byId = {};
  if (!cache!.byKind) cache!.byKind = {};
  return cache!;
}

async function persist(state: LearningState): Promise<void> {
  cache = state;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silent
  }
}

function bump(stats: ChipStats | undefined, key: 'impressions' | 'taps'): ChipStats {
  const base = stats ?? { impressions: 0, taps: 0 };
  return { ...base, [key]: base[key] + 1 };
}

/** Record that a chip was rendered. Call once per impression batch. */
export async function recordImpression(chipId: string): Promise<void> {
  if (!chipId) return;
  const state = await load();
  state.byId[chipId] = bump(state.byId[chipId], 'impressions');
  state.byKind[chipId] = bump(state.byKind[chipId], 'impressions');
  await persist(state);
}

/** Record that the contractor tapped the chip and opened the channel. */
export async function recordTap(chipId: string): Promise<void> {
  if (!chipId) return;
  const state = await load();
  state.byId[chipId] = bump(state.byId[chipId], 'taps');
  state.byKind[chipId] = bump(state.byKind[chipId], 'taps');
  await persist(state);
}

/**
 * Returns a multiplier in roughly [0.4, 1.6]. Neutral (1.0) until we have
 * MIN_IMPRESSIONS_FOR_LEARNING samples. Then:
 *   tap rate ≥ 50% → 1.6 (boost)
 *   tap rate ≥ 25% → 1.2
 *   tap rate ≥ 10% → 1.0 (neutral)
 *   tap rate < 10% → 0.4 (dampen — they keep ignoring this)
 *
 * Sync — relies on the in-memory cache. Call `primeCache()` once at app start
 * to ensure the cache is warm before the first scoring pass.
 */
export function getChipMultiplier(chipId: string): number {
  if (!cache || !chipId) return 1.0;
  const stats = cache.byId[chipId] ?? cache.byKind[chipId];
  if (!stats || stats.impressions < MIN_IMPRESSIONS_FOR_LEARNING) return 1.0;
  const rate = stats.taps / stats.impressions;
  if (rate >= 0.5) return 1.6;
  if (rate >= 0.25) return 1.2;
  if (rate >= 0.1) return 1.0;
  return 0.4;
}

/** Eager cache load. Call from app boot so the sync getter has data. */
export async function primeCache(): Promise<void> {
  await load();
}

/** Test helper — wipe cache + storage. Not exported in production paths. */
export async function __resetForTest(): Promise<void> {
  cache = { byId: {}, byKind: {} };
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

/** Read-only snapshot for debugging / admin. */
export async function getStats(): Promise<LearningState> {
  return load();
}
