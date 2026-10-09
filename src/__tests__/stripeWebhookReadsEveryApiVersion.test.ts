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
