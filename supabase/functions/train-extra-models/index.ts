// =============================================================================
// TRAIN EXTRA MODELS — Supabase Edge Function (R238)
// =============================================================================
// Walks all (user_id) rows in the platform and computes:
//   - cashflow gap forecast (next 30 days)
//   - capacity overrun probability (next 30 days)
//   - supplier lead-time delay probability (per supplier)
//   - material price spike forecasts (per trade × country × material category)
//
// Stored in the four ml_* prediction tables for cheap UI reads.
// Cron: daily 03:00 UTC.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Summary {
  cashflow_users: number;
  capacity_users: number;
  supplier_pairs: number;
  material_categories: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const summary: Summary = { cashflow_users: 0, capacity_users: 0, supplier_pairs: 0, material_categories: 0, errors: [] };
  const startedAt = Date.now();
  const horizonDays = 30;

  try {
    // -----------------------------------------------------------------------
    // 1. Cashflow gap — per user
    // -----------------------------------------------------------------------
    // Simple model: next-30-day expected inflow = sum of unpaid invoices weighted
    // by customer DSO probability of payment within window. Outflow = mean of
    // last 90 days material+labor cost. Gap = outflow - inflow.
    const { data: users, error: usersErr } = await admin
      .from('business_events')
      .select('user_id')
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .not('user_id', 'is', null)
      .limit(5000);

    if (usersErr) {
      summary.errors.push(`list users: ${usersErr.message}`);
    } else if (users) {
      const seen = new Set<string>();
      for (const r of users as Array<{ user_id: string | null }>) {
        if (!r.user_id || seen.has(r.user_id)) continue;
        seen.add(r.user_id);
      }

      for (const userId of seen) {
        try {
          // Inflow estimate
          const { data: invoiceEvents } = await admin
            .from('business_events')
            .select('payload, event_type, created_at')
            .eq('user_id', userId)
            .in('event_type', ['invoice_sent', 'payment_received'])
            .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
            .limit(500);

          const sent = (invoiceEvents ?? []).filter((e: any) => e.event_type === 'invoice_sent');
          const paid = (invoiceEvents ?? []).filter((e: any) => e.event_type === 'payment_received');
          const totalSentEur = sent.reduce((s: number, e: any) => s + (Number(e.payload?.amount) || 0), 0);
          const totalPaidEur = paid.reduce((s: number, e: any) => s + (Number(e.payload?.amount) || 0), 0);
          // Heuristic recovery rate
          const recoveryRate = totalSentEur > 0 ? Math.min(1, totalPaidEur / totalSentEur) : 0.7;
          const last30dSent = sent
            .filter((e: any) => new Date(e.created_at).getTime() > Date.now() - 30 * 86400000)
            .reduce((s: number, e: any) => s + (Number(e.payload?.amount) || 0), 0);
          const expectedInflow = last30dSent * recoveryRate;

          // Outflow estimate from material_price_history + labor cost via job_outcomes
          const { data: materialSpend } = await admin
            .from('material_price_history')
            .select('total_price, observed_at')
            .eq('user_id', userId)
            .gte('observed_at', new Date(Date.now() - 90 * 86400000).toISOString())
            .limit(500);
          const totalMaterialEur = (materialSpend ?? []).reduce((s: number, m: any) => s + (Number(m.total_price) || 0), 0);
          const dailyMaterialBurn = totalMaterialEur / 90;
          const expectedOutflow = dailyMaterialBurn * horizonDays;

          const predictedGap = Math.round((expectedOutflow - expectedInflow) * 100) / 100;
          const dataPoints = (invoiceEvents?.length ?? 0) + (materialSpend?.length ?? 0);
          const confidence = Math.min(0.9, 0.3 + Math.log10(Math.max(1, dataPoints)) * 0.2);

          await admin.from('ml_cashflow_gap_predictions').upsert({
            user_id: userId,
            horizon_days: horizonDays,
            predicted_gap_eur: predictedGap,
            confidence,
            features: { expectedInflow, expectedOutflow, recoveryRate, dataPoints },
            computed_at: new Date().toISOString(),
          });
          summary.cashflow_users += 1;

          // -------------------------------------------------------------------
          // 2. Capacity overrun — per user
          // -------------------------------------------------------------------
          // Probability that the next 30 days of scheduled work exceeds the
          // contractor's historical 30-day completion rate.
          const { data: jobOutcomes } = await admin
            .from('job_outcomes')
            .select('actual_hours, estimated_hours, completed_at')
            .eq('user_id', userId)
            .gte('completed_at', new Date(Date.now() - 180 * 86400000).toISOString())
            .limit(200);

          if (jobOutcomes && jobOutcomes.length >= 5) {
            const ratios = jobOutcomes
              .map((j: any) => {
                const est = Number(j.estimated_hours) || 0;
                const act = Number(j.actual_hours) || 0;
                return est > 0 ? act / est : null;
              })
              .filter((r): r is number => r !== null && Number.isFinite(r) && r > 0 && r < 5);
            if (ratios.length >= 5) {
              const meanRatio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
              const variance = ratios.reduce((s, r) => s + (r - meanRatio) ** 2, 0) / ratios.length;
              const stddev = Math.sqrt(variance);
              // Probability ratio > 1.0 (overrun) using normal approximation
              const z = (1.0 - meanRatio) / Math.max(stddev, 0.05);
              const overrunProb = Math.max(0, Math.min(1, 1 - normCdf(z)));
              const predictedOverrunDays = Math.max(0, (meanRatio - 1) * horizonDays);

              await admin.from('ml_capacity_overrun_predictions').upsert({
                user_id: userId,
                horizon_days: horizonDays,
                overrun_probability: Math.round(overrunProb * 100) / 100,
                predicted_overrun_days: Math.round(predictedOverrunDays * 10) / 10,
                features: { meanRatio, stddev, sampleSize: ratios.length },
                computed_at: new Date().toISOString(),
              });
              summary.capacity_users += 1;
            }
          }
        } catch (err) {
          summary.errors.push(`user ${userId}: ${String(err)}`);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 3. Supplier lead-time predictions — per (user, supplier)
    // -----------------------------------------------------------------------
    // Read recent supplier delays from material_price_history (delivery_days)
    // and predict P(delay > 5 days) as a smoothed historical rate.
    const { data: leadtimeRows } = await admin
      .from('material_price_history')
      .select('user_id, supplier_id, delivery_days, observed_at')
      .gte('observed_at', new Date(Date.now() - 180 * 86400000).toISOString())
      .not('delivery_days', 'is', null)
      .not('supplier_id', 'is', null)
      .limit(20000);

    if (leadtimeRows) {
      const grouped = new Map<string, number[]>();
      for (const r of leadtimeRows as Array<{ user_id: string; supplier_id: string; delivery_days: number }>) {
        const key = `${r.user_id}|${r.supplier_id}`;
        const arr = grouped.get(key) ?? [];
        arr.push(Number(r.delivery_days));
        grouped.set(key, arr);
      }
      for (const [key, days] of grouped) {
        if (days.length < 3) continue;
        const [userId, supplierId] = key.split('|');
        const meanDelay = days.reduce((s, d) => s + d, 0) / days.length;
        const overFive = days.filter((d) => d > 5).length / days.length;
        const confidence = Math.min(0.9, 0.3 + days.length / 50);
        try {
          await admin.from('ml_supplier_leadtime_predictions').upsert({
            user_id: userId,
            supplier_id: supplierId,
            predicted_delay_days: Math.round(meanDelay * 10) / 10,
            delay_probability: Math.round(overFive * 100) / 100,
            confidence,
            computed_at: new Date().toISOString(),
          });
          summary.supplier_pairs += 1;
        } catch (err) {
          summary.errors.push(`leadtime ${key}: ${String(err)}`);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Material price spike forecasts — per (trade, country, category)
    // -----------------------------------------------------------------------
    // Simple AR(1)-ish: compare last-30d median to prior-90d median, project
    // the slope forward. Cohort-level so no PII concerns.
    const { data: priceRows } = await admin
      .from('material_price_history')
      .select('trade, country, material_category, unit_price, observed_at')
      .gte('observed_at', new Date(Date.now() - 180 * 86400000).toISOString())
      .not('material_category', 'is', null)
      .not('trade', 'is', null)
      .not('country', 'is', null)
      .limit(50000);

    if (priceRows) {
      type Row = { trade: string; country: string; material_category: string; unit_price: number; observed_at: string };
      const grouped = new Map<string, Row[]>();
      for (const r of priceRows as Row[]) {
        const key = `${r.trade}|${r.country}|${r.material_category}`;
        const arr = grouped.get(key) ?? [];
        arr.push(r);
        grouped.set(key, arr);
      }
      const now = Date.now();
      for (const [key, rows] of grouped) {
        if (rows.length < 10) continue;
        const recent = rows.filter((r) => new Date(r.observed_at).getTime() > now - 30 * 86400000);
        const prior = rows.filter((r) => {
          const t = new Date(r.observed_at).getTime();
          return t <= now - 30 * 86400000 && t > now - 120 * 86400000;
        });
        if (recent.length < 3 || prior.length < 5) continue;
        const recentMedian = median(recent.map((r) => Number(r.unit_price)));
        const priorMedian = median(prior.map((r) => Number(r.unit_price)));
        if (priorMedian <= 0) continue;
        const pctChange = ((recentMedian - priorMedian) / priorMedian) * 100;
        const projected30d = pctChange * (30 / 30);  // crude projection
        const confidence = Math.min(0.9, 0.3 + Math.log10(rows.length) * 0.2);
        const [trade, country, cat] = key.split('|');
        try {
          await admin.from('ml_material_price_forecasts').upsert({
            trade,
            country,
            material_category: cat,
            forecast_horizon_days: 30,
            predicted_price_change_pct: Math.round(projected30d * 10) / 10,
            confidence,
            observation_count: rows.length,
            computed_at: new Date().toISOString(),
          });
          summary.material_categories += 1;
        } catch (err) {
          summary.errors.push(`price ${key}: ${String(err)}`);
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. Refresh cohort aggregates
    // -----------------------------------------------------------------------
    const { error: refreshErr } = await admin.rpc('refresh_intelligence_aggregates');
    if (refreshErr) summary.errors.push(`refresh: ${refreshErr.message}`);
  } catch (err) {
    summary.errors.push(`top: ${String(err)}`);
  }

  console.log(`train-extra-models in ${Date.now() - startedAt}ms:`, JSON.stringify(summary));
  return new Response(JSON.stringify({ ok: summary.errors.length === 0, ...summary }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Standard normal CDF approximation (Abramowitz & Stegun)
function normCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
