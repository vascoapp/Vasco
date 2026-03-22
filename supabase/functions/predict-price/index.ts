// =============================================================================
// PREDICT PRICE — Supabase Edge Function
// =============================================================================
// Real-time pricing prediction based on trade-specific historical data.
// Called when contractor creates a quote line item.
//
// Input: { trade, country, jobType, lineDescription, region? }
// Output: { suggestedPrice, confidence, p25, median, p75, sampleSize, similar[] }
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
    const { trade, country, jobType, lineDescription, region } = await req.json();

    if (!trade || !country) {
      return new Response(
        JSON.stringify({ error: 'trade and country are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Get historical pricing data for this trade + job type
    let query = supabase
      .from('pricing_intelligence')
      .select('quoted_unit_price, was_accepted, margin_percent, customer_type, region, season')
      .eq('trade', trade)
      .eq('country', country)
      .gte('quoted_at', new Date(Date.now() - 180 * 86400000).toISOString()) // last 6 months
      .not('quoted_unit_price', 'is', null);

    if (jobType) {
      query = query.eq('job_type', jobType);
    }

    const { data: pricingData, error: pricingError } = await query.limit(500);

    if (pricingError || !pricingData?.length) {
      // No data yet — return defaults
      return new Response(
        JSON.stringify({
          suggestedPrice: null,
          confidence: 0,
          message: 'Nog niet genoeg data — meer offertes maken bouwt je AI op',
          sampleSize: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Compute statistics
    const prices = pricingData.map(d => d.quoted_unit_price).sort((a, b) => a - b);
    const acceptedPrices = pricingData.filter(d => d.was_accepted).map(d => d.quoted_unit_price);
    const n = prices.length;

    const p25 = prices[Math.floor(n * 0.25)];
    const median = prices[Math.floor(n * 0.5)];
    const p75 = prices[Math.floor(n * 0.75)];
    const mean = prices.reduce((s, p) => s + p, 0) / n;

    // Acceptance-weighted price (prices that got accepted are weighted higher)
    const suggestedPrice = acceptedPrices.length > 0
      ? acceptedPrices.reduce((s, p) => s + p, 0) / acceptedPrices.length
      : median;

    // Confidence based on sample size
    const confidence = Math.min(0.95, 0.3 + (n / 100) * 0.65);

    // Acceptance rate
    const acceptanceRate = pricingData.filter(d => d.was_accepted).length / n;

    // Regional adjustment
    let regionalFactor = 1.0;
    if (region) {
      const regionalPrices = pricingData
        .filter(d => d.region === region)
        .map(d => d.quoted_unit_price);
      if (regionalPrices.length >= 3) {
        const regionalMedian = regionalPrices.sort((a, b) => a - b)[Math.floor(regionalPrices.length / 2)];
        regionalFactor = regionalMedian / median;
      }
    }

    // Seasonal adjustment
    const currentSeason = getSeason();
    const seasonalPrices = pricingData
      .filter(d => d.season === currentSeason)
      .map(d => d.quoted_unit_price);
    let seasonalFactor = 1.0;
    if (seasonalPrices.length >= 3) {
      const seasonalMedian = seasonalPrices.sort((a, b) => a - b)[Math.floor(seasonalPrices.length / 2)];
      seasonalFactor = seasonalMedian / median;
    }

    const adjustedPrice = suggestedPrice * regionalFactor * seasonalFactor;

    // 3. Margin insights
    const margins = pricingData
      .filter(d => d.margin_percent != null)
      .map(d => d.margin_percent!);
    const avgMargin = margins.length > 0
      ? margins.reduce((s, m) => s + m, 0) / margins.length
      : null;

    return new Response(
      JSON.stringify({
        suggestedPrice: Math.round(adjustedPrice * 100) / 100,
        confidence: Math.round(confidence * 100) / 100,
        p25: Math.round(p25 * 100) / 100,
        median: Math.round(median * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
        mean: Math.round(mean * 100) / 100,
        sampleSize: n,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        avgMargin: avgMargin ? Math.round(avgMargin * 10) / 10 : null,
        adjustments: {
          regional: Math.round((regionalFactor - 1) * 100),
          seasonal: Math.round((seasonalFactor - 1) * 100),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}
