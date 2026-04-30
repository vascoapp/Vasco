// =============================================================================
// SYNC SERVICE — Processes offline queue when connectivity is restored
// =============================================================================
// Coordinates the sync process:
// 1. Processes queued actions in FIFO order
// 2. Handles failures with retry limits
// 3. Emits status events so the UI can show progress
// =============================================================================

import { offlineQueue, QueuedAction, QueuedActionType } from './offlineQueueService';
import { isSupabaseConfigured } from '../lib/supabase';
import * as dp from '../lib/dataProvider';

const MAX_RETRIES = 3;

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
export type SyncListener = (status: SyncStatus, progress?: { done: number; total: number }) => void;

class SyncService {
  private status: SyncStatus = 'idle';
  private processing = false;
  private listeners: SyncListener[] = [];

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Process all queued actions. Call this when the device comes back online. */
  async processQueue(): Promise<{ succeeded: number; failed: number }> {
    if (this.processing) return { succeeded: 0, failed: 0 };
    if (!isSupabaseConfigured) {
      // In demo/seed mode, just clear the queue — there's no backend to sync to
      await offlineQueue.clearQueue();
      return { succeeded: 0, failed: 0 };
    }

    this.processing = true;
    this.setStatus('syncing');

    const queue = await offlineQueue.getQueue();
    const total = queue.length;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < queue.length; i++) {
      const action = queue[i];
      this.emitProgress({ done: i, total });

      if (action.retryCount >= MAX_RETRIES) {
        // Too many retries — skip but leave in queue for manual review
        failed += 1;
        continue;
      }

      try {
        await this.executeAction(action);
        await offlineQueue.dequeue(action.id);
        succeeded += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await offlineQueue.markFailed(action.id, message);
        failed += 1;
      }
    }

    this.emitProgress({ done: total, total });
    this.setStatus(failed > 0 ? 'error' : 'synced');
    this.processing = false;

    // Reset to idle after showing "synced" for a moment
    if (failed === 0) {
      setTimeout(() => this.setStatus('idle'), 3000);
    }

    return { succeeded, failed };
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  // ---------------------------------------------------------------------------
  // Action execution — routes each action type to the appropriate API call
  // ---------------------------------------------------------------------------

  private async executeAction(action: QueuedAction): Promise<void> {
    // R275: routes queued actions through dataProvider (the canonical write
    // path) rather than a separate REST shim. Same Supabase calls AppState
    // would have made if it weren't offline.
    const p = action.payload;
    const id = (p as { id?: string }).id ?? '';

    switch (action.type) {
      case 'create_invoice':
      case 'create_quote': {
        await dp.createDocument(p as { doc_type: 'quote' | 'invoice'; status: 'draft' | 'sent' | 'paid' });
        return;
      }
      case 'update_invoice':
      case 'update_quote': {
        if (!id) throw new Error(`${action.type} missing id`);
        await dp.updateDocument(id, p);
        return;
      }
      case 'send_invoice':
      case 'send_quote': {
        if (!id) throw new Error(`${action.type} missing id`);
        await dp.updateDocument(id, { status: 'sent', sent_at: new Date().toISOString() });
        return;
      }
      case 'mark_paid': {
        if (!id) throw new Error('mark_paid missing id');
        await dp.updateDocument(id, { status: 'paid', paid_at: new Date().toISOString() });
        return;
      }
      case 'create_job': {
        await dp.createJob(p as Parameters<typeof dp.createJob>[0]);
        return;
      }
      case 'update_job': {
        if (!id) throw new Error('update_job missing id');
        await dp.updateJob(id, p);
        return;
      }
      case 'delete_job': {
        if (!id) throw new Error('delete_job missing id');
        await dp.deleteJob(id);
        return;
      }
      case 'create_customer': {
        await dp.createCustomer(p as Parameters<typeof dp.createCustomer>[0]);
        return;
      }
      case 'update_customer': {
        if (!id) throw new Error('update_customer missing id');
        await dp.updateCustomer(id, p as Parameters<typeof dp.updateCustomer>[1]);
        return;
      }
      case 'update_business_profile': {
        await dp.upsertBusinessSettings(p as Parameters<typeof dp.upsertBusinessSettings>[0]);
        return;
      }
      case 'add_material': {
        await dp.createMaterial(p as Parameters<typeof dp.createMaterial>[0]);
        return;
      }
      case 'add_job_material': {
        await dp.createJobMaterial(p as Parameters<typeof dp.createJobMaterial>[0]);
        return;
      }
      case 'update_job_material': {
        if (!id) throw new Error('update_job_material missing id');
        await dp.updateJobMaterial(id, p as Parameters<typeof dp.updateJobMaterial>[1]);
        return;
      }
      case 'export_invoice': {
        // External-system export deferred — no edge fn deployed yet. Drop
        // the queued action gracefully so the offline queue doesn't stall.
        // Real export goes through the integrations layer (Moneybird etc.)
        // directly when online; queued actions are best-effort retries.
        return;
      }
      default: {
        const exhaustive: never = action.type;
        throw new Error(`Unknown action type: ${exhaustive}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private setStatus(status: SyncStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      try { listener(status); } catch { /* ignore */ }
    }
  }

  private emitProgress(progress: { done: number; total: number }): void {
    for (const listener of this.listeners) {
      try { listener(this.status, progress); } catch { /* ignore */ }
    }
  }
}

/** Singleton instance */
export const syncService = new SyncService();
