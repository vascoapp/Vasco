// =============================================================================
// PENDING JOB PHOTOS QUEUE — R66 round 27 (2026-05-07)
// =============================================================================
// Closes the photo-offline-durability gap. Pre-R27, jobPhotoService.uploadJobPhoto
// returned null on six distinct failure cases (offline / temp parent jobId /
// signed-out / storage error / metadata insert error / generic exception)
// without distinguishing them. The caller showed a generic "Try again when
// online" alert and the photo bytes were lost — base64 lived only in the
// component's `result` variable, never persisted.
//
// This queue persists each unsent photo's bytes to FileSystem.documentDirectory
// (binary on disk, not in AsyncStorage which has 6MB per-row limits) and the
// metadata to a single AsyncStorage key. On replay (cold start + foreground
// transition + online tick), the queue iterates pending photos and retries
// uploadJobPhoto. Successful uploads delete the cached file. Failures stay
// queued for the next replay tick.
//
// Storage layout:
//   ${documentDirectory}/job-photos-queue/<id>.<ext>   — bytes
//   AsyncStorage @vasco_pending_job_photos             — metadata array
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { logWarn } from '../utils/errorHandler';
import { subscribeIdRemap } from './idRemapBus';
import { registerSingletonReset } from './singletonReset';
import type { PhotoKind } from './jobPhotoService';

const STORAGE_KEY = '@vasco_pending_job_photos';

// R66 round 27: when the offline write queue drains a parent job insert,
// it emits an idRemap event. Without this subscription, queued photos
// stay tied to the dead temp id forever — flushQueue would re-detect the
// temp id, re-queue, infinite loop. Listener rewrites jobId on every
// pending photo for that temp id; next flush sees a real uuid and uploads.
subscribeIdRemap((event) => {
  if (event.table !== 'jobs') return;
  void rewriteJobIds(event.tempId, event.realId);
});

async function rewriteJobIds(tempId: string, realId: string): Promise<void> {
  try {
    const queue = await readQueue();
    let changed = false;
    const next = queue.map((p) => {
      if (p.jobId === tempId) {
        changed = true;
        return { ...p, jobId: realId };
      }
      return p;
    });
    if (changed) await writeQueue(next);
  } catch {}
}

function queueDir(): Directory {
  return new Directory(Paths.document, 'job-photos-queue');
}

export interface PendingPhoto {
  id: string;
  jobId: string;
  fileUri: string;
  contentType: string;
  kind: PhotoKind;
  caption?: string;
  queuedAt: string;
  attempts: number;
}

