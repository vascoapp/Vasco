// =============================================================================
// OFFLINE SCAN QUEUE
// =============================================================================
// Contractors often scan supplier receipts on site with no signal. We queue
// the raw base64 photo + country context; on reconnect we run the
// analyze-photo Edge Function and feed results through saveScanHistory.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from '../lib/supabase';
import { scanInvoicePhoto, type ScannedInvoice } from './invoiceScanService';
import { logWarn } from '../utils/errorHandler';

const QUEUE_KEY = '@vasco_offline_scans';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_QUEUE = 20; // Keep storage footprint bounded — photos are large

interface QueuedScan {
  id: string;
  imageBase64: string;
  country: string;
  capturedAt: number;
  attempts: number;
}

async function loadQueue(): Promise<QueuedScan[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedScan[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {}
}

/** Enqueue a photo for deferred OCR. Safe to call while offline. */
export async function queueScan(imageBase64: string, country: string = 'NL'): Promise<string> {
  const entry: QueuedScan = {
    id: `scan-q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    imageBase64,
    country,
    capturedAt: Date.now(),
    attempts: 0,
  };
  const queue = await loadQueue();
  queue.push(entry);
  await saveQueue(queue);
  return entry.id;
}

/** Drain the queue — runs each pending scan through the Edge Function.
 *  Call on app foreground or after a successful network check. */
export async function flushScanQueue(): Promise<{ processed: ScannedInvoice[]; dropped: number }> {
  const processed: ScannedInvoice[] = [];
  let dropped = 0;
  if (!isSupabaseConfigured) return { processed, dropped };

  const queue = await loadQueue();
  if (queue.length === 0) return { processed, dropped };

  const now = Date.now();
  const survivors: QueuedScan[] = [];

  for (const entry of queue) {
    if (now - entry.capturedAt > MAX_AGE_MS) {
      dropped += 1;
      logWarn('offlineScanQueue', `Dropping scan older than 30d: ${entry.id}`);
      continue;
    }
    try {
      const result = await scanInvoicePhoto(entry.imageBase64, entry.country);
      if (result) {
        processed.push(result);
        continue;
      }
    } catch (err) {
      logWarn('offlineScanQueue', `scan attempt failed: ${err}`);
    }
    entry.attempts += 1;
    if (entry.attempts >= 4) {
      dropped += 1;
      logWarn('offlineScanQueue', `Giving up on scan after 4 tries: ${entry.id}`);
    } else {
      survivors.push(entry);
    }
  }

  await saveQueue(survivors);
  return { processed, dropped };
}

export async function scanQueueSize(): Promise<number> {
  return (await loadQueue()).length;
}
