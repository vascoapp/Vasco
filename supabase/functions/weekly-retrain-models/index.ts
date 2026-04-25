// =============================================================================
// WEEKLY RETRAIN MODELS — Supabase Edge Function (R237)
// =============================================================================
// Closes the platform-side learning loop. The client-side
// `quoteWinModelService.retrainInBackground` only fires when a contractor
// opens a stale quote draft — trades with low usage stay frozen forever.
//
// This function walks every (trade, country) cohort that has data, calls
// `get_quote_win_training_data`, fits a logistic regression inline, persists
// via `save_quote_win_model`, and triggers a `compute_weekly_cohort_stats`
// refresh. Runs weekly via cron (Mondays 02:00 UTC).
//
// Inlined LR matches src/services/quoteWinModelService.ts trainQuoteWinModel.
// Any change to the feature set or training logic must update both.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FEATURE_NAMES must match src/services/quoteWinModelService.ts ordering.
const FEATURE_NAMES = [
  'log_amount',
  'month_sin',
  'month_cos',
  'is_residential',
  'is_commercial',
  'is_small_team',
  'is_medium',
  'is_large',
] as const;
type FeatureName = (typeof FEATURE_NAMES)[number];

const DEFAULT_EPOCHS = 200;
const DEFAULT_LR = 0.1;
const DEFAULT_L2 = 0.01;

interface TrainingRow {
  total_amount: number;
  customer_type: string | null;
  month_num: number;
  contractor_segment: string | null;
  line_count: number;
  was_accepted: boolean;
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function featurize(row: Pick<TrainingRow, 'total_amount' | 'customer_type' | 'month_num' | 'contractor_segment'>): Record<FeatureName, number> {
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
    is_large: seg === 'large' ? 1 : 0,
  };
}

