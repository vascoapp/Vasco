// =============================================================================
// REFERRAL ATTRIBUTION (R230)
// =============================================================================
// Captures a referral code from the signup deep-link (?ref=CODE), survives
// the email-confirm round trip by stashing in AsyncStorage, and applies it
// by calling the `attribute_referral` RPC once we have a userId.
//
// Flow:
//   1. Signup screen reads URL param → stashPendingReferral(code)
//   2. User submits → supabase.auth.signUp → email confirmation
//   3. Auth callback / first SIGNED_IN event → applyPendingReferral(userId)
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { attributeReferralOutcome } from './referralService';

const PENDING_KEY = '@vasco_pending_referral';
const CODE_REGEX = /^[A-Z2-9]{4,8}$/; // matches the 6-char alphabet from R229 RPC + buffer

/**
 * Normalise + validate a code. Returns null when the input is clearly not
 * a valid referral code (keeps bogus values from landing in storage).
 */
export function normalizeCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.toString().trim().toUpperCase();
  if (!CODE_REGEX.test(clean)) return null;
  return clean;
}

export async function stashPendingReferral(code: string | null | undefined): Promise<string | null> {
  const clean = normalizeCode(code);
  if (!clean) return null;
  try {
    await AsyncStorage.setItem(PENDING_KEY, clean);
  } catch {
    // silent
  }
  return clean;
}

export async function getPendingReferral(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(PENDING_KEY);
    return normalizeCode(v);
  } catch {
    return null;
  }
}

export async function clearPendingReferral(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // silent
  }
}

/** Sign-ins a failed attribution is retried on before the code is dropped. */
const MAX_ATTEMPTS = 5;
const ATTEMPTS_KEY = '@vasco_pending_referral_attempts';

/**
 * If a pending code exists, attribute it to this userId. The stash is cleared
 * once the SERVER has answered (attributed, or rejected as unknown / self /
 * duplicate); a call that never landed (offline, RPC error) keeps it for the
 * next sign-in, up to MAX_ATTEMPTS — it used to be cleared on any outcome, so
 * a signup on a bad connection lost the referrer's credit for good (sweep A6).
 * Returns true when the RPC accepted the attribution.
 */
export async function applyPendingReferral(userId: string): Promise<boolean> {
  const code = await getPendingReferral();
  if (!code) return false;
  const outcome = await attributeReferralOutcome(code, userId);
  if (outcome === 'failed') {
    let attempts = 0;
    try { attempts = Number(await AsyncStorage.getItem(ATTEMPTS_KEY)) || 0; } catch {}
    attempts += 1;
    if (attempts < MAX_ATTEMPTS) {
      try { await AsyncStorage.setItem(ATTEMPTS_KEY, String(attempts)); } catch {}
      return false;
    }
  }
  await clearPendingReferral();
  try { await AsyncStorage.removeItem(ATTEMPTS_KEY); } catch {}
  return outcome === 'attributed';
}

export const __internal = { PENDING_KEY, CODE_REGEX, ATTEMPTS_KEY, MAX_ATTEMPTS };
