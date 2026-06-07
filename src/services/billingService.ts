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
// `SKExternalPurchaseLink` Info.plist keys (both declared in app.json).
//
// That API needs a native module that ships only in a custom dev/production
// build (it is absent in Expo Go and in builds made before the entitlement is
// granted). The future native module registers itself on this global; until
// then — and always on Android — we fall back to opening the URL directly,
// which is fully compliant on Android and acceptable for internal/TestFlight
// iOS builds prior to the entitlement landing.
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
