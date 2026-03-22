// =============================================================================
// PREDICT DURATION — Supabase Edge Function
// =============================================================================
// Predicts job duration based on historical data per trade + job type.
// Called when contractor schedules a job.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { trade, country, jobType, estimatedHours, propertyType, jobComplexity } = await req.json();

    if (!trade || !country) {
      return new Response(
        JSON.stringify({ error: 'trade and country required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let query = supabase
      .from('job_duration_data')
      .select('estimated_hours, actual_hours, duration_ratio, job_complexity, property_type, scope_changes, material_delays')
      .eq('trade', trade)
      .eq('country', country)
      .not('actual_hours', 'is', null)
      .gte('created_at', new Date(Date.now() - 365 * 86400000).toISOString());

    if (jobType) query = query.eq('job_type', jobType);

    const { data, error } = await query.limit(200);

    if (error || !data?.length) {
      return new Response(
        JSON.stringify({
          predictedHours: estimatedHours ?? null,
          adjustmentFactor: 1.0,
          confidence: 0,
          message: 'Nog niet genoeg data',
          sampleSize: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compute duration ratios
    const ratios = data.map(d => d.duration_ratio ?? (d.actual_hours / d.estimated_hours)).filter(r => r > 0 && r < 5);
    ratios.sort((a, b) => a - b);
    const n = ratios.length;

    const medianRatio = ratios[Math.floor(n / 2)];
    const p75Ratio = ratios[Math.floor(n * 0.75)];
    const avgRatio = ratios.reduce((s, r) => s + r, 0) / n;

    // Complexity adjustment
    let complexityFactor = 1.0;
    if (jobComplexity) {
      const complexJobs = data.filter(d => d.job_complexity === jobComplexity);
      if (complexJobs.length >= 3) {
        const complexRatios = complexJobs.map(d => d.duration_ratio ?? (d.actual_hours / d.estimated_hours)).filter(r => r > 0);
        complexityFactor = complexRatios.reduce((s, r) => s + r, 0) / complexRatios.length / avgRatio;
      }
    }

    // Scope change risk
    const scopeChangeRate = data.filter(d => d.scope_changes > 0).length / n;
    const materialDelayRate = data.filter(d => d.material_delays).length / n;

    const adjustmentFactor = medianRatio * complexityFactor;
    const predictedHours = estimatedHours
      ? Math.round(estimatedHours * adjustmentFactor * 10) / 10
      : null;

    const confidence = Math.min(0.95, 0.3 + (n / 50) * 0.65);

    return new Response(
      JSON.stringify({
        predictedHours,
        adjustmentFactor: Math.round(adjustmentFactor * 100) / 100,
        medianRatio: Math.round(medianRatio * 100) / 100,
        p75Ratio: Math.round(p75Ratio * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        sampleSize: n,
        risks: {
          scopeChangeRate: Math.round(scopeChangeRate * 100),
          materialDelayRate: Math.round(materialDelayRate * 100),
        },
        insight: adjustmentFactor > 1.15
          ? `Klussen duren gemiddeld ${Math.round((adjustmentFactor - 1) * 100)}% langer dan geschat`
          : adjustmentFactor < 0.9
            ? `Je schat ruimer in dan nodig — klussen duren gemiddeld ${Math.round((1 - adjustmentFactor) * 100)}% korter`
            : 'Je schattingen zijn accuraat',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
