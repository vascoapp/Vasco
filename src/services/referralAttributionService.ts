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
import { attributeReferral } from './referralService';

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

/**
 * Fire-and-forget: if a pending code exists, attribute it to this userId,
 * then clear the stash regardless of outcome (so retries don't loop).
 * Returns true when the RPC accepted the attribution.
 */
export async function applyPendingReferral(userId: string): Promise<boolean> {
  const code = await getPendingReferral();
  if (!code) return false;
  let ok = false;
  try {
    ok = await attributeReferral(code, userId);
  } catch {
    ok = false;
  }
  await clearPendingReferral();
  return ok;
}

export const __internal = { PENDING_KEY, CODE_REGEX };
