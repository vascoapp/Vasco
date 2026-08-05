// =============================================================================
// ACCOUNTANT SEAT — publishing, listing and withdrawing an adviser's access
// =============================================================================
// Phase 2 of the collaboration layer. Phase 1 (accountantHandoverService) builds
// the content and hands it over through the share sheet; this gives the adviser
// somewhere that stays put, so they can come back to it during the filing week
// without asking their client to re-send anything.
//
// The seat is a PUBLISHED SNAPSHOT, not a live view — see migration
// 20260806000001 for the two reasons. The short version: per-invoice filing
// state lives in AsyncStorage on this device, so the server could not assemble
// this even if we wanted it to, and a snapshot is the smaller anon surface.
//
// Everything here is contractor-initiated. There is no code path by which an
// accountant writes anything back, and adding one is a bigger decision than it
// looks: an adviser acting on a contractor's behalf needs an audit trail before
// it needs a button.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import type { AccountantHandover } from './accountantHandoverService';

/** Where the adviser's web view lives — same host as the customer portal. */
const PORTAL_HOST = 'https://admin.vascobuild.com';

const HEX = '0123456789abcdef';

/**
 * 32 hex chars / 128 bits, matching the decision-tracker portal's entropy.
 *
 * This code IS the credential — there is no second factor — so it is generated
 * long enough that guessing is not a threat model, and the RPC never returns it.
 */
function generateAccessCode(): string {
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    out += HEX[Math.floor(Math.random() * 16)];
  }
  return out;
}

export interface AccountantSeat {
  id: string;
  label: string;
  accessCode: string;
  url: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  expiresAt: string;
  /** Null until the adviser opens it — the answer to "did they read it?". */
  lastViewedAt: string | null;
  viewCount: number;
}

export interface PublishSeatInput {
  /** Adviser or practice name. Display only — it is how the contractor
   *  recognises which seat to withdraw. */
  label: string;
  businessName: string;
  country: string;
  periodStart: string;
  periodEnd: string;
  handover: AccountantHandover;
}

function rowToSeat(row: any): AccountantSeat {
  return {
    id: row.id,
    label: row.label,
    accessCode: row.access_code,
    url: `${PORTAL_HOST}/accountant/${row.access_code}`,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastViewedAt: row.last_viewed_at ?? null,
    viewCount: row.view_count ?? 0,
  };
}

/**
 * Publish (or refresh) a seat for one adviser.
 *
 * Re-publishing for the same label UPDATES the existing live seat rather than
 * minting a second one. The accountant bookmarked a URL; handing them a new one
 * every quarter guarantees they eventually open a stale link and read the wrong
 * period — which on a filing surface is worse than no link at all. The unique
 * index on (user_id, lower(label)) where revoked_at is null enforces the same
 * rule at the database.
 *
 * Requires a live backend: unlike most writes in this app there is no offline
 * queue, because the contractor is about to send someone a URL and a queued
 * write would produce a link that 404s until the device next syncs.
 */
export async function publishSeat(input: PublishSeatInput): Promise<AccountantSeat> {
  if (!isSupabaseConfigured) {
    throw new Error('offline');
  }

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('not_signed_in');

  const label = input.label.trim();
  if (!label) throw new Error('label_required');

  const base = {
    business_name: input.businessName,
    country: input.country,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    payload: input.handover as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  };

  // Refresh in place when a live seat already exists for this adviser.
  const { data: existing } = await (supabase.from('accountant_handovers') as any)
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .ilike('label', label)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await (supabase.from('accountant_handovers') as any)
      .update(base)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return rowToSeat(data);
  }

  const { data, error } = await (supabase.from('accountant_handovers') as any)
    .insert({
      user_id: userId,
      access_code: generateAccessCode(),
      label,
      ...base,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToSeat(data);
}

/** Live seats, newest first. Revoked ones are gone from the contractor's view. */
export async function listSeats(): Promise<AccountantSeat[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.from('accountant_handovers') as any)
      .select('*')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToSeat);
  } catch (err) {
    logWarn('AccountantSeat', `listSeats failed: ${String(err)}`);
    return [];
  }
}

/**
 * Withdraw a seat.
 *
 * Marks `revoked_at` rather than deleting the row: the contractor gave a third
 * party standing access to their financial records, and "who could see this,
 * between when and when" is a question that should survive the withdrawal. The
 * RPC treats revoked and expired identically, so the link stops working
 * immediately either way.
 */
export async function revokeSeat(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await (supabase.from('accountant_handovers') as any)
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    logWarn('AccountantSeat', `revokeSeat failed: ${String(err)}`);
    return false;
  }
}
