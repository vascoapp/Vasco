// =============================================================================
// STRIPE-CONNECT-CALLBACK — where Stripe sends the contractor back (decision 2a)
// =============================================================================
// Deployed --no-verify-jwt: it is a browser redirect from Stripe and carries no
// Vasco session. The ONLY proof of who is connecting is the signed, expiring
// `state` that stripe-connect issued to a signed-in contractor
// (_shared/stripeConnectState.ts). Without a valid state nothing is written.
//
// Then: the code is exchanged at Stripe for the account id (with Vasco's
// platform key — the contractor never sees a key), stored in
// stripe_connections, and the browser is sent back into the app
// (vasco://stripe-connected?status=…), which closes the in-app browser.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyConnectState } from '../_shared/stripeConnectState.ts';

const APP_RETURN = 'vasco://stripe-connected';

/** Back into the app; the status is a fixed word, never Stripe's text. */
const back = (status: 'connected' | 'cancelled' | 'failed' | 'taken') =>
  new Response(null, { status: 302, headers: { Location: `${APP_RETURN}?status=${status}`, 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const platformKey = (Deno.env.get('STRIPE_API_KEY') ?? '').trim();
  const secret = Deno.env.get('STRIPE_CONNECT_STATE_SECRET') ?? serviceKey;

  const verified = await verifyConnectState(url.searchParams.get('state'), secret);
  if (!verified) return back('failed');
  const userId = verified.userId;
  if (!serviceKey) return back('failed');
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
  // SINGLE USE: consume the nonce stripe-connect stored for THIS user. A
  // second use of the same link, or a state for another user, finds nothing.
  const { data: consumed, error: nonceErr } = await admin
    .from('stripe_connect_states')
    .delete()
    .eq('nonce', verified.nonce)
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .select('nonce');
  // Old, unused states go too (best effort). `.then` — a query builder that is
  // never awaited or then'd is never SENT.
  admin.from('stripe_connect_states').delete().lt('expires_at', new Date().toISOString()).then(() => {}, () => {});
  if (nonceErr || !consumed || consumed.length !== 1) return back('failed');
  // The contractor pressed "back" / declined on Stripe's page.
  if (url.searchParams.get('error')) return back('cancelled');
  const code = url.searchParams.get('code');
  if (!code || !platformKey) return back('failed');

  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Bearer ${platformKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }).toString(),
  });
  const tok = await res.json().catch(() => null);
  const accountId = typeof tok?.stripe_user_id === 'string' ? tok.stripe_user_id : '';
  if (!res.ok || !/^acct_[A-Za-z0-9]+$/.test(accountId)) {
    console.error(`stripe-connect-callback token ${res.status}: ${tok?.error ?? 'no account'}`);
    return back('failed');
  }

  const { error } = await admin.from('stripe_connections').upsert({
    user_id: userId,
    stripe_account_id: accountId,
    livemode: tok.livemode === true,
    scope: typeof tok.scope === 'string' ? tok.scope : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) {
    // 23505: this Stripe account is already connected to ANOTHER Vasco account.
    // Never move it silently — payments would start marking the other
    // account's invoices.
    if ((error as { code?: string }).code === '23505') return back('taken');
    console.error('stripe-connect-callback upsert:', error.message);
    return back('failed');
  }
  return back('connected');
});
