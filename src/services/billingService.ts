// =============================================================================
// BILLING — client wrapper to start Stripe Checkout for tier upgrades
// =============================================================================

import { Linking, Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type PaidTier = 'pro' | 'contractor';
export type BillingCycle = 'monthly' | 'yearly';

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  error?: string;
}

// WEB-ONLY BILLING / iOS LINK-OUT (App Store guideline 3.1.1).
// On iOS, subscription checkout must NOT be a raw `Linking.openURL` — Apple
// requires the StoreKit External Purchase Link API (a system disclosure sheet
// shown before leaving the app), gated behind the
// `com.apple.developer.storekit.external-purchase-link` entitlement +
// `SKExternalPurchaseLink` Info.plist keys.
//
// ⚠️ CURRENT STATE (R316): the entitlement was DELIBERATELY REMOVED from
// app.json in `76c5aae` to unblock App Store submission, so `expo.ios.
// entitlements` is empty and there are no SKExternalPurchaseLink* keys. This is
// intentional, not drift — do not "fix" it by re-adding them.
//
// Because no iOS build can take the native path below, the iOS purchase surface
// is instead closed at the UI: `app/contractor/profile.tsx` gates BOTH the
// upgrade block and the Stripe-portal row behind `Platform.OS !== 'ios'` and
// shows a non-tappable note pointing at vascobuild.com. That is what keeps us
// clear of guideline 3.1.1 — NOT this module.
//
// So on iOS the fallback below is currently unreachable from the UI. Keep it
// compliant-by-construction anyway: if you ever surface a purchase CTA on iOS,
// the `Linking.openURL` fallback is a 3.1.1 REJECTION on its own.
//
// To re-enable in-app iOS upgrade later: get Apple's External Purchase Link
// program approved, re-add the entitlement + SKExternalPurchaseLink keys, write
// the native Swift disclosure-sheet module (it registers on the global below),
// then drop the `Platform.OS !== 'ios'` guards in profile.tsx. Runbook:
// docs/go-live-checklist.md §3–§4.
type ExternalPurchaseLinkModule = { open(url: string): Promise<void> };

async function openCheckoutUrl(url: string): Promise<void> {
  if (Platform.OS === 'ios') {
    const native = (globalThis as { __VascoExternalPurchaseLink?: ExternalPurchaseLinkModule })
      .__VascoExternalPurchaseLink;
    if (native?.open) {
      await native.open(url);
      return;
    }
  }
  await Linking.openURL(url);
}

export async function startSubscriptionCheckout(
  tier: PaidTier,
  billingCycle: BillingCycle,
): Promise<CheckoutResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
      body: { tier, billingCycle },
    });
    if (error) return { ok: false, error: error.message };
    const payload = data as CheckoutResult;
    if (!payload?.ok || !payload.url) {
      return { ok: false, error: payload?.error ?? 'No checkout URL returned' };
    }
    await openCheckoutUrl(payload.url);
    return payload;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Opens the Stripe Customer Portal so the contractor can update card, change
// plan, cancel, or download past invoices. EU consumer law requires a
// reachable cancel path; this is it.
export async function startBillingPortal(): Promise<CheckoutResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
      body: {},
    });
    if (error) return { ok: false, error: error.message };
    const payload = data as CheckoutResult;
    if (!payload?.ok || !payload.url) {
      return { ok: false, error: payload?.error ?? 'No portal URL returned' };
    }
    await openCheckoutUrl(payload.url);
    return payload;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
