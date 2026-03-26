// =============================================================================
// OFFLINE QUEUE SERVICE — Queues API calls when device is offline
// =============================================================================
// Persists queued actions to AsyncStorage so they survive app restarts.
// When the device comes back online, syncService processes the queue in order.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_STORAGE_KEY = '@vasco/offline_queue';

export type QueuedActionType =
  | 'create_invoice'
  | 'update_invoice'
  | 'send_invoice'
  | 'mark_paid'
  | 'create_quote'
  | 'update_quote'
  | 'send_quote'
  | 'create_job'
  | 'update_job'
  | 'delete_job'
  | 'create_customer'
  | 'update_customer'
  | 'update_business_profile'
  | 'add_material'
  | 'add_job_material'
  | 'update_job_material'
  | 'export_invoice';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: Record<string, unknown>;
  createdAt: string; // ISO string for JSON serialization
  retryCount: number;
  /** Last error message if a sync attempt failed */
  lastError?: string;
}

export type QueueEventType = 'enqueued' | 'processed' | 'failed' | 'cleared';
export type QueueListener = (event: QueueEventType, action?: QueuedAction) => void;

class OfflineQueueService {
  private queue: QueuedAction[] = [];
  private loaded = false;
  private listeners: QueueListener[] = [];

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /** Load queue from AsyncStorage — call once at app start */
  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw) as QueuedAction[];
      }
    } catch {
      // If storage is corrupted, start fresh
      this.queue = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Silently fail — worst case we lose the queue on restart
    }
  }

  // ---------------------------------------------------------------------------
  // Queue operations
  // ---------------------------------------------------------------------------

  async enqueue(type: QueuedActionType, payload: Record<string, unknown>): Promise<QueuedAction> {
    await this.load();
    const action: QueuedAction = {
      id: `oq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    this.queue.push(action);
    await this.persist();
    this.emit('enqueued', action);
    return action;
  }

  /** Remove a specific action from the queue (after successful processing) */
  async dequeue(id: string): Promise<void> {
    await this.load();
    this.queue = this.queue.filter((a) => a.id !== id);
    await this.persist();
  }

  /** Mark an action as failed (increment retry count, store error) */
  async markFailed(id: string, error: string): Promise<void> {
    await this.load();
    const action = this.queue.find((a) => a.id === id);
    if (action) {
      action.retryCount += 1;
      action.lastError = error;
      await this.persist();
      this.emit('failed', action);
    }
  }

  /** Get all queued actions, oldest first */
  async getQueue(): Promise<QueuedAction[]> {
    await this.load();
    return [...this.queue];
  }

  async getQueueSize(): Promise<number> {
    await this.load();
    return this.queue.length;
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.persist();
    this.emit('cleared');
  }

  /** Peek at the next action without removing it */
  async peek(): Promise<QueuedAction | null> {
    await this.load();
    return this.queue[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Events (simple pub/sub for UI updates)
  // ---------------------------------------------------------------------------

  subscribe(listener: QueueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: QueueEventType, action?: QueuedAction): void {
    for (const listener of this.listeners) {
      try {
        listener(event, action);
      } catch {
        // Don't let a bad listener break the queue
      }
    }
  }
}

/** Singleton instance */
export const offlineQueue = new OfflineQueueService();
