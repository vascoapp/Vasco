// =============================================================================
// TRAIN EXTRA MODELS — Supabase Edge Function (R238)
// =============================================================================
// Walks every active user (paged — see _shared/paging.ts) and computes:
//   - cashflow gap forecast (next 30 days)
//   - capacity overrun probability (next 30 days)
//   - supplier lead-time delay probability (per supplier)
//   - material price spike forecasts (per trade × country × material category)
//
// Stored in the four ml_* prediction tables for cheap UI reads.
// Cron: daily 03:00 UTC.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isServiceRoleCall } from '../_shared/cronAuth.ts';
import { selectAllPages } from '../_shared/paging.ts';

// Markets whose money is EUR. The cash-flow model is in EUR and its inflow
// (business_events.payload.amount) carries no currency, so a contractor
// outside these — or with no known country — gets no prediction rather than
// GBP read as EUR (review 2026-09-28; CLAUDE.md: unknown country SKIPS).
const EUR_COUNTRIES = new Set(['NL', 'DE', 'FR', 'ES', 'IT', 'BE', 'AT', 'IE', 'PT', 'LU', 'FI']);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Summary {
  cashflow_users: number;
  capacity_users: number;
  supplier_pairs: number;
  material_categories: number;
  cashflow_skipped_non_eur: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // Scheduler only (_shared/cronAuth.ts): the anon key ships in the app, and
  // this function fans out to / writes for every contractor.
  if (!isServiceRoleCall(req.headers.get('authorization'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const summary: Summary = { cashflow_users: 0, capacity_users: 0, supplier_pairs: 0, material_categories: 0, cashflow_skipped_non_eur: 0, errors: [] };
  const startedAt = Date.now();
  const horizonDays = 30;

  try {
    // -----------------------------------------------------------------------
    // 1. Cashflow gap — per user
    // -----------------------------------------------------------------------
    // Simple model: next-30-day expected inflow = sum of unpaid invoices weighted
    // by customer DSO probability of payment within window. Outflow = mean of
    // last 90 days material+labor cost. Gap = outflow - inflow.
    // Every active user, paged: `.limit(5000)` returned PostgREST's 1000-row
    // cap of EVENTS, unordered — a sample of whoever happened to come first
    // (sweep C7, 2026-09-25).
    let users: Array<{ user_id: string | null }> | null = null;
    const countryOf = new Map<string, string>();
    try {
      const read = await selectAllPages<{ user_id: string | null }>(() => admin
        .from('business_events')
        .select('id, user_id')
        .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
        .not('user_id', 'is', null));
      if (read.truncated) summary.errors.push('list users: truncated — some users not trained');
      users = read.rows;
      const settings = await selectAllPages<{ user_id: string; country: string | null }>(() => admin
        .from('business_settings')
        .select('id, user_id, country')
        .not('user_id', 'is', null));
      for (const r of settings.rows) if (r.country) countryOf.set(r.user_id, r.country.toUpperCase());
    } catch (err) {
      summary.errors.push(`list users: ${String(err)}`);
    }
    if (users) {
      const seen = new Set<string>();
      for (const r of users as Array<{ user_id: string | null }>) {
        if (!r.user_id || seen.has(r.user_id)) continue;
        seen.add(r.user_id);
      }

      for (const userId of seen) {
        try {
          if (!EUR_COUNTRIES.has(countryOf.get(userId) ?? '')) {
            summary.cashflow_skipped_non_eur += 1;
            // A skipped contractor must not keep an OLD prediction: the pre-fix
            // runs wrote one for everyone, with outflow 0 — "no gap" for all.
            const { error: delErr } = await admin.from('ml_cashflow_gap_predictions').delete().eq('user_id', userId);
            if (delErr) summary.errors.push(`cashflow clear ${userId}: ${delErr.message}`);
          } else {
          // Inflow estimate
          const { rows: invoiceEvents } = await selectAllPages<any>(() => admin
            .from('business_events')
            .select('id, payload, event_type, created_at')
            .eq('user_id', userId)
            .in('event_type', ['invoice_sent', 'payment_received'])
            .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()));

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

          // Outflow: what the contractor actually PAID suppliers — their scanned
          // supplier invoices. This read `material_price_history` (a shared price
          // catalogue with no user_id and no total_price): the query failed on
          // every run, the error was ignored, outflow was 0, and every contractor
          // was told they had no cash-flow gap (sweep C5, 2026-09-25). A read that
          // fails now throws — no prediction beats a wrong one.
          const { rows: supplierInvoices } = await selectAllPages<any>(() => admin
            .from('scanned_invoices')
            .select('id, total, currency, scanned_at')
            .eq('user_id', userId)
            // Money actually owed/paid. A supplier QUOTE is not spent yet, and a
            // delivery note would count the same purchase as its invoice twice.
            .in('document_type', ['invoice', 'receipt'])
            .gte('scanned_at', new Date(Date.now() - 90 * 86400000).toISOString()));
          // The prediction is in EUR; another currency is not summed into it.
          const materialSpend = supplierInvoices.filter((m: any) => !m.currency || m.currency === 'EUR');
          const totalMaterialEur = materialSpend.reduce((s: number, m: any) => s + (Number(m.total) || 0), 0);
          const dailyMaterialBurn = totalMaterialEur / 90;
          const expectedOutflow = dailyMaterialBurn * horizonDays;

          const predictedGap = Math.round((expectedOutflow - expectedInflow) * 100) / 100;
          const dataPoints = invoiceEvents.length + materialSpend.length;
          const confidence = Math.min(0.9, 0.3 + Math.log10(Math.max(1, dataPoints)) * 0.2);

          const { error: gapErr } = await admin.from('ml_cashflow_gap_predictions').upsert({
            user_id: userId,
            horizon_days: horizonDays,
            predicted_gap_eur: predictedGap,
            confidence,
            features: { expectedInflow, expectedOutflow, recoveryRate, dataPoints },
            computed_at: new Date().toISOString(),
          });
          // supabase-js RETURNS errors; the try/catch never saw one, so the
          // summary counted writes that had failed.
          if (gapErr) summary.errors.push(`cashflow ${userId}: ${gapErr.message}`);
          else summary.cashflow_users += 1;
          }

          // -------------------------------------------------------------------
          // 2. Capacity overrun — per user
          // -------------------------------------------------------------------
          // Probability that the next 30 days of scheduled work exceeds the
          // contractor's historical 30-day completion rate.
          const { data: jobOutcomes, error: outcomesErr } = await admin
            .from('job_outcomes')
            .select('actual_hours, estimated_hours, completed_at')
            .eq('user_id', userId)
            .gte('completed_at', new Date(Date.now() - 180 * 86400000).toISOString())
            // The most RECENT 200, not an arbitrary 200.
            .order('completed_at', { ascending: false })
            .limit(200);
          if (outcomesErr) throw new Error(`job_outcomes: ${outcomesErr.message}`);

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

              const { error: capErr } = await admin.from('ml_capacity_overrun_predictions').upsert({
                user_id: userId,
                horizon_days: horizonDays,
                overrun_probability: Math.round(overrunProb * 100) / 100,
                predicted_overrun_days: Math.round(predictedOverrunDays * 10) / 10,
                features: { meanRatio, stddev, sampleSize: ratios.length },
                computed_at: new Date().toISOString(),
              });
              if (capErr) summary.errors.push(`capacity ${userId}: ${capErr.message}`);
              else summary.capacity_users += 1;
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
    // Lead times the contractor recorded on a purchase — dataCollector writes
    // material_price_history.lead_time_days with observed_by = the contractor
    // (the "who" column; there is no user_id). This read user_id/delivery_days,
    // which do not exist, so the section never produced a row (sweep C5).
    // ⚠️ Still EMPTY in practice: no caller passes `deliveryDays` yet, so this
    // section writes nothing until a purchase flow records a lead time.
    let leadtimeRows: Array<{ user_id: string; supplier_id: string; lead_time_days: number }> | null = null;
    try {
      const read = await selectAllPages<{ observed_by: string; supplier_id: string; lead_time_days: number }>(() => admin
        .from('material_price_history')
        .select('id, observed_by, supplier_id, lead_time_days, observed_at')
        .gte('observed_at', new Date(Date.now() - 180 * 86400000).toISOString())
        .not('lead_time_days', 'is', null)
        .not('supplier_id', 'is', null)
        .not('observed_by', 'is', null));
      if (read.truncated) summary.errors.push('leadtime read: truncated');
      leadtimeRows = read.rows.map((r) => ({ user_id: r.observed_by, supplier_id: r.supplier_id, lead_time_days: r.lead_time_days }));
    } catch (err) {
      summary.errors.push(`leadtime read: ${String(err)}`);
    }

    if (leadtimeRows) {
      const grouped = new Map<string, number[]>();
      for (const r of leadtimeRows) {
        const key = `${r.user_id}|${r.supplier_id}`;
        const arr = grouped.get(key) ?? [];
        arr.push(Number(r.lead_time_days));
        grouped.set(key, arr);
      }
      for (const [key, days] of grouped) {
        if (days.length < 3) continue;
        const [userId, supplierId] = key.split('|');
        const meanDelay = days.reduce((s, d) => s + d, 0) / days.length;
        const overFive = days.filter((d) => d > 5).length / days.length;
        const confidence = Math.min(0.9, 0.3 + days.length / 50);
        const { error } = await admin.from('ml_supplier_leadtime_predictions').upsert({
          user_id: userId,
          supplier_id: supplierId,
          predicted_delay_days: Math.round(meanDelay * 10) / 10,
          delay_probability: Math.round(overFive * 100) / 100,
          confidence,
          computed_at: new Date().toISOString(),
        });
        if (error) summary.errors.push(`leadtime ${key}: ${error.message}`);
        else summary.supplier_pairs += 1;
      }
    }

    // -----------------------------------------------------------------------
    // 4. Material price spike forecasts — per (trade, country, category)
    // -----------------------------------------------------------------------
    // Simple AR(1)-ish: compare last-30d median to prior-90d median, project
    // the slope forward. Cohort-level so no PII concerns.
    // `unit_price` does not exist here (it is `price_excl_vat`), and
    // `.limit(50000)` was capped at 1000 rows anyway (sweep C5/C7, 2026-09-25).
    let priceRows: Array<{ trade: string; country: string; material_category: string; price_excl_vat: number; observed_at: string }> | null = null;
    try {
      const read = await selectAllPages<any>(() => admin
        .from('material_price_history')
        .select('id, trade, country, material_category, price_excl_vat, observed_at')
        .gte('observed_at', new Date(Date.now() - 180 * 86400000).toISOString())
        // trade + country are the forecast's PRIMARY KEY: a null one can only
        // ever fail the upsert.
        .not('material_category', 'is', null)
        .not('trade', 'is', null)
        .not('country', 'is', null));
      if (read.truncated) summary.errors.push('price read: truncated');
      priceRows = read.rows;
    } catch (err) {
      summary.errors.push(`price read: ${String(err)}`);
    }

    if (priceRows) {
      type Row = { trade: string; country: string; material_category: string; price_excl_vat: number; observed_at: string };
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
        const recentMedian = median(recent.map((r) => Number(r.price_excl_vat)));
        const priorMedian = median(prior.map((r) => Number(r.price_excl_vat)));
        if (priorMedian <= 0) continue;
        const pctChange = ((recentMedian - priorMedian) / priorMedian) * 100;
        const projected30d = pctChange * (30 / 30);  // crude projection
        const confidence = Math.min(0.9, 0.3 + Math.log10(rows.length) * 0.2);
        const [trade, country, cat] = key.split('|');
        const { error } = await admin.from('ml_material_price_forecasts').upsert({
          trade,
          country,
          material_category: cat,
          forecast_horizon_days: 30,
          predicted_price_change_pct: Math.round(projected30d * 10) / 10,
          confidence,
          observation_count: rows.length,
          computed_at: new Date().toISOString(),
        });
        if (error) summary.errors.push(`price ${key}: ${error.message}`);
        else summary.material_categories += 1;
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