async function ensureDir(): Promise<void> {
  try {
    const dir = queueDir();
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {}
}

async function readQueue(): Promise<PendingPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingPhoto[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

/**
 * Persist the photo bytes to disk + queue metadata. Returns the queued
 * record so the caller can show optimistic state ("uploading" badge).
 */
export async function queuePhoto(input: {
  jobId: string;
  imageBase64: string;
  kind?: PhotoKind;
  caption?: string;
  contentType?: string;
}): Promise<PendingPhoto> {
  await ensureDir();
  const id = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const contentType = input.contentType ?? 'image/jpeg';
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  // Strip data URL prefix if present.
  const cleanBase64 = input.imageBase64.replace(/^data:[^;]+;base64,/, '');
  const file = new File(queueDir(), `${id}.${ext}`);
  // expo-file-system v19: File.create() + bytes() write. Decode base64 →
  // Uint8Array since base64ToBytes is the canonical RN-Hermes pattern.
  const binary = globalThis.atob ? globalThis.atob(cleanBase64) : Buffer.from(cleanBase64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  const fileUri = file.uri;
  const record: PendingPhoto = {
    id,
    jobId: input.jobId,
    fileUri,
    contentType,
    kind: (input.kind ?? 'during') as PhotoKind,
    caption: input.caption,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  const queue = await readQueue();
  queue.push(record);
  await writeQueue(queue);
  return record;
}

/**
 * Returns the pending photos for a job — used by the photos screen so
 * queued (not-yet-uploaded) photos show alongside server-side rows.
 */
export async function listPendingForJob(jobId: string): Promise<PendingPhoto[]> {
  const queue = await readQueue();
  return queue.filter((p) => p.jobId === jobId);
}

/** Remove a queue entry + delete its on-disk file. */
async function removeFromQueue(id: string): Promise<void> {
  const queue = await readQueue();
  const target = queue.find((p) => p.id === id);
  if (target) {
    try {
      const file = new File(target.fileUri);
      if (file.exists) file.delete();
    } catch {}
  }
  await writeQueue(queue.filter((p) => p.id !== id));
}

/** Bump attempts on a queue entry that failed retry. */
async function bumpAttempts(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.map((p) => (p.id === id ? { ...p, attempts: p.attempts + 1 } : p)));
}

/**
 * Replay the queue. Reads each pending file's base64, calls uploadJobPhoto.
 * Skips entries whose parent job is still on a temp id (R59 contract — only
 * resolves once the parent job sync drains and the FE rebinds to the BE uuid).
 * Drops entries after 10 attempts to avoid infinite-retry on poison rows.
 */
export async function flushQueue(opts?: {
  isTempJobId?: (id: string) => boolean;
}): Promise<{ uploaded: number; remaining: number; dropped: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { uploaded: 0, remaining: 0, dropped: 0 };

  // R66 round 27: default temp-id detection from the canonical idShape
  // helper. Without this default, the app/_layout.tsx caller (which
  // passes no opts) would never skip temp-id entries → infinite re-queue.
  // Use require() rather than dynamic import() so Jest's CJS transform
  // resolves cleanly without --experimental-vm-modules.
  const { isTempIdFast } = require('../lib/idShape');
  const isTempJobId = opts?.isTempJobId ?? isTempIdFast;
  const { uploadJobPhoto } = require('./jobPhotoService');
  let uploaded = 0;
  let dropped = 0;

  for (const record of queue) {
    // Skip — parent job hasn't synced yet. Keep queued; next flush retries
    // (the offlineWriteQueue's idRemapBus will swap temp→real on flush, then
    // the next photo replay tick succeeds).
    if (isTempJobId(record.jobId)) continue;

    if (record.attempts >= 10) {
      logWarn('pendingJobPhotosQueue', `Dropping ${record.id} after 10 failed attempts`);
      await removeFromQueue(record.id);
      dropped += 1;
      continue;
    }

    try {
      const file = new File(record.fileUri);
      if (!file.exists) {
        // File evicted or app reinstalled. Drop the orphan metadata.
        await removeFromQueue(record.id);
        continue;
      }
      const bytes = await file.bytes();
      // Encode bytes → base64. RN/Hermes-friendly: avoid spread which
      // overflows the call stack on large images. Iterate manually.
      let binStr = '';
      for (let i = 0; i < bytes.length; i += 1) binStr += String.fromCharCode(bytes[i]);
      const base64 = globalThis.btoa
        ? globalThis.btoa(binStr)
        : Buffer.from(binStr, 'binary').toString('base64');
      const result = await uploadJobPhoto({
        jobId: record.jobId,
        imageBase64: base64,
        kind: record.kind,
        caption: record.caption,
        contentType: record.contentType,
      });
      if (result) {
        await removeFromQueue(record.id);
        uploaded += 1;
      } else {
        await bumpAttempts(record.id);
      }
    } catch (err) {
      logWarn('pendingJobPhotosQueue', `Replay failed for ${record.id}: ${err}`);
      await bumpAttempts(record.id);
    }
  }

  const after = await readQueue();
  return { uploaded, remaining: after.length, dropped };
}

/** For testing / debugging. Also called on logout to wipe orphaned bytes. */
export async function clearAll(): Promise<void> {
  const queue = await readQueue();
  for (const p of queue) {
    try {
      const file = new File(p.fileUri);
      if (file.exists) file.delete();
    } catch {}
  }
  await writeQueue([]);
}

// R66 round 40: register clearAll() with the singleton-reset bus so logout
// drops the binary photo files alongside the AsyncStorage metadata wipe.
// Pre-R40 sessionCleanup wiped the @vasco_pending_job_photos index but the
// actual JPG/PNG bytes persisted in `${documentDirectory}/job-photos-queue/`
// indefinitely. Privacy + disk-fill issue: previous user's photo of a
// customer's bathroom would linger on the device after logout, and the
// index re-pointed to nothing, so flush attempts found dangling files.
registerSingletonReset(() => {
  clearAll().catch(() => {});
});
