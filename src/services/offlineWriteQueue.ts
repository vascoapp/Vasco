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

async function applyWrite(entry: QueuedWrite): Promise<boolean> {
  const table = supabase.from(entry.table as any) as any;
  try {
    if (entry.op === 'insert') {
      const { error } = await table.insert(entry.payload);
      return !error;
    }
    if (entry.op === 'upsert') {
      const { error } = await table.upsert(entry.payload);
      return !error;
    }
    if (entry.op === 'update') {
      let q = table.update(entry.payload);
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
