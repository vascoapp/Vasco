// =============================================================================
// QUOTE WIN MODEL SERVICE — cohort-trained logistic regression (R191)
// =============================================================================
// Replaces the heuristic quote-win predictor with a model trained on
// accumulated outcomes. Architecture:
//   1. Training data via RPC `get_quote_win_training_data` (server-side
//      k-anonymity >=5 contractors, >=20 quotes; empty otherwise).
//   2. Client-side LR fit with gradient descent + L2 regularization.
//   3. Weights stored in `ai_models` via SECURITY DEFINER RPC.
//   4. Score path loads active model (cached 1h in memory) and produces a
//      probability; heuristic fallback when no model is available.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Feature engineering
// ---------------------------------------------------------------------------
// Keep the feature set MINIMAL. More features = more data needed to fit.
// The 5 features below are sufficient signal for v1 and degrade gracefully
// when categorical columns are null.
//
// FEATURE_NAMES is the source-of-truth ordering. Any change requires a model
// version bump (handled automatically by save_quote_win_model incrementing
// model_version on every save).

// R208: contractor_segment one-hots added. Feature order is the source of
// truth and must not be reordered — models persisted under prior orderings
// still load, and defensive lookups treat missing weights as 0.
export const FEATURE_NAMES = [
  'log_amount',
  'month_sin',
  'month_cos',
  'is_residential',
  'is_commercial',
  'is_small_team',
  'is_medium',
  'is_large',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

export interface TrainingRow {
  total_amount: number;
  customer_type: string | null;
  month_num: number;
  contractor_segment: string | null;
  line_count: number;
  was_accepted: boolean;
}

export interface ScoreInput {
  amount: number;
  month?: number; // 1-12; defaults to current month
  customerType?: string | null;
  contractorSegment?: string | null; // R208: 'solo' (baseline) | 'small_team' | 'medium' | 'large'
}

export interface ModelWeights {
  bias: number;
  // R208: Partial so legacy models persisted under older FEATURE_NAMES
  // still deserialize without type-level pressure to add null entries.
  // Scoring treats missing weights as 0.
  weights: Partial<Record<FeatureName, number>>;
  featureMeans: Partial<Record<FeatureName, number>>;
  featureStds: Partial<Record<FeatureName, number>>;
  nSamples: number;
  trainedAt: string;
}

function featurize(
  row: Pick<TrainingRow, 'total_amount' | 'customer_type' | 'month_num'> & {
    contractor_segment?: string | null;
  },
): Record<FeatureName, number> {
  const safeAmount = Math.max(1, row.total_amount || 1);
  const m = row.month_num || 1;
  const angle = (2 * Math.PI * (m - 1)) / 12;
  const seg = row.contractor_segment ?? null;
  return {
    log_amount: Math.log(safeAmount),
    month_sin: Math.sin(angle),
    month_cos: Math.cos(angle),
    is_residential: row.customer_type === 'residential' ? 1 : 0,
    is_commercial: row.customer_type === 'commercial' ? 1 : 0,
    is_small_team: seg === 'small_team' ? 1 : 0,
    is_medium: seg === 'medium' ? 1 : 0,
    is_large: seg === 'large' ? 1 : 0, // 'solo' is the implicit baseline
  };
}

function standardize(
  vec: Record<FeatureName, number>,
  means: Partial<Record<FeatureName, number>>,
  stds: Partial<Record<FeatureName, number>>,
): Record<FeatureName, number> {
  const out = {} as Record<FeatureName, number>;
  for (const f of FEATURE_NAMES) {
    // R208: missing mean/std in a legacy model means the feature wasn't
    // in that training run — treat as mean=0, std=1 so the feature
    // cleanly contributes zero to the dot-product.
    const mean = means[f] ?? 0;
    const std = stds[f] || 1;
    out[f] = (vec[f] - mean) / std;
  }
  return out;
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const e = Math.exp(-x);
    return 1 / (1 + e);
  }
  const e = Math.exp(x);
  return e / (1 + e);
}

// ---------------------------------------------------------------------------
// Training — logistic regression with gradient descent + L2
// ---------------------------------------------------------------------------

