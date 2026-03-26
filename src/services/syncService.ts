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
    // Map action types to Supabase calls.
    // When Supabase is live, each case will call the appropriate dataProvider function.
    // For now this is a routing skeleton — fill in real API calls when backend is active.
    const handlers: Record<QueuedActionType, (payload: Record<string, unknown>) => Promise<void>> = {
      create_invoice: async (p) => { await this.callApi('invoices', 'POST', p); },
      update_invoice: async (p) => { await this.callApi(`invoices/${p.id}`, 'PATCH', p); },
      send_invoice: async (p) => { await this.callApi(`invoices/${p.id}/send`, 'POST', p); },
      mark_paid: async (p) => { await this.callApi(`invoices/${p.id}/mark-paid`, 'POST', p); },
      create_quote: async (p) => { await this.callApi('quotes', 'POST', p); },
      update_quote: async (p) => { await this.callApi(`quotes/${p.id}`, 'PATCH', p); },
      send_quote: async (p) => { await this.callApi(`quotes/${p.id}/send`, 'POST', p); },
      create_job: async (p) => { await this.callApi('jobs', 'POST', p); },
      update_job: async (p) => { await this.callApi(`jobs/${p.id}`, 'PATCH', p); },
      delete_job: async (p) => { await this.callApi(`jobs/${p.id}`, 'DELETE', p); },
      create_customer: async (p) => { await this.callApi('customers', 'POST', p); },
      update_customer: async (p) => { await this.callApi(`customers/${p.id}`, 'PATCH', p); },
      update_business_profile: async (p) => { await this.callApi('business-profile', 'PATCH', p); },
      add_material: async (p) => { await this.callApi('materials', 'POST', p); },
      add_job_material: async (p) => { await this.callApi('job-materials', 'POST', p); },
      update_job_material: async (p) => { await this.callApi(`job-materials/${p.id}`, 'PATCH', p); },
      export_invoice: async (p) => { await this.callApi(`invoices/${p.id}/export`, 'POST', p); },
    };

    const handler = handlers[action.type];
    if (handler) {
      await handler(action.payload);
    } else {
      throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Placeholder for Supabase edge function / REST calls.
   * Replace with real supabase client calls when backend is active.
   */
  private async callApi(_endpoint: string, _method: string, _payload: Record<string, unknown>): Promise<void> {
    // TODO: Wire to Supabase when live
    // Example:
    // const { error } = await supabase.from(table).insert(payload);
    // if (error) throw error;
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
