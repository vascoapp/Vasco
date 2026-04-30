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
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';

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

// R277: temp IDs (c-{ts}, j-{ts}, mat-{ts}, sup-{ts}, jm-{ts}, proj-{ts})
// are generated client-side for optimistic UI updates. They must NEVER be
// sent to BE — Postgres rejects them as non-uuid. Strip on flush so the BE
// generates a fresh uuid via the column default.
const TEMP_ID_PATTERNS = [/^c-\d+$/, /^j-\d+$/, /^mat-\d+$/, /^sup-\d+$/, /^jm-\d+$/, /^proj-\d+$/, /^q-\d+$/, /^inv-\d+$/];

function isTempId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  return TEMP_ID_PATTERNS.some((re) => re.test(id));
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

async function applyWrite(entry: QueuedWrite): Promise<boolean> {
  const table = supabase.from(entry.table as any) as any;
  // Drop entries that were enqueued with a temp rowId for update/delete —
  // BE never persisted the original create, so updating by temp id would
  // fail with no rows matched. Drop quietly; local state is the source of
  // truth until the next reconnect-create.
  if ((entry.op === 'update' || entry.op === 'delete') && isTempId(entry.rowId)) {
    return true; // treat as processed so it leaves the queue
  }
  try {
    if (entry.op === 'insert') {
      const { error } = await table.insert(stripTempId(entry.payload));
      return !error;
    }
    if (entry.op === 'upsert') {
      const { error } = await table.upsert(stripTempId(entry.payload));
      return !error;
    }
    if (entry.op === 'update') {
      let q = table.update(stripTempId(entry.payload));
      if (entry.rowId) q = q.eq('id', entry.rowId);
      if (entry.match) for (const [k, v] of Object.entries(entry.match)) q = q.eq(k, v);
      const { error } = await q;
      return !error;
    }
    if (entry.op === 'delete') {
      let q = table.delete();
      if (entry.rowId) q = q.eq('id', entry.rowId);
      if (entry.match) for (const [k, v] of Object.entries(entry.match)) q = q.eq(k, v);
      const { error } = await q;
      return !error;
    }
    return false;
  } catch {
    return false;
  }
}

/** Flush queued writes. Skips if offline/unconfigured. Removes succeeded + expired. */
export async function flushQueue(): Promise<{ processed: number; dropped: number }> {
  if (!isSupabaseConfigured) return { processed: 0, dropped: 0 };

  const queue = await loadQueue();
  if (queue.length === 0) return { processed: 0, dropped: 0 };

  const now = Date.now();
  const survivors: QueuedWrite[] = [];
  let processed = 0;
  let dropped = 0;

  for (const entry of queue) {
    if (now - entry.createdAt > MAX_AGE_MS) {
      dropped += 1;
      logWarn('offlineWriteQueue', `Dropping stale write after ${Math.round((now - entry.createdAt) / 86400000)}d: ${entry.table}.${entry.op}`);
      continue;
    }
    const ok = await applyWrite(entry);
    if (ok) {
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
 */
export async function persistOrQueue(
  table: string,
  op: WriteOp,
  fn: () => Promise<unknown>,
  fallback: { rowId?: string; match?: Record<string, unknown>; payload?: unknown },
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
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