const DEFAULT_EPOCHS = 250;
const DEFAULT_LR = 0.05;
const DEFAULT_L2 = 0.01;

export interface TrainResult {
  weights: ModelWeights;
  trainAccuracy: number;
}

export function trainQuoteWinModel(
  rows: TrainingRow[],
  opts: { epochs?: number; learningRate?: number; l2?: number } = {},
): TrainResult | null {
  if (rows.length < 20) return null;

  const epochs = opts.epochs ?? DEFAULT_EPOCHS;
  const lr = opts.learningRate ?? DEFAULT_LR;
  const l2 = opts.l2 ?? DEFAULT_L2;

  // 1. Featurize every row into (x, y) pairs.
  const X: Record<FeatureName, number>[] = rows.map(r => featurize(r));
  const y: number[] = rows.map(r => (r.was_accepted ? 1 : 0));

  // 2. Compute feature means/stds for standardization.
  const means = {} as Record<FeatureName, number>;
  const stds = {} as Record<FeatureName, number>;
  for (const f of FEATURE_NAMES) {
    const col = X.map(x => x[f]);
    const mean = col.reduce((s, v) => s + v, 0) / col.length;
    const variance = col.reduce((s, v) => s + (v - mean) ** 2, 0) / col.length;
    means[f] = mean;
    stds[f] = Math.sqrt(variance) || 1;
  }

  // 3. Standardize.
  const Xs = X.map(x => standardize(x, means, stds));

  // 4. Initialize weights.
  const w = {} as Record<FeatureName, number>;
  for (const f of FEATURE_NAMES) w[f] = 0;
  let bias = 0;

  // 5. Gradient descent.
  const n = rows.length;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW = {} as Record<FeatureName, number>;
    for (const f of FEATURE_NAMES) gradW[f] = 0;
    let gradBias = 0;

    for (let i = 0; i < n; i += 1) {
      let z = bias;
      for (const f of FEATURE_NAMES) z += w[f] * Xs[i][f];
      const pred = sigmoid(z);
      const err = pred - y[i];
      gradBias += err;
      for (const f of FEATURE_NAMES) gradW[f] += err * Xs[i][f];
    }

    bias -= lr * (gradBias / n);
    for (const f of FEATURE_NAMES) {
      // L2: shrink weights each step.
      w[f] -= lr * (gradW[f] / n + l2 * w[f]);
    }
  }

  // 6. Train accuracy.
  let correct = 0;
  for (let i = 0; i < n; i += 1) {
    let z = bias;
    for (const f of FEATURE_NAMES) z += w[f] * Xs[i][f];
    const pred = sigmoid(z) >= 0.5 ? 1 : 0;
    if (pred === y[i]) correct += 1;
  }

  return {
    weights: {
      bias,
      weights: w,
      featureMeans: means,
      featureStds: stds,
      nSamples: n,
      trainedAt: new Date().toISOString(),
    },
    trainAccuracy: correct / n,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function scoreQuoteWin(
  input: ScoreInput,
  model: ModelWeights,
): { probability: number; confidence: number } {
  const month = input.month ?? new Date().getMonth() + 1;
  const raw = featurize({
    total_amount: input.amount,
    customer_type: input.customerType ?? null,
    month_num: month,
    contractor_segment: input.contractorSegment ?? null,
  });
  const xs = standardize(raw, model.featureMeans, model.featureStds);

  let z = model.bias;
  for (const f of FEATURE_NAMES) {
    // R208: missing weight → feature contributes 0 to the dot product.
    // Lets us load legacy 5-feature models and score with the 8-feature
    // input without NaN propagation.
    z += (model.weights[f] ?? 0) * xs[f];
  }
  const probability = sigmoid(z);

  // Confidence scales with training set size, saturating near 100 samples.
  const confidence = Math.min(0.95, 0.4 + Math.min(model.nSamples, 100) / 200);

  return { probability, confidence };
}

// ---------------------------------------------------------------------------
// Staleness (7 day retrain trigger)
// ---------------------------------------------------------------------------

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isModelStale(activatedAt: string | null | undefined): boolean {
  if (!activatedAt) return true;
  const age = Date.now() - new Date(activatedAt).getTime();
  return age >= STALE_AFTER_MS;
}

// ---------------------------------------------------------------------------
// Supabase IO — uses the three RPCs from 20260421_quote_win_model.sql
// ---------------------------------------------------------------------------

interface LoadedModel {
  weights: ModelWeights;
  activatedAt: string;
  trainingSamples: number;
  accuracy: number;
  modelVersion: number;
}

export async function fetchTrainingData(
  trade: string,
  country: string,
  months = 12,
): Promise<TrainingRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('get_quote_win_training_data', {
      p_trade: trade,
      p_country: country,
      p_months: months,
    });
    if (error || !Array.isArray(data)) return [];
    return data as TrainingRow[];
  } catch {
    return [];
  }
}

