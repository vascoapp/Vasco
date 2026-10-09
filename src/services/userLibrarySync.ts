// =============================================================================
// THE CONTRACTOR'S LIBRARY, KEPT IN THE ACCOUNT
// =============================================================================
// Pricebook, own quote templates, job forms and filled-in forms were device-only
// (AsyncStorage), and logout wipes AsyncStorage — a contractor lost the price
// list on every logout, reinstall or new phone (UK re-walk W190; user decision
// 2026-10-09: "store them in the account").
//
// The services keep their AsyncStorage copy as the OFFLINE CACHE and call this
// module to (1) push every change to `user_library`, queued when offline, and
// (2) on load, merge the account's rows into the cache.
//
// Merge rule: per item id, the newer `updatedAt` wins. A deletion is a
// TOMBSTONE ({ _deleted: true, updatedAt }) — a plain row delete would let a
// second device that is still offline upload the item again on its next merge.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAuthedUserId } from '../lib/currentUser';
import type { UserLibraryKind } from '../lib/database.types';
import { logWarn } from '../utils/errorHandler';
import { persistOrQueue } from './offlineWriteQueue';

export type { UserLibraryKind };

/** What every library item carries for the merge. */
export interface LibraryItem {
  id: string;
  updatedAt?: string;
}

interface Tombstone { _deleted: true; updatedAt: string }

const ON_CONFLICT = 'user_id,kind,item_id';

/**
 * Deletions made on THIS device that the account has not confirmed yet.
 * Without them "the account has it, the device doesn't" always read as "added
 * on another phone": an item deleted offline (tombstone still queued) or while
 * a pull was out came straight back (review 2026-10-09). Kept until the
 * account shows a tombstone at least as new.
 */
const LOCAL_DELETIONS_KEY = '@vasco_library_deleted';
type LocalDeletions = Partial<Record<UserLibraryKind, Record<string, string>>>;

async function readLocalDeletions(): Promise<LocalDeletions> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_DELETIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeLocalDeletions(next: LocalDeletions): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DELETIONS_KEY, JSON.stringify(next)).catch(() => {});
}

