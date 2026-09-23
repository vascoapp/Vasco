// =============================================================================
// OFFLINE WRITE QUEUE
// =============================================================================
// Contractors work in basements and on sites with zero signal. Writes that
// fail mid-action are queued to AsyncStorage and flushed on the next
// network-up / app-foreground event. Best-effort — if a write still fails
// after the retry window, it's dropped and logged.
//
// Usage:
//   await queueWrite({ table: 'invoices', op: 'update', id, payload });
//   // later, automatically: flushQueue() runs on foreground
//
// R49: temp IDs (`c-{ts}`, `j-{ts}`, etc.) are stripped on flush so BE
// generates a fresh uuid via the column default. But child rows queued
// behind the parent reference the parent's temp id as a FK — flushing
// them blindly would fail the FK constraint. So flushQueue now captures
// the BE-generated id from each insert and rewrites subsequent queued
// rows that reference the temp id (rowId / match keys / payload values).
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import { emitIdRemap } from './idRemapBus';
import { registerSingletonReset } from './singletonReset';
import { emitDocNumberRemap } from './docNumberRemapBus';
// R59: temp-id helpers moved to src/lib/idShape.ts so other modules
// (moat emit gates, AppState refresh, etc.) share one source of truth.
import { isTempId, isUuid } from '../lib/idShape';
import { isOfflineMintedDocNumber } from '../lib/dataProvider';
import { deviceDataBelongsTo } from './sessionCleanup';
import { getAuthedUserId } from '../lib/currentUser';

const QUEUE_KEY = '@vasco_offline_writes';
// Raised from 200 (sweep 2026-09-23): trimming the OLDEST evicts parent
// inserts first, orphaning every child write queued after them.
const MAX_QUEUE = 1000;
// 30 days (was 7): a contractor on a remote site, or a phone left in a van,
// must not lose a week-old mark-paid on the day it finally syncs.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type WriteOp = 'insert' | 'update' | 'delete' | 'upsert';

export interface QueuedWrite {
  id: string;
  table: string;
  op: WriteOp;
  rowId?: string;     // primary key value (for update/delete/upsert)
  match?: Record<string, any>;  // alternative match criteria (e.g. {user_id, device_id})
  payload?: any;
  createdAt: number;
  attempts: number;
}

async function loadQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedWrite[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {}
}

/**
 * Every read-modify-write of the queue key runs through this chain. Two
 * concurrent queueWrite calls each loaded the queue, pushed, and saved — the
 * second save erased the first write (sweep 2026-09-23, A2).
 */
let storeLock: Promise<unknown> = Promise.resolve();
function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = storeLock.then(fn, fn);
  storeLock = run.catch(() => {});
  return run;
}

/** Add a write to the queue. Safe to call from any write path. */
export async function queueWrite(entry: Omit<QueuedWrite, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
  await withStoreLock(async () => {
    const queue = await loadQueue();
    queue.push({
      ...entry,
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      attempts: 0,
    });
    await saveQueue(queue);
  });
}

// R277/R59: temp IDs (c-{ts}, j-{ts}, mat-{ts}, sup-{ts}, jm-{ts},
// proj-{ts}, q-{ts}, inv-{ts}) are generated client-side for optimistic UI
// updates. They must NEVER be sent to BE — Postgres rejects them as
// non-uuid. Strip on flush so the BE generates a fresh uuid via the column
// default. Pattern definitions live in `src/lib/idShape.ts` (R59 hoist).

// Which column a queued update/delete matches on. AppState queues `documents`
// update/deletes keyed by document_number (markInvoicePaid/markQuoteSent/…),
// NOT the uuid id. The flush previously hardcoded `.eq('id', rowId)`, so those
// matched 0 rows, returned no error → treated as "processed" and DROPPED — an
// offline mark-paid silently reverted on next cold start. Mirror
// dataProvider.documentMatchColumn: documents match by document_number unless
// rowId is a uuid; all other tables match by id.
function matchColumn(table: string, rowId: string): string {
  if (table === 'documents' && !isUuid(rowId)) return 'document_number';
  return 'id';
}