export async function loadActiveModel(
  trade: string,
  country: string,
): Promise<LoadedModel | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_quote_win_model', {
      p_trade: trade,
      p_country: country,
    });
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.model_weights) return null;
    return {
      weights: row.model_weights as ModelWeights,
      activatedAt: String(row.activated_at ?? new Date().toISOString()),
      trainingSamples: Number(row.training_samples ?? 0),
      accuracy: Number(row.accuracy ?? 0),
      modelVersion: Number(row.model_version ?? 1),
    };
  } catch {
    return null;
  }
}

export async function persistModel(
  trade: string,
  country: string,
  weights: ModelWeights,
  trainingSamples: number,
  accuracy: number,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await (supabase.rpc as any)('save_quote_win_model', {
      p_trade: trade,
      p_country: country,
      p_weights: weights,
      p_training_samples: trainingSamples,
      p_accuracy: accuracy,
    });
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public entry point: ensure a fresh model exists, then score
// ---------------------------------------------------------------------------
// Call path during a quote draft:
//   1. Load active model (in-memory cached for 1h).
//   2. If model is missing OR older than 7 days, kick an async retrain in
//      the background (non-blocking) — caller still scores with whatever it
//      has. The retrain persists the new model so the NEXT score call gets
//      the fresh one.
//   3. If no model at all, return null so the caller can fall back to heuristic.

interface CachedEntry {
  model: LoadedModel | null;
  fetchedAt: number;
}
const MEMORY_CACHE = new Map<string, CachedEntry>();
const MEMORY_TTL_MS = 60 * 60 * 1000;
const inFlightRetrain = new Set<string>();

function cacheKey(trade: string, country: string) {
  return `${trade}|${country}`;
}

async function retrainInBackground(trade: string, country: string): Promise<void> {
  const key = cacheKey(trade, country);
  if (inFlightRetrain.has(key)) return;
  inFlightRetrain.add(key);
  try {
    const rows = await fetchTrainingData(trade, country);
    if (rows.length < 20) return; // server already enforces, defensive client check
    const result = trainQuoteWinModel(rows);
    if (!result) return;
    await persistModel(trade, country, result.weights, result.weights.nSamples, result.trainAccuracy);
    // Invalidate cache so the next call loads the fresh model.
    MEMORY_CACHE.delete(key);
  } catch {
    // silent — fallback path stays active
  } finally {
    inFlightRetrain.delete(key);
  }
}

export async function getQuoteWinModel(
  trade: string,
  country: string,
): Promise<LoadedModel | null> {
  const key = cacheKey(trade, country);
  const cached = MEMORY_CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < MEMORY_TTL_MS) {
    if (cached.model && isModelStale(cached.model.activatedAt)) {
      void retrainInBackground(trade, country);
    }
    return cached.model;
  }
  const model = await loadActiveModel(trade, country);
  MEMORY_CACHE.set(key, { model, fetchedAt: Date.now() });
  if (!model || isModelStale(model.activatedAt)) {
    void retrainInBackground(trade, country);
  }
  return model;
}

// Exported for unit tests only.
export const __internal = {
  featurize,
  standardize,
  sigmoid,
  STALE_AFTER_MS,
};
