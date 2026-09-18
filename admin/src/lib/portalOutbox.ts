// The customer portal's local outbox.
//
// Every write the portal makes is from the CUSTOMER's browser, over whatever
// connection they have — often a phone in a half-renovated house. The page
// already told them "Saved on your device — we'll send it when you're back
// online" (`savedLocal`) when a write failed, but nothing kept it and nothing
// ever re-sent it: the decision was gone the moment the tab closed. The
// acknowledgement signature was worse — its result was discarded entirely, so
// a refused RPC still rendered "Signed — thank you!" for a signature that
// existed nowhere.
//
// This is the thing that makes that sentence true. Entries live in
// localStorage, are flushed on mount and on `online`, and are removed only
// once the backend has actually accepted them.
//
// Idempotency: decision submissions upsert on (tracker_id, item_id,
// submitted_by), so replaying one is a no-op. A signature INSERT is not
// idempotent, so we only ever enqueue one when we SAW a failure — never
// speculatively — and drop it after MAX_ATTEMPTS rather than retrying forever.

import type { SupabaseClient } from '@supabase/supabase-js';

const KEY = 'vasco_portal_outbox_v1';
const MAX_ENTRIES = 50;
const MAX_ATTEMPTS = 8;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — a tracker outlives a bad signal, not a month of it

export type OutboxEntry =
  | {
      kind: 'decision';
      id: string;
      at: number;
      attempts: number;
      trackerId: string;
      row: Record<string, unknown>;
    }
  | {
      kind: 'signature';
      id: string;
      at: number;
      attempts: number;
      accessCode: string;
      signerName: string;
      signerRole: string;
      signatureSvg: string;
      userAgent: string | null;
    };

/** localStorage throws in Safari private mode and is absent during SSR. */
function read(): OutboxEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    return (parsed as OutboxEntry[]).filter(
      (e) => e && typeof e === 'object' && typeof e.at === 'number' && e.at > cutoff,
    );
  } catch {
    return [];
  }
}

function write(entries: OutboxEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Newest wins when the cap bites: an old decision was probably re-answered.
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* quota or private mode — the caller still reports the failure honestly */
  }
}

/** Queue a write the backend refused. Returns false if it could not be kept. */
export function enqueue(
  entry: Omit<Extract<OutboxEntry, { kind: 'decision' }>, 'id' | 'at' | 'attempts'>
    | Omit<Extract<OutboxEntry, { kind: 'signature' }>, 'id' | 'at' | 'attempts'>,
): boolean {
  if (typeof window === 'undefined') return false;
  const full = { ...entry, id: `ob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), attempts: 0 } as OutboxEntry;
  const next = [...read(), full];
  write(next);
  // Confirm it survived: a full or blocked localStorage must not be reported
  // as "we'll send it later".
  return read().some((e) => e.id === full.id);
}

export function pending(): number {
  return read().length;
}

/** Is a signature for this access code still waiting to be sent?
 *
 * The portal keeps `signed` in component state only, so after a reload a
 * queued signature left the pad empty and inviting — and the RPC INSERTs
 * unconditionally, so signing again would have put two signature rows on one
 * acknowledgement. */
export function hasPendingSignature(accessCode: string): boolean {
  return read().some((e) => e.kind === 'signature' && e.accessCode === accessCode);
}

async function send(sb: SupabaseClient, entry: OutboxEntry): Promise<boolean> {
  if (entry.kind === 'decision') {
    const { error } = await sb
      .from('decision_submissions')
      .upsert(entry.row, { onConflict: 'tracker_id,item_id,submitted_by' });
    if (error) return false;
    try {
      await sb.rpc('update_tracker_progress', { p_tracker_id: entry.trackerId });
    } catch {
      /* progress is derived; the submission is what matters */
    }
    return true;
  }
  const { error } = await sb.rpc('write_signature_via_portal', {
    p_access_code: entry.accessCode,
    p_signer_name: entry.signerName,
    p_signer_role: entry.signerRole,
    p_signature_svg: entry.signatureSvg,
    p_user_agent: entry.userAgent,
  });
  return !error;
}

export interface FlushResult {
  /** How many queued writes the backend accepted this pass. */
  delivered: number;
  /** Of those, how many were signatures — the caller shows a different banner
   *  for a signature that landed than for one still waiting. */
  signatures: number;
}

/**
 * Try every queued write. Delivered entries are removed; the rest keep their
 * place with one more attempt on the clock.
 */
export async function flush(sb: SupabaseClient | null): Promise<FlushResult> {
  const entries = read();
  if (!sb || entries.length === 0) return { delivered: 0, signatures: 0 };
  const keep: OutboxEntry[] = [];
  let delivered = 0;
  let signatures = 0;
  for (const entry of entries) {
    let ok = false;
    try {
      ok = await send(sb, entry);
    } catch {
      ok = false;
    }
    if (ok) {
      delivered += 1;
      if (entry.kind === 'signature') signatures += 1;
      continue;
    }
    const attempts = entry.attempts + 1;
    // A code that has expired or been revoked will never accept this write;
    // retrying it forever would keep promising a delivery that cannot happen.
    if (attempts < MAX_ATTEMPTS) keep.push({ ...entry, attempts });
  }
  write(keep);
  return { delivered, signatures };
}