function stripTempId<T extends Record<string, any> | unknown>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const obj = payload as Record<string, any>;
  if ('id' in obj && isTempId(obj.id)) {
    const { id: _omit, ...rest } = obj;
    return rest as T;
  }
  return payload;
}

/**
 * Temp→real ids this device has already learned, kept across launches.
 *
 * ⚠️ `flushQueue`'s own `idMap` is built ONLY from inserts flushed in the same
 * pass. When the PARENT was created while online — its temp id swapped locally,
 * nothing queued — and a CHILD write queued later carries that temp id in its
 * payload, the flush has no mapping for it and sends `proj-1789…` at a uuid
 * column: rejected (22P02), retried, and the link is lost (sweep 2026-09-18).
 *
 * Every mutator that swaps a temp id for a real one records it here, so the
 * queue can rewrite the payload whenever the child finally goes out. Bounded
 * and account-scoped: an id map is one contractor's, and it must not outlive
 * their session (#344).
 */
const REMAP_KEY = '@vasco_id_remap_v1';
const REMAP_MAX = 500;

export async function rememberIdRemap(tempId: string, realId: string): Promise<void> {
  if (!tempId || !realId || tempId === realId) return;
  try {
    const raw = await AsyncStorage.getItem(REMAP_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[tempId] = realId;
    const keys = Object.keys(map);
    if (keys.length > REMAP_MAX) {
      // Oldest-first: the object preserves insertion order for string keys.
      for (const k of keys.slice(0, keys.length - REMAP_MAX)) delete map[k];
    }
    await AsyncStorage.setItem(REMAP_KEY, JSON.stringify(map));
  } catch {
    // Non-fatal: the in-pass map still covers the common case.
  }
}

/**
 * The real id this device has already learned for a temp id, or null.
 *
 * A direct-to-backend write cannot send `c-1789…` at a uuid column, but the
 * parent may well have been persisted in an EARLIER session — in which case
 * the mapping is on disk and the FK is recoverable instead of being nulled.
 */
export async function resolveRememberedId(id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id || !isTempId(id)) return null;
  try {
    const map = await loadRememberedRemaps();
    const real = map.get(id);
    return real && isUuid(real) ? real : null;
  } catch {
    return null;
  }
}

async function loadRememberedRemaps(): Promise<Map<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(REMAP_KEY);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
  } catch {
    return new Map();
  }
}

registerSingletonReset(() => {
  // The map belongs to the account that just left.
  void AsyncStorage.removeItem(REMAP_KEY).catch(() => {});
});

// R49: ID-mapping helpers.
function remapValue(v: unknown, idMap: Map<string, string>): unknown {
  if (typeof v !== 'string') return v;
  const mapped = idMap.get(v);
  return mapped !== undefined ? mapped : v;
}

function remapPayload<T>(payload: T, idMap: Map<string, string>): T {
  if (!payload || typeof payload !== 'object' || idMap.size === 0) return payload;
  if (Array.isArray(payload)) {
    return payload.map((p) => remapPayload(p, idMap)) as unknown as T;
  }
  const obj = payload as Record<string, any>;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string'
      ? remapValue(v, idMap)
      : (v && typeof v === 'object' ? remapPayload(v, idMap) : v);
  }
  return out as T;
}

function remapEntry(entry: QueuedWrite, idMap: Map<string, string>): QueuedWrite {
  if (idMap.size === 0) return entry;
  const remappedRowId =
    typeof entry.rowId === 'string' ? (idMap.get(entry.rowId) ?? entry.rowId) : entry.rowId;
  const remappedMatch = entry.match
    ? Object.fromEntries(Object.entries(entry.match).map(([k, v]) => [k, remapValue(v, idMap)]))
    : entry.match;
  return {
    ...entry,
    rowId: remappedRowId,
    match: remappedMatch,
    payload: remapPayload(entry.payload, idMap),
  };
}

