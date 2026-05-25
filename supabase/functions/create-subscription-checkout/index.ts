// =============================================================================
// CREATE-SUBSCRIPTION-CHECKOUT — Stripe Checkout Session for tier upgrade
// =============================================================================
// POST /functions/v1/create-subscription-checkout
// Body: { tier: 'pro' | 'contractor', billingCycle: 'monthly' | 'yearly' }
// Returns: { ok: true, url } | { ok: false, error }
//
// Requires secrets: STRIPE_SECRET_KEY, plus price IDs per tier × cycle:
//   STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_YEARLY,
//   STRIPE_PRICE_CONTRACTOR_MONTHLY, STRIPE_PRICE_CONTRACTOR_YEARLY
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Tier = 'pro' | 'contractor';
type Cycle = 'monthly' | 'yearly';

function priceId(tier: Tier, cycle: Cycle): string | null {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${cycle.toUpperCase()}`;
  return Deno.env.get(key) ?? null;
}

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
    const successUrl = Deno.env.get('STRIPE_SUCCESS_URL') ?? 'https://vascobuild.com/billing/success';
    const cancelUrl = Deno.env.get('STRIPE_CANCEL_URL') ?? 'https://vascobuild.com/billing/cancel';

    if (!supabaseUrl || !supabaseAnon || !stripeKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tier, billingCycle } = (await req.json()) as { tier: Tier; billingCycle: Cycle };
    if (!['pro', 'contractor'].includes(tier) || !['monthly', 'yearly'].includes(billingCycle)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid tier or billingCycle' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const price = priceId(tier, billingCycle);
    if (!price) {
      return new Response(JSON.stringify({ ok: false, error: `Price ID missing for ${tier}/${billingCycle}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Stripe Checkout Session
    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set('customer_email', user.email ?? '');
    form.set('success_url', successUrl);
    form.set('cancel_url', cancelUrl);
    form.set('line_items[0][price]', price);
    form.set('line_items[0][quantity]', '1');
    form.set('metadata[user_id]', user.id);
    form.set('metadata[tier]', tier);
    form.set('metadata[billing_cycle]', billingCycle);
    form.set('subscription_data[metadata][user_id]', user.id);
    form.set('subscription_data[metadata][tier]', tier);

    // EU VAT compliance. EU SaaS to consumers needs VAT MOSS / OSS — Stripe
    // Tax (enabled in Dashboard → Settings → Tax) computes and remits it. The
    // checkout collects billing address (required to determine VAT
    // jurisdiction) and an optional VAT ID for B2B reverse-charge.
    form.set('automatic_tax[enabled]', 'true');
    form.set('billing_address_collection', 'required');
    form.set('customer_update[address]', 'auto');
    form.set('customer_update[name]', 'auto');
    form.set('tax_id_collection[enabled]', 'true');
    // 14-day trial mirrors the in-app `startTrial` (subscriptionService).
    form.set('subscription_data[trial_period_days]', '14');
    // Allow promotion codes (referral credits, launch promos).
    form.set('allow_promotion_codes', 'true');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const stripeJson = await stripeRes.json().catch(() => ({}));
    if (!stripeRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: stripeJson?.error?.message ?? 'Stripe error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ ok: true, url: stripeJson.url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
