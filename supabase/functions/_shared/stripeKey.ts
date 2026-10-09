/**
 * Vasco's Stripe secret key, whichever name it was stored under.
 *
 * Checkout and the billing portal read STRIPE_SECRET_KEY; the webhook, Stripe
 * Connect and the erasure worker read STRIPE_API_KEY. Setting ONE of them made
 * half of the payment flow fail silently ("Server misconfigured" on checkout,
 * or a webhook that could not call Stripe back). One reader, both names
 * (2026-10-09). A placeholder or empty value is "not set".
 */
export function stripeSecretKey(): string | null {
  for (const name of ['STRIPE_SECRET_KEY', 'STRIPE_API_KEY']) {
    const v = (Deno.env.get(name) ?? '').trim();
    if (v.length >= 20 && /^(sk|rk)_(live|test)_/.test(v)) return v;
  }
  return null;
}

/** Where Stripe sends the customer back. The current site is admin.vascobuild.com
 *  (vascobuild.com still serves an old build until the domain moves). */
export const BILLING_SITE = (Deno.env.get('BILLING_SITE_URL') ?? 'https://admin.vascobuild.com').replace(/\/+$/, '');
