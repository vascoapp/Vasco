// =============================================================================
// AI ACTION QUEUE SERVICE — Unit Tests
// =============================================================================
// Tests queue population, approve/reject/snooze, deduplication, and expiry.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

// Must import after jest.setup.ts mocks are applied
import {
  getQueue,
  addToQueue,
  approveItem,
  rejectItem,
  snoozeQueueItem,
  getQueueHistory,
  QueueItem,
} from '../aiActionQueueService';

// Helper to reset AsyncStorage between tests
function clearStorage() {
  const store = (globalThis as any).__asyncStorageMock;
  if (store) Object.keys(store).forEach((k) => delete store[k]);
}

const QUEUE_KEY = '@vasco_ai_queue';

function makeQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'draft_invoice',
    status: 'pending',
    title: 'Test Invoice',
    description: 'Test description',
    preparedData: { amount: 500 },
    actionLabel: 'Create',
    estimatedImpact: '€500',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('aiActionQueueService', () => {
  beforeEach(() => {
    clearStorage();
    jest.clearAllMocks();
  });

  // ─── addToQueue ────────────────────────────────────────────────────────────

  describe('addToQueue', () => {
    it('should add an item and return a non-empty id', async () => {
      const id = await addToQueue({
        type: 'draft_invoice',
        title: 'Invoice for Bakker',
        description: 'Plumbing job completed',
        preparedData: { amount: 450 },
        actionLabel: 'Create Invoice',
        estimatedImpact: '€450 revenue',
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should deduplicate items with same type and title', async () => {
      const payload = {
        type: 'draft_reminder' as const,
        title: 'Reminder for Jansen',
        description: 'Overdue 7 days',
        preparedData: { invoiceId: 'inv-1' },
        actionLabel: 'Send',
        estimatedImpact: 'Speeds up payment',
      };

      const id1 = await addToQueue(payload);
      const id2 = await addToQueue(payload);

      expect(id1).toBeTruthy();
      expect(id2).toBe(''); // deduplicated
    });

    it('should deduplicate items with same sourceGeneratorId', async () => {
      const id1 = await addToQueue({
        type: 'draft_followup',
        title: 'Follow-up A',
        description: '',
        preparedData: {},
        actionLabel: 'Send',
        estimatedImpact: '',
        sourceGeneratorId: 'gen-quote-1',
      });

      const id2 = await addToQueue({
        type: 'draft_followup',
        title: 'Follow-up B (different title)',
        description: '',
        preparedData: {},
        actionLabel: 'Send',
        estimatedImpact: '',
        sourceGeneratorId: 'gen-quote-1',
      });

      expect(id1).toBeTruthy();
      expect(id2).toBe('');
    });
  });

  // ─── getQueue ──────────────────────────────────────────────────────────────

  describe('getQueue', () => {
    it('should return empty array when no items exist', async () => {
      const queue = await getQueue();
      expect(queue).toEqual([]);
    });

    it('should return only pending, non-expired, non-snoozed items', async () => {
      const items: QueueItem[] = [
        makeQueueItem({ id: 'q-1', status: 'pending' }),
        makeQueueItem({ id: 'q-2', status: 'approved' }),
        makeQueueItem({ id: 'q-3', status: 'rejected' }),
        makeQueueItem({
          id: 'q-4',
          status: 'pending',
          expiresAt: new Date(Date.now() - 1000).toISOString(), // expired
        }),
        makeQueueItem({
          id: 'q-5',
          status: 'pending',
          snoozedUntil: new Date(Date.now() + 86400000).toISOString(), // snoozed future
        }),
      ];

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
      const queue = await getQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('q-1');
    });
  });

  // ─── approveItem ───────────────────────────────────────────────────────────

  describe('approveItem', () => {
    it('should mark an item as approved', async () => {
      const items = [makeQueueItem({ id: 'q-approve-1', status: 'pending' })];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));

      const result = await approveItem('q-approve-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('approved');

      // Verify persisted
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const stored: QueueItem[] = JSON.parse(raw!);
      expect(stored[0].status).toBe('approved');
    });

    it('should return null for non-existent item', async () => {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([]));
      const result = await approveItem('non-existent');
      expect(result).toBeNull();
    });
  });

  // ─── rejectItem ────────────────────────────────────────────────────────────

  describe('rejectItem', () => {
    it('should mark an item as rejected', async () => {
      const items = [makeQueueItem({ id: 'q-reject-1', status: 'pending' })];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));

      await rejectItem('q-reject-1');

      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const stored: QueueItem[] = JSON.parse(raw!);
      expect(stored[0].status).toBe('rejected');
    });
  });

  // ─── snoozeQueueItem ──────────────────────────────────────────────────────

  describe('snoozeQueueItem', () => {
    it('should set snoozedUntil and increment snoozeCount', async () => {
      const items = [makeQueueItem({ id: 'q-snooze-1', status: 'pending' })];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));

      await snoozeQueueItem('q-snooze-1', 4); // snooze 4 hours

      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const stored: QueueItem[] = JSON.parse(raw!);
      expect(stored[0].snoozedUntil).toBeDefined();
      expect(stored[0].snoozeCount).toBe(1);

      // Snooze again
      await snoozeQueueItem('q-snooze-1', 2);
      const raw2 = await AsyncStorage.getItem(QUEUE_KEY);
      const stored2: QueueItem[] = JSON.parse(raw2!);
      expect(stored2[0].snoozeCount).toBe(2);
    });

    it('should hide snoozed items from getQueue', async () => {
      const items = [
        makeQueueItem({ id: 'q-s1', status: 'pending' }),
        makeQueueItem({ id: 'q-s2', status: 'pending' }),
      ];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));

      await snoozeQueueItem('q-s1', 24);

      const queue = await getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('q-s2');
    });
  });

  // ─── getQueueHistory ──────────────────────────────────────────────────────

  describe('getQueueHistory', () => {
    it('should return only approved and rejected items, sorted newest first', async () => {
      const items = [
        makeQueueItem({ id: 'q-h1', status: 'approved', createdAt: '2026-03-20T10:00:00Z' }),
        makeQueueItem({ id: 'q-h2', status: 'pending', createdAt: '2026-03-21T10:00:00Z' }),
        makeQueueItem({ id: 'q-h3', status: 'rejected', createdAt: '2026-03-22T10:00:00Z' }),
      ];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));

      const history = await getQueueHistory();

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('q-h3'); // newest first
      expect(history[1].id).toBe('q-h1');
    });
  });
});
