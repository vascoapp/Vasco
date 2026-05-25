// =============================================================================
// BILLING — client wrapper to start Stripe Checkout for tier upgrades
// =============================================================================

import { Linking } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type PaidTier = 'pro' | 'contractor';
export type BillingCycle = 'monthly' | 'yearly';

export interface CheckoutResult {
  ok: boolean;
  url?: string;
  error?: string;
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
    await Linking.openURL(payload.url);
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
    await Linking.openURL(payload.url);
    return payload;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