interface ApplyResult {
  ok: boolean;
  /**
   * The write did not reach the server (offline, timeout, 5xx) — it was not
   * REJECTED. Such a failure must not count toward giving up: the flush runs
   * on every foreground with no connectivity check, so five app switches in
   * a basement discarded an offline mark-paid (sweep 2026-09-23, A2).
   */
  transient?: boolean;
  /** When set, the BE generated a new id for an insert that had a temp id. */
  mapping?: { temp: string; real: string };
  /**
   * When set, an offline-minted placeholder document number was replaced by a
   * real one at insert time. Later entries in the SAME queue still address the
   * document by its placeholder (`rowId`, `match.document_number`), and an
   * `.eq()` on a number that no longer exists updates nothing and reports no
   * error — a silent no-op. Folding this into the id map rewrites them.
   */
  docNumber?: { placeholder: string; real: string };
}

/**
 * A PostgREST rejection carries a code (PGRST204, 23505, 42501 …). A request
 * that never got an answer — offline, DNS, timeout, 5xx gateway — has none, or
 * says so in its message. Only a rejection may count toward giving up.
 */
function failed(error: any): ApplyResult {
  const code = String(error?.code ?? '');
  const msg = String(error?.message ?? error ?? '');
  const transient = !code || /network|fetch|timed? ?out|timeout|abort|offline|ECONN|ENOTFOUND|5\d\d/i.test(msg);
  return { ok: false, transient };
}

async function applyWrite(entry: QueuedWrite, idMap: Map<string, string>, pendingInsertIds: Set<string> = new Set()): Promise<ApplyResult> {
  // Rewrite FK references using accumulated id mappings before sending.
  const remapped = remapEntry(entry, idMap);
  const table = supabase.from(remapped.table as any) as any;

  // Drop entries that still reference a temp rowId for update/delete —
  // either no mapping was captured (parent insert never succeeded) or BE
  // never persisted the original create. Updating by temp id would fail
  // with no rows matched. Drop quietly; local state is the source of
  // truth until the next reconnect-create.
  if ((remapped.op === 'update' || remapped.op === 'delete') && isTempId(remapped.rowId)) {
    // Its parent insert is still QUEUED (it failed only for want of a network
    // this pass): keep the edit for the pass that lands the parent. Dropping it
    // here lost the edit whenever the parent had to wait (sweep 2026-09-23).
    if (pendingInsertIds.has(remapped.rowId as string)) return { ok: false, transient: true };
    return { ok: true }; // no parent will ever land — leave the queue
  }

  let mintedDocNumber: { placeholder: string; real: string } | undefined;
  try {
    if (remapped.op === 'insert') {
      const tempId = (remapped.payload && typeof remapped.payload === 'object'
        ? (remapped.payload as Record<string, any>).id
        : undefined) as string | undefined;
      let stripped = stripTempId(remapped.payload);

      // R66r62: documents insert with offline-minted document_number.
      // Swap Q-OFF-XXXXXX / I-OFF-XXXXXX for a fresh canonical number
      // before insert, then emit on docNumberRemapBus so AppState row
      // updates its displayed number. The BE RPC is the only source of
      // truth for sequential numbering — no 23505 collision possible.
      if (
        remapped.table === 'documents' &&
        stripped &&
        typeof stripped === 'object'
      ) {
        const placeholderNum = (stripped as Record<string, any>).document_number;
        const docType = (stripped as Record<string, any>).doc_type;
        if (
          typeof placeholderNum === 'string' &&
          isOfflineMintedDocNumber(placeholderNum) &&
          (docType === 'quote' || docType === 'invoice')
        ) {
          try {
            const rpcResult = await supabase.rpc(
              'next_document_number',
              { p_doc_type: docType } as any,
            ) as { data: unknown; error: unknown };
            const realNum = rpcResult.data;
            if (!rpcResult.error && typeof realNum === 'string' && realNum.length > 0) {
              stripped = { ...(stripped as Record<string, any>), document_number: realNum };
              mintedDocNumber = { placeholder: placeholderNum, real: realNum };
              emitDocNumberRemap({
                docType,
                placeholderNumber: placeholderNum,
                realNumber: realNum,
              });
            }
            // If RPC fails, fall through with the placeholder — likely BE
            // rejects with 23505 or check-constraint, which surfaces as
            // !ok and the entry stays queued for the next flush. Not silent.
          } catch {
            // Same fall-through — keep placeholder, let insert error out.
          }
        }
      }

      if (typeof tempId === 'string' && isTempId(tempId)) {
        // R49: capture BE-generated id so child rows can rewrite their FKs.
        const { data, error } = await table.insert(stripped).select('id').single();
        if (error) return failed(error);
        const realId = (data as any)?.id;
        if (typeof realId === 'string' && realId.length > 0) {
          return { ok: true, mapping: { temp: tempId, real: realId }, docNumber: mintedDocNumber };
        }
        return { ok: true, docNumber: mintedDocNumber };
      }
      const { error } = await table.insert(stripped);
      if (error) return failed(error);
      return { ok: true, docNumber: mintedDocNumber };
    }
    if (remapped.op === 'upsert') {
      const { error } = await table.upsert(stripTempId(remapped.payload));
      return error ? failed(error) : { ok: true };
    }
    if (remapped.op === 'update') {
      let q = table.update(stripTempId(remapped.payload));
      if (remapped.rowId) q = q.eq(matchColumn(remapped.table, remapped.rowId), remapped.rowId);
      if (remapped.match) for (const [k, v] of Object.entries(remapped.match)) q = q.eq(k, v);
      const { error } = await q;
      return error ? failed(error) : { ok: true };
    }
    if (remapped.op === 'delete') {
      let q = table.delete();
      if (remapped.rowId) q = q.eq(matchColumn(remapped.table, remapped.rowId), remapped.rowId);
      if (remapped.match) for (const [k, v] of Object.entries(remapped.match)) q = q.eq(k, v);
      const { error } = await q;
      return error ? failed(error) : { ok: true };
    }
    return { ok: false };
  } catch (err) {
    // A throw here is the network (fetch rejected), not a server verdict.
    return failed(err);
  }
}

