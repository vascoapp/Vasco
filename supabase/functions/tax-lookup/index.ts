// =============================================================================
// TAX-LOOKUP — TaxJar proxy for US sales-tax rates (R82 US Phase 5)
// =============================================================================
// JWT-gated proxy to TaxJar's /v2/rates/{zip} endpoint. Caller (mobile app
// via salesTaxService.getSalesTax) sends `{ zip, state }`; we return
// `{ rate, components, jurisdiction }`.
//
// Why proxy vs. calling TaxJar from the client:
//   1. Hides the API key from the bundle (the entire point of edge fns).
//   2. Lets us cap calls per user — TaxJar bills per request.
//   3. Centralizes the response-shape mapping so we can swap TaxJar →
//      Avalara later without touching every caller.
//
// Required secrets (operator-set):
//   TAXJAR_API_KEY    test_xxx (sandbox) or live key from app.taxjar.com
//
// Deploy:
//   supabase functions deploy tax-lookup
//   supabase secrets set TAXJAR_API_KEY=test_xxx
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TaxJarRatesResponse {
  rate?: {
    zip: string;
    state: string;
    state_rate: string;
    county?: string;
    county_rate?: string;
    city?: string;
    city_rate?: string;
    combined_district_rate?: string;
    combined_rate?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('unauthenticated', 401);
  }

  // JWT check
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnon) return jsonError('server_misconfigured', 500);
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return jsonError('unauthenticated', 401);

  const apiKey = Deno.env.get('TAXJAR_API_KEY');
  if (!apiKey) {
    // No TaxJar account configured — surface explicit "not enabled" so
    // the client knows to fall through to the state-default rate.
    return jsonError('taxjar_not_configured', 503);
  }

  let body: { zip?: string; state?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }
  const { zip, state } = body;
  if (!zip || !/^\d{5}$/.test(zip)) return jsonError('invalid_zip', 400);
  if (state && !/^[A-Z]{2}$/.test(state)) return jsonError('invalid_state', 400);

  try {
    const url = `https://api.taxjar.com/v2/rates/${zip}${state ? `?state=${state}` : ''}`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      console.error('TaxJar non-ok', resp.status);
      return jsonError('taxjar_error', 502, { taxjar_status: resp.status });
    }
    const json = await resp.json() as TaxJarRatesResponse;
    const rate = json.rate;
    if (!rate?.combined_rate) {
      return jsonError('no_rate_returned', 502);
    }

    // Map TaxJar component fields → our breakdown shape. TaxJar returns
    // strings (e.g. "0.06250") so parse + round to avoid float noise.
    const components = {
      state: rate.state_rate ? Number(rate.state_rate) : undefined,
      county: rate.county_rate ? Number(rate.county_rate) : undefined,
      city: rate.city_rate ? Number(rate.city_rate) : undefined,
      special: rate.combined_district_rate ? Number(rate.combined_district_rate) : undefined,
    };
    const jurisdiction = [rate.city, rate.county, rate.state].filter(Boolean).join(' · ');

    return new Response(
      JSON.stringify({
        rate: Number(rate.combined_rate),
        components,
        jurisdiction,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('tax-lookup threw', e);
    return jsonError('network', 502);
  }
});

function jsonError(code: string, status: number, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: code, ...(extra ?? {}) }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
