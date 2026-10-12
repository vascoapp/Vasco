// Stripe moved fields between API versions, and a webhook endpoint delivers
// events in the version it was CREATED with (a new endpoint gets the newest).
// Since 2025-03-31 ("basil"):
//   invoice.subscription          → invoice.parent.subscription_details.subscription
//   invoice.subscription_details  → invoice.parent.subscription_details
//   subscription.current_period_end → subscription.items.data[].current_period_end
// Reading only the old field made dunning ("no_subscription") and the renewal
// date silently empty on an endpoint created today. Read both shapes.

type Obj = Record<string, any> | null | undefined;

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof (v as any).id === 'string' ? (v as any).id : null;

export function invoiceSubscriptionId(invoice: Obj): string | null {
  return idOf(invoice?.subscription) ?? idOf(invoice?.parent?.subscription_details?.subscription);
}

export function invoiceSubscriptionMetadata(invoice: Obj): Record<string, string> | null {
  return invoice?.subscription_details?.metadata ?? invoice?.parent?.subscription_details?.metadata ?? null;
}

/** Unix seconds, or null. The latest item period end when the top-level field is gone. */
export function subscriptionPeriodEnd(sub: Obj): number | null {
  if (typeof sub?.current_period_end === 'number') return sub.current_period_end;
  const ends = (sub?.items?.data ?? [])
    .map((it: any) => it?.current_period_end)
    .filter((n: unknown): n is number => typeof n === 'number');
  return ends.length ? Math.max(...ends) : null;
}

/**
 * The tier a subscription row grants. A subscription that has ENDED grants
 * nothing: Stripe sends `customer.subscription.deleted` (status canceled) only
 * when it is really over — at the end of the paid period for a normal
 * cancellation, at once for an immediate one — and `incomplete_expired` means
 * the first payment never happened. The row used to keep `tier: 'pro'` beside
 * `status: 'canceled'`, and the app reads the tier, so a cancelled customer
 * kept Pro for ever (found in the first end-to-end test, 2026-10-12).
 * past_due keeps the tier: that is Stripe's retry window, not the end.
 */
export function entitledTier(status: string, tier: string): string {
  return status === 'canceled' || status === 'expired' ? 'free' : tier;
}