/**
 * Flush queued writes. Removes what landed and what the server REJECTED five
 * times; keeps everything that merely could not reach it.
 *
 * Three ways this lost data (sweep 2026-09-23, A2):
 *   - offline foregrounds counted as attempts, so five app switches with no
 *     signal discarded the write;
 *   - it saved its survivors over the queue at the end, erasing every write
 *     queued WHILE it ran (a long flush of network calls);
 *   - two flushes (foreground + a mutation) could run at once.
 */
let flushInFlight: Promise<{ processed: number; dropped: number }> | null = null;

export function flushQueue(): Promise<{ processed: number; dropped: number }> {
  if (!isSupabaseConfigured) return Promise.resolve({ processed: 0, dropped: 0 });
  if (flushInFlight) return flushInFlight;
  flushInFlight = runFlush().finally(() => { flushInFlight = null; });
  return flushInFlight;
}

async function runFlush(): Promise<{ processed: number; dropped: number }> {
  const queue = await loadQueue();
  if (queue.length === 0) return { processed: 0, dropped: 0 };
  // The queue survives logout now (A4). Never send one contractor's unsynced
  // writes under ANOTHER contractor's session — wait for the owner check.
  if (!(await deviceDataBelongsTo(getAuthedUserId()))) return { processed: 0, dropped: 0 };

  const now = Date.now();
  const survivors: QueuedWrite[] = [];
  // Seeded with what earlier sessions learned, then extended by this pass.
  const idMap = await loadRememberedRemaps();
  let processed = 0;
  let dropped = 0;
  // Temp ids whose INSERT is still waiting: a child edit of one of them is
  // kept, not dropped as "no parent will ever land".
  const pendingInsertIds = new Set<string>();

  for (const entry of queue) {
    if (now - entry.createdAt > MAX_AGE_MS) {
      dropped += 1;
      logWarn('offlineWriteQueue', `Dropping stale write after ${Math.round((now - entry.createdAt) / 86400000)}d: ${entry.table}.${entry.op}`);
      continue;
    }
    const result = await applyWrite(entry, idMap, pendingInsertIds);
    if (result.ok) {
      if (result.docNumber) {
        // Same map, same mechanism: every later entry that still names the
        // placeholder — rowId, match or payload — is rewritten to the number
        // the database actually assigned.
        idMap.set(result.docNumber.placeholder, result.docNumber.real);
      }
      if (result.mapping) {
        idMap.set(result.mapping.temp, result.mapping.real);
        void rememberIdRemap(result.mapping.temp, result.mapping.real);
        // R54: notify listeners (ontology, semanticSearch, embeddingService)
        // so they can re-key any side-effect rows they wrote under the
        // temp id. Pass the original payload so listeners can derive
        // embedding text / entity attributes without a BE round-trip.
        emitIdRemap({
          table: entry.table,
          tempId: result.mapping.temp,
          realId: result.mapping.real,
          payload: entry.payload,
        });
      }
      processed += 1;
      continue;
    }
    if (entry.op === 'insert' && isTempId(entry.payload?.id)) pendingInsertIds.add(entry.payload.id);
    if (result.transient) {
      // Never reached the server — not the write's fault. Keep, uncounted.
      survivors.push(entry);
      continue;
    }
    entry.attempts += 1;
    if (entry.attempts >= 5) {
      dropped += 1;
      logWarn('offlineWriteQueue', `Giving up on ${entry.table}.${entry.op} after 5 rejections`);
    } else {
      survivors.push(entry);
    }
  }

  // Merge, don't overwrite: anything queued while this flush was on the
  // network is still in storage and must survive the save.
  await withStoreLock(async () => {
    const seen = new Set(queue.map((e) => e.id));
    const arrived = (await loadQueue()).filter((e) => !seen.has(e.id));
    await saveQueue([...survivors, ...arrived]);
  });
  return { processed, dropped };
}

