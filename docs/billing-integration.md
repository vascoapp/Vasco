# Billing Integration — Credit Redemption

Last updated: 2026-04-25 (R235)

## What this covers

How referral / promo credits (`subscription_credits` table, added in R232) become
actual reductions on a user's Stripe or Mollie subscription charge at renewal.

## Primitives already built

| Layer | File | What it does |
|---|---|---|
| DB | `supabase/migrations/20260424_subscription_credits_rpcs.sql` | `consume_subscription_credits(user_id, max_months)` — row-locked, idempotent consumption via `FOR UPDATE SKIP LOCKED`. Service-role only. |
| App TS | `src/services/subscriptionCreditsService.ts` | `consumeSubscriptionCredits()` + `getCreditsSummary()` + `useCreditsSummary` hook. Safe to call client-side — hard-fails with permission-denied if called with the anon key, returns `[]`. |
| App TS | `src/services/billingCreditRedemption.ts` | `applyCreditsToRenewal(userId, currentRenewalAt)` — composes consume + `addMonths` date math (with day-of-month clamping). For admin / scheduled-function callers. |
| Edge | `supabase/functions/_shared/credit-redemption.ts` | `redeemCredits(supabaseUrl, serviceKey, userId, maxMonths)` — Deno twin. Returns `{monthsApplied, consumed}`. |

Both `billingCreditRedemption.ts` and the Deno `credit-redemption.ts` cap at
**12 months per redemption** (sanity bound) and clamp the floor to 1.

Tests: 21 passing across `subscriptionCreditsService.test.ts` (10) and
`billingCreditRedemption.test.ts` (11) including edge dates (Jan 31 → Feb 28,
Mar 31 → Apr 30), year boundaries, multi-month rows, and maxMonths clamping.

## Status (2026-04-25)

- Option B (DB-extend) **wired into both webhooks** behind `CREDIT_REDEMPTION_ENABLED` env flag. Set to `'true'` on the project's secrets to enable. Idempotency + restore on failure both handled.
- Option A (Stripe coupon) still unwired — see "Option A" section below for the plan when you have live Stripe creds.
- Safety primitives shipped: `webhook_idempotency` table + `restore_subscription_credits` RPC (migration `20260425_credit_redemption_safety.sql`).

## How to flip Option B live

1. Run `supabase db push` (applies the safety migration).
2. Re-deploy `mollie-webhook` and `stripe-webhook` (`supabase functions deploy …`).
3. In Supabase dashboard → Edge Functions → Secrets, add `CREDIT_REDEMPTION_ENABLED = true`.
4. From that moment, every Stripe `customer.subscription.created` / `customer.subscription.updated` event and every Mollie recurring `payment.paid` event consumes available credits and pushes `subscriptions.current_period_ends_at` forward by that many months. The provider still charges full price — credits become "free extra months" on top of the paid period.

To pause: flip the secret to `false` (or delete it). In-flight credits stay consumed; that's fine — the subscription period was already extended.

---

## The integration gap (legacy section, kept for context)

Originally Option B and Option A were both unwired. Option B is now live.
The webhooks (`mollie-webhook`, `stripe-webhook`) currently handle:

- Mollie: `payment.paid` → mark invoice paid (invoice payments, not subscription charges)
- Stripe: `checkout.session.completed` / `customer.subscription.*` → sync `subscriptions` table
- Stripe: `payment_intent.succeeded` → mark invoice paid

None of these redeem credits. Two integration patterns are possible; pick one
when wiring live billing.

---

## Option A — Reduce charge at renewal (Stripe-first, recommended)

Stripe fires `invoice.upcoming` ~1h before finalization. This is the right
place to inject a discount.

**Wire point:** `supabase/functions/stripe-webhook/index.ts`, add branch for
`event.type === 'invoice.upcoming'`.

