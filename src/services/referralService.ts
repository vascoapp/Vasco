// =============================================================================
// REFERRAL SERVICE (R229)
// =============================================================================
// Thin wrappers around the three referral RPCs:
//   - get_or_create_referral_code(user_id) — idempotent mint
//   - attribute_referral(code, new_user_id) — fire on signup if code supplied
//   - get_referral_summary(user_id) — admin / profile stats
//
// Client never touches referral_codes / referral_attributions directly —
// RPC is the only path and the RLS policies enforce that.
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ReferralSummary {
  code: string | null;
  totalReferrals: number;
  pendingCount: number;
  activatedCount: number;
  creditedCount: number;
}

export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_or_create_referral_code', {
      p_user_id: userId,
    });
    if (error || !data) return null;
    return String(data);
  } catch {
    return null;
  }
}

/**
 * Attempts to attribute a referral.
 *
 * RPC contract (locked in SCHEMA_LOCK.md v1.0):
 *   - Returns the new attribution row's `uuid` on success
 *   - Returns `null` when: code unknown, self-referral, or already attributed
 *
 * This wrapper coerces the uuid → boolean for the common "did it work?" path.
 * If a caller needs the attribution id (e.g. to store with the user), use
 * `attributeReferralWithId` below.
 */
export async function attributeReferral(code: string, newUserId: string): Promise<boolean> {
  const id = await attributeReferralWithId(code, newUserId);
  return id !== null;
}

export async function attributeReferralWithId(code: string, newUserId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  if (!code || code.length < 4) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('attribute_referral', {
      p_code: code.toUpperCase().trim(),
      p_new_user_id: newUserId,
    });
    if (error || !data) return null;
    return typeof data === 'string' ? data : String(data);
  } catch {
    return null;
  }
}

export async function getReferralSummary(userId: string): Promise<ReferralSummary | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_referral_summary', {
      p_user_id: userId,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      code: row.code ?? null,
      totalReferrals: Number(row.total_referrals ?? 0),
      pendingCount: Number(row.pending_count ?? 0),
      activatedCount: Number(row.activated_count ?? 0),
      creditedCount: Number(row.credited_count ?? 0),
    };
  } catch {
    return null;
  }
}

/** Build the public share URL for a referral code. */
export function buildShareUrl(code: string): string {
  return `https://admin.vascobuild.com/ref/${encodeURIComponent(code)}`;
}

/** React hook — mint code + load summary for the current user. */
export function useReferral(userId: string | null | undefined) {
  const [code, setCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCode(null);
      setSummary(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [c, s] = await Promise.all([
        getOrCreateReferralCode(userId),
        getReferralSummary(userId),
      ]);
      if (cancelled) return;
      setCode(c);
      setSummary(s);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const refresh = async () => {
    if (!userId) return;
    const s = await getReferralSummary(userId);
    setSummary(s);
  };

  return {
    code,
    summary,
    shareUrl: code ? buildShareUrl(code) : null,
    loading,
    refresh,
  };
}

export const __internal = { buildShareUrl };