export async function queueSize(): Promise<number> {
  return (await loadQueue()).length;
}

/**
 * Run a BE write with offline-queue fallback. R277.
 *
 * Use as a one-line replacement for `await fn().catch(err => logWarn(...))`
 * at AppState mutation sites:
 *   await persistOrQueue('jobs', 'update', () => dbUpdateJob(id, updates), { rowId: id, payload: updates });
 *
 * If the BE call throws, we enqueue and return false. Caller can ignore the
 * return — local state is already updated optimistically.
 *
 * R56: when `fallback.rowId` is a temp id (parent insert hasn't yet
 * flushed), skip the BE round-trip — it would fail with a no-rows-matched
 * error since the BE row doesn't exist yet. Queue directly so R49's
 * temp→real rewriter resolves the rowId on flush, after the parent
 * insert lands. Pre-R56 this path was gated out by `!id.startsWith('j-')`
 * style checks at every call site — meaning offline-edit-then-flush
 * silently dropped the edit. Now updates queue uniformly, R49 handles
 * the FK rewrite, and the edit lands in BE in the right order.
 */
export async function persistOrQueue(
  table: string,
  op: WriteOp,
  fn: () => Promise<unknown>,
  fallback: { rowId?: string; match?: Record<string, unknown>; payload?: unknown },
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  // R56: temp-id fast path — queue without attempting BE first.
  if ((op === 'update' || op === 'delete') && isTempId(fallback.rowId)) {
    try {
      await queueWrite({ table, op, ...fallback });
    } catch {}
    return false;
  }
  try {
    await fn();
    return true;
  } catch (err) {
    logWarn('persistOrQueue', `${table}.${op} failed, queueing: ${err instanceof Error ? err.message : String(err)}`);
    try {
      await queueWrite({ table, op, ...fallback });
    } catch {}
    return false;
  }
}

// R49: exposed for unit tests. Not part of the public API.
export const __test = { remapEntry, remapPayload, isTempId };
