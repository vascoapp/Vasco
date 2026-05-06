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
// R59: temp-id helpers moved to src/lib/idShape.ts so other modules
// (moat emit gates, AppState refresh, etc.) share one source of truth.
import { isTempId } from '../lib/idShape';

const QUEUE_KEY = '@vasco_offline_writes';
const MAX_QUEUE = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // Drop entries older than a week

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

/** Add a write to the queue. Safe to call from any write path. */
export async function queueWrite(entry: Omit<QueuedWrite, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
  const queue = await loadQueue();
  queue.push({
    ...entry,
    id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    attempts: 0,
  });
  await saveQueue(queue);
}

// R277/R59: temp IDs (c-{ts}, j-{ts}, mat-{ts}, sup-{ts}, jm-{ts},
// proj-{ts}, q-{ts}, inv-{ts}) are generated client-side for optimistic UI
// updates. They must NEVER be sent to BE — Postgres rejects them as
// non-uuid. Strip on flush so the BE generates a fresh uuid via the column
// default. Pattern definitions live in `src/lib/idShape.ts` (R59 hoist).

function stripTempId<T extends Record<string, any> | unknown>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const obj = payload as Record<string, any>;
  if ('id' in obj && isTempId(obj.id)) {
    const { id: _omit, ...rest } = obj;
    return rest as T;
  }
  return payload;
}

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
  /** When set, the BE generated a new id for an insert that had a temp id. */
  mapping?: { temp: string; real: string };
}

async function applyWrite(entry: QueuedWrite, idMap: Map<string, string>): Promise<ApplyResult> {
  // Rewrite FK references using accumulated id mappings before sending.
  const remapped = remapEntry(entry, idMap);
  const table = supabase.from(remapped.table as any) as any;

  // Drop entries that still reference a temp rowId for update/delete —
  // either no mapping was captured (parent insert never succeeded) or BE
  // never persisted the original create. Updating by temp id would fail
  // with no rows matched. Drop quietly; local state is the source of
  // truth until the next reconnect-create.
  if ((remapped.op === 'update' || remapped.op === 'delete') && isTempId(remapped.rowId)) {
    return { ok: true }; // treat as processed so it leaves the queue
  }

  try {
    if (remapped.op === 'insert') {
      const tempId = (remapped.payload && typeof remapped.payload === 'object'
        ? (remapped.payload as Record<string, any>).id
        : undefined) as string | undefined;
      const stripped = stripTempId(remapped.payload);
      if (typeof tempId === 'string' && isTempId(tempId)) {
        // R49: capture BE-generated id so child rows can rewrite their FKs.
        const { data, error } = await table.insert(stripped).select('id').single();
        if (error) return { ok: false };
        const realId = (data as any)?.id;
        if (typeof realId === 'string' && realId.length > 0) {
          return { ok: true, mapping: { temp: tempId, real: realId } };
        }
        return { ok: true };
      }
      const { error } = await table.insert(stripped);
      return { ok: !error };
    }
    if (remapped.op === 'upsert') {
      const { error } = await table.upsert(stripTempId(remapped.payload));
      return { ok: !error };
    }
    if (remapped.op === 'update') {
      let q = table.update(stripTempId(remapped.payload));
      if (remapped.rowId) q = q.eq('id', remapped.rowId);
      if (remapped.match) for (const [k, v] of Object.entries(remapped.match)) q = q.eq(k, v);
      const { error } = await q;
      return { ok: !error };
    }
    if (remapped.op === 'delete') {
      let q = table.delete();
      if (remapped.rowId) q = q.eq('id', remapped.rowId);
      if (remapped.match) for (const [k, v] of Object.entries(remapped.match)) q = q.eq(k, v);
      const { error } = await q;
      return { ok: !error };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Flush queued writes. Skips if offline/unconfigured. Removes succeeded + expired. */
export async function flushQueue(): Promise<{ processed: number; dropped: number }> {
  if (!isSupabaseConfigured) return { processed: 0, dropped: 0 };

  const queue = await loadQueue();
  if (queue.length === 0) return { processed: 0, dropped: 0 };

  const now = Date.now();
  const survivors: QueuedWrite[] = [];
  const idMap = new Map<string, string>();
  let processed = 0;
  let dropped = 0;

  for (const entry of queue) {
    if (now - entry.createdAt > MAX_AGE_MS) {
      dropped += 1;
      logWarn('offlineWriteQueue', `Dropping stale write after ${Math.round((now - entry.createdAt) / 86400000)}d: ${entry.table}.${entry.op}`);
      continue;
    }
    const result = await applyWrite(entry, idMap);
    if (result.ok) {
      if (result.mapping) {
        idMap.set(result.mapping.temp, result.mapping.real);
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
    entry.attempts += 1;
    if (entry.attempts >= 5) {
      dropped += 1;
      logWarn('offlineWriteQueue', `Giving up on ${entry.table}.${entry.op} after 5 attempts`);
    } else {
      survivors.push(entry);
    }
  }

  await saveQueue(survivors);
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
