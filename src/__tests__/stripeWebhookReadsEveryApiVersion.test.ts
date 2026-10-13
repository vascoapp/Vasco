/**
 * A Stripe webhook endpoint delivers events in the API version it was created
 * with — one created today gets the newest shape, where the invoice's
 * subscription and the subscription's period end have MOVED. The webhook read
 * only the old fields, so on a new endpoint a failed payment was answered
 * "no_subscription" (no past_due banner) and every renewal date was empty.
 */
import fs from 'fs';
import path from 'path';
import {
  billingCycleFrom,
  entitledTier,
  extraSeatsFrom,
  invoiceSubscriptionId,
  invoiceSubscriptionMetadata,
  subscriptionPeriodEnd,
} from '../../supabase/functions/_shared/stripeShapes';

const OLD_INVOICE = { subscription: 'sub_old', subscription_details: { metadata: { user_id: 'u1' } } };
const NEW_INVOICE = {
  parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_new', metadata: { user_id: 'u2' } } },
};

it('finds the subscription of an invoice in the old and the new shape', () => {
  expect(invoiceSubscriptionId(OLD_INVOICE)).toBe('sub_old');
  expect(invoiceSubscriptionId(NEW_INVOICE)).toBe('sub_new');
  expect(invoiceSubscriptionId({ subscription: { id: 'sub_expanded' } })).toBe('sub_expanded');
  expect(invoiceSubscriptionId({})).toBeNull();
  expect(invoiceSubscriptionId(null)).toBeNull();
});

it('finds the subscription metadata in both shapes', () => {
  expect(invoiceSubscriptionMetadata(OLD_INVOICE)?.user_id).toBe('u1');
  expect(invoiceSubscriptionMetadata(NEW_INVOICE)?.user_id).toBe('u2');
  expect(invoiceSubscriptionMetadata({})).toBeNull();
});

it('finds the period end on the subscription or on its items', () => {
  expect(subscriptionPeriodEnd({ current_period_end: 1800000000 })).toBe(1800000000);
  expect(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1800000000 }, { current_period_end: 1800500000 }] } })).toBe(1800500000);
  expect(subscriptionPeriodEnd({ items: { data: [] } })).toBeNull();
  expect(subscriptionPeriodEnd(null)).toBeNull();
});

it('the webhook reads these fields only through the helpers', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/stripe-webhook/index.ts'), 'utf8');
  expect(src).not.toMatch(/\?\.subscription\s*\?\?/);
  expect(src).not.toMatch(/\.subscription_details\?\.metadata/);
  expect(src).not.toMatch(/sub\?\.current_period_end/);
  expect(src).toMatch(/invoiceSubscriptionId\(invoice\)/);
  expect(src).toMatch(/invoiceSubscriptionId\(upcoming\)/);
  expect(src).toMatch(/subscriptionPeriodEnd\(sub\)/);
});

it('an ended subscription grants Free, a live or retrying one keeps its tier', () => {
  expect(entitledTier('canceled', 'pro')).toBe('free');
  expect(entitledTier('expired', 'contractor')).toBe('free');
  expect(entitledTier('trialing', 'pro')).toBe('pro');
  expect(entitledTier('active', 'contractor')).toBe('contractor');
  expect(entitledTier('past_due', 'pro')).toBe('pro');
});

it('the webhook writes the entitled tier, never the checkout tier as-is', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/stripe-webhook/index.ts'), 'utf8');
  const upsert = src.slice(src.indexOf(".from('subscriptions')\n          .upsert("));
  expect(upsert).toMatch(/^[\s\S]{0,200}tier: entitledTier\(status, tier\)/);
});

it('counts extra seats from the seat line items only', () => {
  const SEATS = ['price_seat_m', 'price_seat_y'];
  const sub = (items: any[]) => ({ object: 'subscription', items: { data: items } });
  expect(extraSeatsFrom(sub([{ price: { id: 'price_pro' }, quantity: 1 }]), SEATS)).toBe(0);
  expect(extraSeatsFrom(sub([{ price: 'price_pro', quantity: 1 }, { price: { id: 'price_seat_m' }, quantity: 2 }]), SEATS)).toBe(2);
  expect(extraSeatsFrom(sub([{ price: { id: 'price_seat_y' } }]), SEATS)).toBe(1);
  // A checkout session has no items: "unknown", so the stored value is kept.
  expect(extraSeatsFrom({ object: 'checkout.session' }, SEATS)).toBeNull();
  // No seat prices configured: nothing counts as a seat.
  expect(extraSeatsFrom(sub([{ price: { id: 'price_seat_m' }, quantity: 2 }]), [undefined, ''])).toBe(0);
});

it('the webhook writes extra_seats from the seat prices, zero when ended', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/stripe-webhook/index.ts'), 'utf8');
  expect(src).toMatch(/status === 'canceled' \|\| status === 'expired'\s*\?\s*\{ extra_seats: 0 \}/);
  expect(src).toMatch(/extraSeatsFrom\(sub, \[\s*Deno\.env\.get\('STRIPE_PRICE_SEAT_MONTHLY'\),\s*Deno\.env\.get\('STRIPE_PRICE_SEAT_YEARLY'\)/);
});

it('checkout sells at most 2 extra seats, and only on Pro', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/create-subscription-checkout/index.ts'), 'utf8');
  expect(src).toMatch(/tier === 'pro' \? Math\.min\(2, Math\.max\(0,/);
});

it('the extra-seats pin runs as the caller (SECURITY INVOKER), never as its owner', () => {
  // As SECURITY DEFINER, current_user was postgres for every caller and a user
  // session could write its own seats (live probe, 2026-10-13).
  const dir = path.resolve(__dirname, '../../supabase/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const defs = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '')).filter((sql) => /function public\.subscriptions_pin_extra_seats\(\)/.test(sql));
  const latest = defs[defs.length - 1];
  expect(latest).toMatch(/security invoker/i);
  expect(latest).not.toMatch(/security definer/i);
});

it('reads the billing cycle from the subscription price, not a default', () => {
  const sub = (interval: string) => ({ object: 'subscription', items: { data: [{ price: { recurring: { interval } } }] } });
  expect(billingCycleFrom(sub('year'))).toBe('yearly');
  expect(billingCycleFrom(sub('month'))).toBe('monthly');
  expect(billingCycleFrom({ object: 'checkout.session' })).toBeNull();
  const src = fs.readFileSync(path.resolve(__dirname, '../../supabase/functions/stripe-webhook/index.ts'), 'utf8');
  expect(src).toMatch(/billing_cycle: billingCycleFrom\(sub\)/);
});
