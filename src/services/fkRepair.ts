// =============================================================================
// A FOREIGN KEY THAT CANNOT BE WRITTEN YET IS NOT A FOREIGN KEY THAT IS GONE
// =============================================================================
// Every direct `documents` write in AppState guards its uuid FKs the same way:
//
//     customer_id: isUuid(job.customerId) ? job.customerId : null,
//
// The guard is there for a real reason — a client-minted temp id at a uuid
// column is 22P02, which makes `createDocument` throw, which makes the catch
// queue the same payload, which fails again: the invoice would never persist
// at all. So nulling keeps the document. What it silently costs is the link,
// and NOTHING restores it: `idRemapBus` rewrites in-memory caches, and the
// queue's `idMap` only rewrites rows still IN the queue. A row already
// INSERTed with `customer_id: null` stays that way for good — the invoice for
// a job whose customer was created moments earlier belongs to nobody, on the
// screen, in the ledger, on the PDF and in the e-invoice (verified 2026-09-19).
//
// This module keeps the document AND the link:
//
//   1. `fkOrNull` first asks the persisted temp→real map. When the parent was
//      flushed in an earlier session the real uuid is already known, and the
//      FK is simply correct — no repair needed. This is the common case for
//      anything created offline yesterday and used today.
//   2. When it is still unresolved, the write goes ahead with `null` (exactly
//      as before — the document is what matters most) and `queueFkRepairs`
//      queues ONE update carrying the temp id. `remapPayload` rewrites that
//      value the moment the parent's insert lands, and the update sets the FK
//      on the row that already exists.
//
// If the parent never persists at all, the repair is dropped after the usual
// attempts and we are exactly where we were before — never worse.
import { isTempId, isUuid } from '../lib/idShape';
import { queueWrite, resolveRememberedId } from './offlineWriteQueue';

export interface ResolvedFk {
  /** What to send now: a real uuid, or null when it cannot be written yet. */
  value: string | null;
  /** The temp id to heal later, or null when there is nothing to heal. */
  unresolvedTempId: string | null;
}

/** A uuid passes through; a temp id is looked up; anything else is null. */
export async function fkOrNull(id: unknown): Promise<ResolvedFk> {
  if (isUuid(id)) return { value: id as string, unresolvedTempId: null };
  const remembered = await resolveRememberedId(id);
  if (remembered) return { value: remembered, unresolvedTempId: null };
  // A display name, a seed id (`j-seed-1`) or a synthetic id is not a pending
  // parent — there is nothing that will ever map it, so do not queue a repair
  // that can only fail.
  // `isTempId`, never a local copy of the pattern list: that list has already
  // drifted once (it was missing `lead-`, `lead-rej-` and `worker-`), and a
  // second copy here would be the same bug with two places to miss.
  const pending = isTempId(id) ? (id as string) : null;
  return { value: null, unresolvedTempId: pending };
}

/**
 * Queue one update that fills in whatever `fkOrNull` could not resolve.
 *
 * `documentNumber` is how the flush matches a document (`matchColumn` picks
 * `document_number` for a non-uuid rowId), so this works for a document that
 * is itself still only queued — the insert runs first, this update second.
 */
export async function queueFkRepairs(
  documentNumber: string,
  fks: ReadonlyArray<readonly [column: string, fk: ResolvedFk]>,
): Promise<void> {
  return queueRowFkRepairs('documents', documentNumber, fks);
}

/**
 * The same repair for any table. `rowId` may itself still be a temp id — the
 * flush rewrites it from the same map before sending, so a child queued behind
 * its own parent heals in one pass.
 */
export async function queueRowFkRepairs(
  table: string,
  rowId: string,
  fks: ReadonlyArray<readonly [column: string, fk: ResolvedFk]>,
): Promise<void> {
  const payload: Record<string, string> = {};
  for (const [column, fk] of fks) {
    if (fk.unresolvedTempId) payload[column] = fk.unresolvedTempId;
  }
  if (Object.keys(payload).length === 0) return;
  try {
    await queueWrite({ table, op: 'update', rowId, payload });
  } catch {
    // The link is best-effort; never let it take down the row it belongs to.
  }
}
