// =============================================================================
// STRIPE-CONNECT — the contractor's Stripe account, through Vasco's platform
// =============================================================================
// Decision 2a (2026-10-09): no more pasting a secret key into the app. The
// contractor connects their Stripe account with Stripe's own sign-in (OAuth,
// Standard accounts); Stripe tells the SERVER the account id, and payment links
// are made here, with Vasco's platform key acting on that account.
//
// Actions (POST { action, ... }, signed-in contractor only):
//   status       → { configured, connected, livemode }
//   start        → { url }  Stripe's consent page; comes back to
//                  stripe-connect-callback with a SIGNED state
//   disconnect   → revokes Vasco's access at Stripe and forgets the account
//   payment-link → { url, id } a payment link on the contractor's account
//
// DARK until the platform exists: without STRIPE_CONNECT_CLIENT_ID (ca_…) and
// STRIPE_API_KEY every action answers `configured: false` / 503 and the app
// keeps the Stripe row hidden. Vasco takes no fee: no application_fee_amount
// (memory/payments-monetization-2026-08.md — never charge for the rails).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { signConnectState } from '../_shared/stripeConnectState.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function present(name: string): string | null {
  const v = (Deno.env.get(name) ?? '').trim();
  return v.length >= 10 && !/^(changeme|todo|xxx|placeholder)/i.test(v) ? v : null;
}

/** Stripe's form encoding, nested keys included (metadata[userId]=…). */
function form(fields: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '') p.append(k, String(v));
  return p.toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing auth' }, 401);
  const auth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return json({ error: 'Invalid session' }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body = status */ }
  const action = typeof body.action === 'string' ? body.action : 'status';

  const platformKey = present('STRIPE_API_KEY');
  const clientId = present('STRIPE_CONNECT_CLIENT_ID');
  const configured = !!(platformKey && clientId && serviceKey);
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: conn } = await admin
    .from('stripe_connections')
    .select('stripe_account_id, livemode')
    .eq('user_id', user.id)
    .maybeSingle();

  if (action === 'status') {
    // Booleans only — the account id stays on the server.
    return json({ configured, connected: configured && !!conn, livemode: !!conn?.livemode });
  }

  if (!configured) return json({ error: 'Stripe Connect is not set up', configured: false }, 503);

  if (action === 'start') {
    const secret = Deno.env.get('STRIPE_CONNECT_STATE_SECRET') ?? serviceKey;
    const { state, nonce, expiresAt } = await signConnectState(user.id, secret);
    // Stored so the callback can use it ONCE (stripe_connect_states).
    const { error: nonceErr } = await admin.from('stripe_connect_states').insert({
      nonce, user_id: user.id, expires_at: new Date(expiresAt).toISOString(),
    });
    if (nonceErr) return json({ error: 'Could not start' }, 500);
    const redirect = `${supabaseUrl}/functions/v1/stripe-connect-callback`;
    const url = 'https://connect.stripe.com/oauth/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      scope: 'read_write',
      redirect_uri: redirect,
      state,
      ...(typeof user.email === 'string' ? { 'stripe_user[email]': user.email } : {}),
    }).toString();
    return json({ url });
  }

  if (action === 'disconnect') {
    if (!conn) return json({ ok: true });
    // Revoke at Stripe first; a failure there must not leave the row claiming
    // a connection we can no longer use either — forget it regardless, and say.
    const res = await fetch('https://connect.stripe.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${platformKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: clientId!, stripe_user_id: conn.stripe_account_id }),
    });
    const { error } = await admin.from('stripe_connections').delete().eq('user_id', user.id);
    if (error) return json({ error: 'Could not disconnect' }, 500);
    return json({ ok: true, revokedAtStripe: res.ok });
  }

  if (action === 'payment-link') {
    if (!conn) return json({ error: 'Stripe is not connected' }, 409);
    const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId.trim() : '';
    const description = typeof body.description === 'string' ? body.description.slice(0, 250) : '';
    const amount = Number(body.amount);
    const currency = typeof body.currency === 'string' ? body.currency.toLowerCase() : '';
    if (!invoiceId || !description || !Number.isFinite(amount) || amount <= 0 || !/^[a-z]{3}$/.test(currency)) {
      return json({ error: 'Invalid payment request' }, 400);
    }
    const methods = Array.isArray(body.paymentMethods) ? body.paymentMethods.filter((m): m is string => typeof m === 'string') : [];
    const fields: Record<string, string | number | undefined> = {
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': description,
      'line_items[0][price_data][unit_amount]': Math.round(amount * 100),
      'line_items[0][quantity]': 1,
      // The webhook matches the document NUMBER per contractor (invoiceRef.ts).
      // userId comes from the SESSION, never the request body.
      'metadata[invoiceId]': invoiceId,
      'metadata[userId]': user.id,
      'payment_intent_data[metadata][invoiceId]': invoiceId,
      'payment_intent_data[metadata][userId]': user.id,
    };
    methods.forEach((m, i) => { fields[`payment_method_types[${i}]`] = m; });
    // A customer-decision deposit: the webhook matches the tracker by this code,
    // scoped to the account's owner. Shape-checked — it is caller input.
    const tracker = typeof body.trackerAccessCode === 'string' ? body.trackerAccessCode.trim() : '';
    if (tracker) {
      if (!/^[A-Za-z0-9_-]{4,64}$/.test(tracker)) return json({ error: 'Invalid payment request' }, 400);
      fields['metadata[trackerAccessCode]'] = tracker;
      fields['payment_intent_data[metadata][trackerAccessCode]'] = tracker;
    }
    const res = await fetch('https://api.stripe.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${platformKey}`,
        'Stripe-Account': conn.stripe_account_id,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form(fields),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !out?.url) {
      console.error(`stripe-connect payment-link ${res.status}: ${out?.error?.message ?? 'no body'}`);
      return json({ error: 'Stripe refused the payment link' }, 502);
    }
    return json({ url: out.url, id: out.id });
  }

  return json({ error: 'Unknown action' }, 400);
});