const ts = (v: string | undefined): number => {
  const n = v ? Date.parse(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Pure merge: local cache × account rows → what the device should hold, and
 * which local items the account has not seen (or holds an older copy of).
 */
export function mergeLibrary<T extends LibraryItem>(
  local: readonly T[],
  remote: ReadonlyArray<{ item_id: string; data: unknown; updated_at?: string }>,
  localDeletions: Readonly<Record<string, string>> = {},
): { merged: T[]; toPush: T[]; reDelete: string[]; confirmedDeletions: string[] } {
  const remoteById = new Map<string, { data: T | Tombstone; at: number }>();
  for (const r of remote) {
    const data = r.data as T | Tombstone;
    // The EDIT time. The row's updated_at is when it was PUSHED, so the first
    // phone to sync an old copy would beat another phone's newer edit.
    const edited = ts((data as { updatedAt?: string }).updatedAt);
    remoteById.set(r.item_id, { data, at: edited || ts(r.updated_at) });
  }
  const reDelete: string[] = [];
  const confirmedDeletions: string[] = [];
  for (const [id, deletedAt] of Object.entries(localDeletions)) {
    const r = remoteById.get(id);
    if (r && (r.data as Tombstone)._deleted && r.at >= ts(deletedAt)) confirmedDeletions.push(id);
    else if (r && !(r.data as Tombstone)._deleted && r.at <= ts(deletedAt)) reDelete.push(id);
  }
  const merged: T[] = [];
  const toPush: T[] = [];
  const seen = new Set<string>();
  for (const item of local) {
    seen.add(item.id);
    const r = remoteById.get(item.id);
    if (!r) { merged.push(item); toPush.push(item); continue; }
    if (ts(item.updatedAt) > r.at) { merged.push(item); toPush.push(item); continue; }
    if (!(r.data as Tombstone)._deleted) merged.push(r.data as T);
  }
  const deletedHere = new Set(reDelete);
  for (const [id, r] of remoteById) {
    if (seen.has(id) || (r.data as Tombstone)._deleted || deletedHere.has(id)) continue;
    merged.push(r.data as T);
  }
  return { merged, toPush, reDelete, confirmedDeletions };
}

/** The account's rows of one kind, or null when there is no account to ask. */
export async function pullLibrary(kind: UserLibraryKind): Promise<Array<{ item_id: string; data: unknown; updated_at: string }> | null> {
  const uid = getAuthedUserId();
  if (!isSupabaseConfigured || !uid) return null;
  try {
    const { data, error } = await (supabase.from('user_library') as any)
      .select('item_id, data, updated_at')
      .eq('user_id', uid)
      .eq('kind', kind);
    if (error) throw error;
    // An account switch while the request was out: these rows are not the
    // current user's library.
    if (getAuthedUserId() !== uid) return null;
    return data ?? [];
  } catch (err) {
    logWarn('userLibrarySync', `pull ${kind} failed: ${String(err)}`);
    return null;
  }
}

/** Save one item to the account (queued when offline). */
export async function pushLibraryItem(kind: UserLibraryKind, itemId: string, data: object, forUserId?: string | null): Promise<void> {
  const uid = getAuthedUserId();
  if (!isSupabaseConfigured || !uid) return;
  // A delayed push (job forms) from before an account switch: not this account's.
  if (forUserId !== undefined && forUserId !== uid) return;
  const row = { user_id: uid, kind, item_id: itemId, data, updated_at: new Date().toISOString() };
  try {
    await persistOrQueue(
      'user_library',
      'upsert',
      async () => {
        const { error } = await (supabase.from('user_library') as any).upsert(row, { onConflict: ON_CONFLICT });
        if (error) throw error;
      },
      { payload: row, onConflict: ON_CONFLICT },
    );
  } catch (err) {
    logWarn('userLibrarySync', `push ${kind}/${itemId} failed: ${String(err)}`);
  }
}

/** Delete one item from the account — as a tombstone, see the header. */
export async function deleteLibraryItem(kind: UserLibraryKind, itemId: string): Promise<void> {
  const at = new Date().toISOString();
  const deletions = await readLocalDeletions();
  await writeLocalDeletions({ ...deletions, [kind]: { ...(deletions[kind] ?? {}), [itemId]: at } });
  await pushLibraryItem(kind, itemId, { _deleted: true, updatedAt: at });
}

/**
 * Load-time sync for a whole list: merge the account's rows into the cache and
 * upload whatever the account is missing. Returns the merged list, or null when
 * there is no account (the caller keeps its cache as it is).
 */
export async function syncLibraryList<T extends LibraryItem>(
  kind: UserLibraryKind,
  local: readonly T[] | (() => Promise<readonly T[]>),
): Promise<T[] | null> {
  const uid = getAuthedUserId();
  const remote = await pullLibrary(kind);
  if (!remote || getAuthedUserId() !== uid) return null;
  // Read the device copy AFTER the pull: an edit made while the request was out
  // would otherwise be overwritten by the merge of an older snapshot.
  const deletions = await readLocalDeletions();
  const mine = deletions[kind] ?? {};
  const { merged, toPush, reDelete, confirmedDeletions } = mergeLibrary(typeof local === 'function' ? await local() : local, remote, mine);
  for (const item of toPush) void pushLibraryItem(kind, item.id, item);
  // A deletion the account has not seen yet (its tombstone still queued, or
  // lost): say it again.
  for (const id of reDelete) void pushLibraryItem(kind, id, { _deleted: true, updatedAt: mine[id] });
  if (confirmedDeletions.length) {
    const rest = { ...mine };
    for (const id of confirmedDeletions) delete rest[id];
    await writeLocalDeletions({ ...deletions, [kind]: rest });
  }
  return merged;
}
