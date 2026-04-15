// =============================================================================
// BILLING — client wrapper to start Stripe Checkout for tier upgrades
// =============================================================================

import * as WebBrowser from 'expo-web-browser';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type PaidTier = 'advanced' | 'pro' | 'contractor';
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
    await WebBrowser.openAuthSessionAsync(payload.url, 'vasco://billing/success');
    return payload;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