function trainOne(rows: TrainingRow[]): { bias: number; weights: Record<FeatureName, number>; means: Record<FeatureName, number>; stds: Record<FeatureName, number>; accuracy: number; n: number } | null {
  if (rows.length < 20) return null;

  const X = rows.map(featurize);
  const y = rows.map((r) => (r.was_accepted ? 1 : 0));

  const means = {} as Record<FeatureName, number>;
  const stds = {} as Record<FeatureName, number>;
  for (const f of FEATURE_NAMES) {
    const col = X.map((x) => x[f]);
    const mean = col.reduce((s, v) => s + v, 0) / col.length;
    const variance = col.reduce((s, v) => s + (v - mean) ** 2, 0) / col.length;
    means[f] = mean;
    stds[f] = Math.sqrt(variance) || 1;
  }

  const Xs = X.map((x) => {
    const out = {} as Record<FeatureName, number>;
    for (const f of FEATURE_NAMES) out[f] = (x[f] - means[f]) / stds[f];
    return out;
  });

  const w = {} as Record<FeatureName, number>;
  for (const f of FEATURE_NAMES) w[f] = 0;
  let bias = 0;
  const n = rows.length;

  for (let epoch = 0; epoch < DEFAULT_EPOCHS; epoch += 1) {
    const gradW = {} as Record<FeatureName, number>;
    for (const f of FEATURE_NAMES) gradW[f] = 0;
    let gradBias = 0;
    for (let i = 0; i < n; i += 1) {
      let z = bias;
      for (const f of FEATURE_NAMES) z += w[f] * Xs[i][f];
      const err = sigmoid(z) - y[i];
      gradBias += err;
      for (const f of FEATURE_NAMES) gradW[f] += err * Xs[i][f];
    }
    bias -= DEFAULT_LR * (gradBias / n);
    for (const f of FEATURE_NAMES) {
      w[f] -= DEFAULT_LR * (gradW[f] / n + DEFAULT_L2 * w[f]);
    }
  }

  let correct = 0;
  for (let i = 0; i < n; i += 1) {
    let z = bias;
    for (const f of FEATURE_NAMES) z += w[f] * Xs[i][f];
    if ((sigmoid(z) >= 0.5 ? 1 : 0) === y[i]) correct += 1;
  }

  return { bias, weights: w, means, stds, accuracy: correct / n, n };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const summary = {
    cohorts_attempted: 0,
    models_trained: 0,
    models_skipped_low_data: 0,
    cohort_stats_refreshed: false,
    errors: [] as string[],
  };

  try {
    // 1. List every (trade, country) cohort with quotes in the last 12 months.
    const { data: cohorts, error: cohortsErr } = await admin
      .from('pricing_intelligence')
      .select('trade, country')
      .gte('quoted_at', new Date(Date.now() - 365 * 86400000).toISOString())
      .not('trade', 'is', null)
      .not('country', 'is', null);

    if (cohortsErr) {
      summary.errors.push(`list cohorts: ${cohortsErr.message}`);
    } else if (cohorts) {
      // Dedupe (trade, country) pairs in JS — Supabase JS lacks GROUP BY.
      const seen = new Set<string>();
      const pairs: Array<{ trade: string; country: string }> = [];
      for (const row of cohorts as Array<{ trade: string | null; country: string | null }>) {
        if (!row.trade || !row.country) continue;
        const key = `${row.trade}|${row.country}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ trade: row.trade, country: row.country });
      }

      summary.cohorts_attempted = pairs.length;

      for (const { trade, country } of pairs) {
        try {
          // R239+: prefer the labeled-pairs table (decouples training from
          // live event schema). Fall back to the raw RPC if pairs table is
          // empty for this cohort — historical bootstrap path.
          let rows: TrainingRow[] = [];
          const { data: pairRows } = await admin
            .from('model_training_pairs')
            .select('features, target')
            .eq('model_name', 'quote_win')
            .eq('trade', trade)
            .eq('country', country)
            .gte('recorded_at', new Date(Date.now() - 365 * 86400000).toISOString())
            .limit(5000);
          if (pairRows && pairRows.length >= 20) {
            rows = (pairRows as Array<{ features: any; target: number }>).map((r) => ({
              total_amount: Number(r.features?.total_amount) || 0,
              customer_type: r.features?.customer_type ?? null,
              month_num: Number(r.features?.month_num) || 1,
              contractor_segment: r.features?.contractor_segment ?? null,
              line_count: Number(r.features?.line_count) || 1,
              was_accepted: r.target === 1,
            }));
          } else {
            const { data: trainingRows, error: trainErr } = await admin.rpc(
              'get_quote_win_training_data',
              { p_trade: trade, p_country: country, p_months: 12 },
            );
            if (trainErr) {
              summary.errors.push(`fetch ${trade}/${country}: ${trainErr.message}`);
              continue;
            }
            rows = (trainingRows ?? []) as TrainingRow[];
          }
          if (rows.length < 20) {
            summary.models_skipped_low_data += 1;
            continue;
          }
          const result = trainOne(rows);
          if (!result) {
            summary.models_skipped_low_data += 1;
            continue;
          }

          const { error: saveErr } = await admin.rpc('save_quote_win_model', {
            p_trade: trade,
            p_country: country,
            p_bias: result.bias,
            p_weights: result.weights,
            p_feature_means: result.means,
            p_feature_stds: result.stds,
            p_n_samples: result.n,
            p_train_accuracy: result.accuracy,
          });
          if (saveErr) {
            summary.errors.push(`save ${trade}/${country}: ${saveErr.message}`);
            continue;
          }
          summary.models_trained += 1;
        } catch (err) {
          summary.errors.push(`train ${trade}/${country}: ${String(err)}`);
        }
      }
    }

    // 2. Refresh cohort_weekly_stats for the current ISO week.
    const { error: cohortStatsErr } = await admin.rpc('compute_weekly_cohort_stats', {
      p_week_key: null,
    });
    if (cohortStatsErr) {
      summary.errors.push(`cohort stats: ${cohortStatsErr.message}`);
    } else {
      summary.cohort_stats_refreshed = true;
    }
  } catch (err) {
    summary.errors.push(`top-level: ${String(err)}`);
  }

  console.log(`weekly-retrain summary in ${Date.now() - startedAt}ms:`, JSON.stringify(summary));

  return new Response(JSON.stringify({ ok: summary.errors.length === 0, ...summary }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
