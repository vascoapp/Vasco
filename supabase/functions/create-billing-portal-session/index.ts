// =============================================================================
// CREATE-BILLING-PORTAL-SESSION — Stripe Customer Portal for self-service
// =============================================================================
// POST /functions/v1/create-billing-portal-session
// Body: {}  (uses authenticated user)
// Returns: { ok: true, url } | { ok: false, error }
//
// The portal lets contractors update payment method, change plan, cancel, and
// download past invoices — without going through support. Stripe hosts it;
// we just generate a signed return URL.
//
// Requires secrets: STRIPE_SECRET_KEY. Optional: STRIPE_PORTAL_RETURN_URL
// (defaults to https://vascobuild.com/billing).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const returnUrl = Deno.env.get('STRIPE_PORTAL_RETURN_URL') ?? 'https://vascobuild.com/billing';

    if (!supabaseUrl || !supabaseAnon || !stripeKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user || !user.email) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up Stripe customer by email. Created automatically by Checkout on
    // first subscription; missing customer means user hasn't subscribed yet.
    const lookup = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const lookupJson = await lookup.json().catch(() => ({}));
    if (!lookup.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: lookupJson?.error?.message ?? 'Stripe lookup failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const customerId: string | undefined = lookupJson?.data?.[0]?.id;
    if (!customerId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No subscription found. Please subscribe first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const form = new URLSearchParams();
    form.set('customer', customerId);
    form.set('return_url', returnUrl);

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const portalJson = await portalRes.json().catch(() => ({}));
    if (!portalRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: portalJson?.error?.message ?? 'Stripe portal error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ ok: true, url: portalJson.url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