```ts
import { redeemCredits } from '../_shared/credit-redemption.ts';

if (event.type === 'invoice.upcoming') {
  const invoice = event.data.object;
  const userId = invoice.subscription_details?.metadata?.user_id;
  if (!userId) return ok('no user_id');

  // 1. Peek at available credits (non-consuming) — use get_credits_summary
  //    or go straight to redeemCredits and accept that if we fail to apply
  //    the coupon, we'll need to restore_credits (not yet implemented).
  const { monthsApplied, consumed } = await redeemCredits(
    supabaseUrl, serviceKey, userId, 12,
  );
  if (monthsApplied === 0) return ok('no credits');

  // 2. Create a Stripe Coupon for monthsApplied × subscription_amount
  const amountOff = monthsApplied * monthlyPriceCents(invoice);
  const coupon = await stripe.coupons.create({
    amount_off: amountOff,
    currency: invoice.currency,
    duration: 'once',
    metadata: { source: 'vasco_credits', consumed_ids: consumed.map(c => c.consumedId).join(',') },
  });

  // 3. Apply to the upcoming invoice
  await stripe.invoices.update(invoice.id, { discounts: [{ coupon: coupon.id }] });
}
```

**Required to ship:**

- Stripe API key with `invoices:write` + `coupons:write`
- A `restore_subscription_credits(ids[])` RPC to undo consumption on failure (not yet built — needed for correctness under network flaps between step 1 and step 3)
- `monthlyPriceCents()` helper reading the subscription's price item
- Unit tests against a Stripe test-mode fixture

**Estimated complexity:** 1-2 days once real Stripe test creds exist.

---

## Option B — Extend renewal date in DB (both providers, simpler)

Treat credits as a DB-side period extension. The provider still charges full
price on its schedule; we offset by updating `subscriptions.current_period_ends_at`
and trust our own gating (`subscriptionService.getCurrentTier`) to honour it.

**Wire point:** `supabase/functions/stripe-webhook/index.ts`, add branch for
`event.type === 'customer.subscription.created'` (and
`customer.subscription.updated` when period advances).

```ts
import { redeemCredits } from '../_shared/credit-redemption.ts';

// After the existing subscriptions.upsert block:
if (status === 'active' && currentPeriodEnd) {
  const { monthsApplied } = await redeemCredits(
    supabaseUrl0, supabaseServiceKey0, userId, 12,
  );
  if (monthsApplied > 0) {
    const extended = new Date(currentPeriodEnd);
    extended.setMonth(extended.getMonth() + monthsApplied);
    await adminClient
      .from('subscriptions')
      .update({ current_period_ends_at: extended.toISOString() })
      .eq('user_id', userId);
  }
}
```

**Trade-off:** The user still gets charged by Stripe/Mollie — credits become a
"free extra month" not a "skip this charge." Simpler to ship, worse UX.

---

## Mollie-specific notes

Mollie recurring subscriptions (`https://docs.mollie.com/reference/v2/subscriptions-api/create-subscription`)
don't fire an `invoice.upcoming` equivalent — you'd need to listen for the
`subscription.created` event at setup time and either:

1. Pre-reduce the `amount` by credit months before creating the subscription, or
2. Use Option B (extend period in DB) — which works identically for Mollie.

Option B is the practical path for Mollie regardless.

---

## Where the consume RPC is safely idempotent

`consume_subscription_credits` uses `FOR UPDATE SKIP LOCKED` on credit rows,
so concurrent webhook retries won't double-consume. However, **the primitive
itself doesn't record "this webhook event already ran."** If Stripe retries
`invoice.upcoming`, we'll consume a second batch of credits. Before shipping
Option A or B, add an idempotency table:

```sql
create table if not exists webhook_idempotency (
  provider text not null,
  event_id text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);
```

And gate the handler: `insert … on conflict do nothing returning *` — if zero
rows returned, the event already ran, skip.

---

## Priority / when to ship

This is **not launch-blocking**. The referral program (R229-R233) can ship
with credits accruing but not yet redeemed — contractors will see their
credit balance in the UI (via `useCreditsSummary`), and we can manually
redeem them via an admin tool until the automated wiring lands.

Ship order when ready:
1. `restore_subscription_credits` RPC + `webhook_idempotency` table
2. Option A branch on Stripe (main market)
3. Option B branch on Mollie (EU coverage)
4. Admin dashboard credit-redemption preview (read-only)
