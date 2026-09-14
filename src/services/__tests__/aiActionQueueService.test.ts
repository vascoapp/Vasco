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

// ---------------------------------------------------------------------------
// Sibling count-badge merge — scoping regression tests
// ---------------------------------------------------------------------------
describe('addToQueue sibling merge scoping', () => {
  beforeEach(() => clearStorage());

  const base = {
    type: 'progress_note' as const,
    description: 'd',
    preparedData: {},
    actionLabel: 'Send',
    estimatedImpact: '€0',
  };

  test('same generator + same type + different entity → merges into a count badge', async () => {
    await addToQueue({ ...base, title: 'Reminder A', entityKey: 'eve-appt-1', sourceGeneratorId: 'eve-agent' });
    await addToQueue({ ...base, title: 'Reminder B', entityKey: 'eve-appt-2', sourceGeneratorId: 'eve-agent' });
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(2);
    // The count must NOT read as a multiplier on the surviving title. That
    // produced "2× Factuur Hotel NH 14d te laat" — two invoices for one
    // customer at one age — when the second was a different customer at a
    // different age. The card still describes entity A, so it keeps A's title
    // and reports the others as a separate "+N of this kind".
    expect(q[0].title).not.toMatch(/^\d+×/);
    expect(q[0].title).toContain('Reminder A');
    expect(q[0].title).toMatch(/\+1/);
    expect(q[0].titleBase).toBe('Reminder A');
  });

  test('a third sibling re-composes the suffix instead of stacking it', async () => {
    await addToQueue({ ...base, title: 'Reminder A', entityKey: 'eve-appt-1', sourceGeneratorId: 'eve-agent' });
    await addToQueue({ ...base, title: 'Reminder B', entityKey: 'eve-appt-2', sourceGeneratorId: 'eve-agent' });
    await addToQueue({ ...base, title: 'Reminder C', entityKey: 'eve-appt-3', sourceGeneratorId: 'eve-agent' });
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(3);
    expect(q[0].titleBase).toBe('Reminder A');
    // Exactly one suffix, reporting 2 others — not "+1" appended twice.
    expect(q[0].title).toMatch(/\+2/);
    expect(q[0].title.match(/\+\d+/g)).toHaveLength(1);
  });

  test('same entityKey twice → skipped entirely, no count bump', async () => {
    await addToQueue({ ...base, title: 'Reminder A', entityKey: 'eve-appt-1', sourceGeneratorId: 'eve-agent' });
    await addToQueue({ ...base, title: 'Reminder A', entityKey: 'eve-appt-1', sourceGeneratorId: 'eve-agent' });
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(1);
  });

  test('DIFFERENT generators of the same type stay separate actionable items', async () => {
    // Regression: a type-only match collapsed a workflow-pack incasso step and
    // an EVE appointment reminder into one card, discarding the second action.
    await addToQueue({ ...base, title: 'Incasso Automatisch: Hotel', entityKey: 'pack-1', sourceGeneratorId: 'workflow_incasso' });
    await addToQueue({ ...base, title: 'Afspraak morgen: Badkamer', entityKey: 'eve-appt-1', sourceGeneratorId: 'eve-agent' });
    const q = await getQueue();
    expect(q).toHaveLength(2);
    expect(q.map((i) => i.count)).toEqual([1, 1]);
    expect(q.some((i) => i.title.includes('Afspraak morgen'))).toBe(true);
    expect(q.some((i) => i.title.includes('Incasso Automatisch'))).toBe(true);
  });

  test('count badge does not inflate when the same entities are re-generated', async () => {
    // Regression: a per-run random entityKey made every scheduler run look like
    // new entities, so the badge climbed 2× → 8× → 14× over successive logins.
    for (let run = 0; run < 5; run++) {
      await addToQueue({ ...base, title: 'Reminder A', entityKey: 'eve-appt-1', sourceGeneratorId: 'eve-agent' });
      await addToQueue({ ...base, title: 'Reminder B', entityKey: 'eve-appt-2', sourceGeneratorId: 'eve-agent' });
    }
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(2); // two distinct entities, five runs → still 2
  });
});

// ---------------------------------------------------------------------------
// Queue titles must never expose raw row ids (regression: "Herinnering voor
// inv-seed-1", "Opvolging offerte q-104"). Titles are contractor-facing and the
// same entity shapes feed customer-facing share templates.
//
// These target queueEntityLabel directly rather than populateQueue's composed
// titles: the test i18n mock returns the bare key when a call supplies no
// defaultValue, so asserting on a composed title would pass regardless of what
// the resolver returned — a test that cannot fail.
// ---------------------------------------------------------------------------
describe('queueEntityLabel — never returns a raw row id', () => {
  const { queueEntityLabel } = require('../aiActionQueueService');
  const customers = [
    { id: 'cust-005', name: 'Hotel NH' },
    { id: 'cust-003', name: 'Bakkerij Smit' },
  ];
  const ID_SHAPED = /^(?:j|q|inv|cust|c)-/;

  test('prefers the document reference', () => {
    expect(queueEntityLabel(
      { id: 'inv-seed-1', reference: 'F-2026-014', customerId: 'cust-005', customer: 'Hotel NH' },
      customers,
    )).toBe('F-2026-014');
  });

  test('falls back to the job title for quotes', () => {
    expect(queueEntityLabel(
      { id: 'q-104', customerId: 'cust-003', customer: 'Bakkerij Smit', job: 'Keuken schilderen' },
      customers,
    )).toBe('Keuken schilderen');
  });

  test('resolves the customer name from customerId when nothing better exists', () => {
    expect(queueEntityLabel({ id: 'inv-9', customerId: 'cust-005' }, customers)).toBe('Hotel NH');
  });

  test('rejects a customer field that actually holds an id', () => {
    const label = queueEntityLabel({ id: 'inv-9', customer: 'cust-003' }, []);
    expect(label).not.toMatch(ID_SHAPED);
    expect(label).toBe('');
  });

  test('never returns the row id itself, for any shape', () => {
    const shapes = [
      { id: 'inv-seed-1' },
      { id: 'q-104', customer: 'c-77' },
      { id: 'j-3', customerId: 'cust-unknown' },
      {},
      null,
      undefined,
    ];
    for (const shape of shapes) {
      const label = queueEntityLabel(shape as any, customers);
      expect(label).not.toMatch(ID_SHAPED);
      if (shape && (shape as any).id) expect(label).not.toContain((shape as any).id);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-producer duplicate suppression
// ---------------------------------------------------------------------------
describe('addToQueue cross-producer entity dedup', () => {
  beforeEach(() => clearStorage());

  test('two generators proposing the same invoice for one job → ONE card', async () => {
    // Regression: EVE used `eve-draft_invoice-j-4`, populateQueue used
    // `invoice-for-job:j-4` — different keys, same work, two cards.
    await addToQueue({
      type: 'draft_invoice', title: 'Factuur opstellen voor Lekkage', description: 'd',
      preparedData: { jobId: 'j-4' }, actionLabel: 'Maak', estimatedImpact: '€280',
      entityKey: 'eve-draft_invoice-j-4', sourceGeneratorId: 'eve-agent',
    });
    await addToQueue({
      type: 'draft_invoice', title: 'Factuur voor Lekkage', description: 'd',
      preparedData: { jobId: 'j-4' }, actionLabel: 'Maak', estimatedImpact: '€280',
      entityKey: 'invoice-for-job:j-4',
    });
    const q = await getQueue();
    expect(q).toHaveLength(1);
  });

  test('different jobs still produce their own actionable cards', async () => {
    await addToQueue({
      type: 'draft_invoice', title: 'A', description: 'd', preparedData: { jobId: 'j-1' },
      actionLabel: 'Maak', estimatedImpact: '€1', entityKey: 'eve-draft_invoice-j-1', sourceGeneratorId: 'eve-agent',
    });
    await addToQueue({
      type: 'draft_invoice', title: 'B', description: 'd', preparedData: { jobId: 'j-2' },
      actionLabel: 'Maak', estimatedImpact: '€2', entityKey: 'invoice-for-job:j-2',
    });
    const q = await getQueue();
    // Same generator-less/EVE split means no sibling merge; both remain.
    expect(q.length + (q[0]?.count ?? 0)).toBeGreaterThanOrEqual(2);
  });

  test('progress_note is EXCLUDED — distinct messages for one job survive', async () => {
    // job-started and appointment-reminder share a jobId but are different
    // customer messages; collapsing them would silently drop real work.
    await addToQueue({
      type: 'progress_note', title: 'Werk gestart', description: 'd',
      preparedData: { jobId: 'j-9', template: 'we zijn begonnen' },
      actionLabel: 'Stuur', estimatedImpact: 'x',
      entityKey: 'eve-progress_update-j-9-started', sourceGeneratorId: 'eve-agent-a',
    });
    await addToQueue({
      type: 'progress_note', title: 'Afspraak morgen', description: 'd',
      preparedData: { jobId: 'j-9', template: 'herinnering afspraak' },
      actionLabel: 'Stuur', estimatedImpact: 'x',
      entityKey: 'eve-progress_update-j-9-appt', sourceGeneratorId: 'eve-agent-b',
    });
    const q = await getQueue();
    expect(q).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Change notification — regression: a fresh install showed an empty AI queue
// until app restart, because the hook read once on mount and the background
// scheduler populated the queue seconds later.
// ---------------------------------------------------------------------------
describe('queue change notification', () => {
  beforeEach(() => clearStorage());

  const item = (over: Partial<QueueItem> = {}) => ({
    type: 'draft_invoice' as const,
    title: 'T',
    description: 'd',
    preparedData: {},
    actionLabel: 'Maak',
    estimatedImpact: '€1',
    ...over,
  });

  test('adding an item notifies subscribers', async () => {
    const { addToQueue, subscribeQueueChanges } = require('../aiActionQueueService');
    let calls = 0;
    const unsub = subscribeQueueChanges(() => { calls++; });
    await addToQueue(item({ entityKey: 'e1' }));
    await new Promise((r) => setTimeout(r, 300));
    unsub();
    expect(calls).toBeGreaterThan(0);
  });

  test('a burst of inserts is coalesced into a single notification', async () => {
    // populateQueue adds ~10 items in a loop; that must not trigger 10 re-reads.
    const { addToQueue, subscribeQueueChanges } = require('../aiActionQueueService');
    let calls = 0;
    const unsub = subscribeQueueChanges(() => { calls++; });
    for (let i = 0; i < 8; i++) {
      await addToQueue(item({ entityKey: `burst-${i}`, sourceGeneratorId: `gen-${i}` }));
    }
    await new Promise((r) => setTimeout(r, 300));
    unsub();
    expect(calls).toBe(1);
  });

  test('unsubscribing stops delivery', async () => {
    const { addToQueue, subscribeQueueChanges } = require('../aiActionQueueService');
    let calls = 0;
    const unsub = subscribeQueueChanges(() => { calls++; });
    unsub();
    await addToQueue(item({ entityKey: 'e2' }));
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toBe(0);
  });

  test('a throwing subscriber does not prevent the others from running', async () => {
    const { addToQueue, subscribeQueueChanges } = require('../aiActionQueueService');
    let good = 0;
    const u1 = subscribeQueueChanges(() => { throw new Error('bad subscriber'); });
    const u2 = subscribeQueueChanges(() => { good++; });
    await addToQueue(item({ entityKey: 'e3' }));
    await new Promise((r) => setTimeout(r, 300));
    u1(); u2();
    expect(good).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// One collections card per invoice
// ---------------------------------------------------------------------------
// A Dutch device showed three cards for one overdue €350 invoice, each with its
// own advice: the EVE auditor's "laatste aanmaning aanbevolen" (review), the
// generic "Herinnering voor F-2026-0041", and "Incasso Automatisch: Hotel NH".
describe('addToQueue — one collections card per invoice', () => {
  beforeEach(() => clearStorage());

  const eveAlert = (invoiceId: string) => ({
    type: 'late_payment_risk_alert' as const, title: `Factuur ${invoiceId} 14d te laat`, description: 'laatste aanmaning aanbevolen',
    preparedData: { invoiceId, daysOverdue: 14 }, actionLabel: 'Bekijken', estimatedImpact: '€350',
    entityKey: `eve-compliance_gap-${invoiceId}`, sourceGeneratorId: 'eve-auditor',
  });
  const reminder = (invoiceId: string) => ({
    type: 'draft_reminder' as const, title: `Herinnering voor ${invoiceId}`, description: '€350 achterstallig',
    preparedData: { invoiceId }, actionLabel: 'Herinnering versturen', estimatedImpact: 'x',
    entityKey: `reminder-for-invoice:${invoiceId}`, sourceGeneratorId: 'automation_draft_reminder',
  });
  const packStep = (invoiceId: string) => ({
    type: 'draft_reminder' as const, title: 'Incasso Automatisch: Hotel NH', description: 'Beste Hotel NH, …',
    preparedData: { invoiceId, entityId: invoiceId, template: 'Beste Hotel NH, …', packId: 'incasso' }, actionLabel: 'Verstuur', estimatedImpact: 'x',
    sourceGeneratorId: 'workflow_incasso',
  });

  test('three producers, one invoice → one card, and it is the one you can send', async () => {
    await addToQueue(reminder('inv-1'));
    await addToQueue(eveAlert('inv-1'));
    await addToQueue(packStep('inv-1'));
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].sourceGeneratorId).toBe('workflow_incasso');
  });

  test('order does not matter', async () => {
    await addToQueue(packStep('inv-1'));
    await addToQueue(reminder('inv-1'));
    await addToQueue(eveAlert('inv-1'));
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].sourceGeneratorId).toBe('workflow_incasso');
  });

  test('a reminder replaces a review-only alert for the same invoice', async () => {
    await addToQueue(eveAlert('inv-1'));
    await addToQueue(reminder('inv-1'));
    const q = await getQueue();
    expect(q).toHaveLength(1);
    expect(q[0].type).toBe('draft_reminder');
  });

  test('two overdue invoices keep a card each — never folded into "+1"', async () => {
    await addToQueue(reminder('inv-1'));
    await addToQueue(reminder('inv-2'));
    const q = await getQueue();
    expect(q).toHaveLength(2);
    expect(q.every((i) => (i.count ?? 1) === 1)).toBe(true);
  });

  test('a legacy card that already speaks for other invoices is not deleted', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('@vasco_ai_queue', JSON.stringify([{
      ...reminder('inv-1'), id: 'q-legacy', status: 'pending', createdAt: new Date().toISOString(),
      count: 2, mergedKeys: ['reminder-for-invoice:inv-2'],
    }]));
    await addToQueue(packStep('inv-1'));
    const q = await getQueue();
    expect(q.some((i) => i.id === 'q-legacy')).toBe(true);
  });

  test('cards about other things are untouched', async () => {
    await addToQueue(packStep('inv-1'));
    await addToQueue({
      type: 'draft_invoice', title: 'Factuur voor Lekkage', description: 'd', preparedData: { jobId: 'j-4' },
      actionLabel: 'Maak', estimatedImpact: '€280', entityKey: 'invoice-for-job:j-4',
    });
    expect(await getQueue()).toHaveLength(2);
  });
});

describe('addToQueue — an invoice chased moments ago is covered', () => {
  beforeEach(() => clearStorage());

  test('approving the incasso card keeps the "final notice" alert from coming straight back', async () => {
    const { approveItem } = require('../aiActionQueueService');
    const id = await addToQueue({
      type: 'draft_reminder', title: 'Incasso Automatisch: Hotel NH', description: 'x',
      preparedData: { invoiceId: 'inv-1', template: 'x' }, actionLabel: 'Verstuur', estimatedImpact: 'x',
      sourceGeneratorId: 'workflow_incasso',
    });
    await approveItem(id);
    await addToQueue({
      type: 'late_payment_risk_alert', title: 'Factuur 14d te laat', description: 'laatste aanmaning aanbevolen',
      preparedData: { invoiceId: 'inv-1' }, actionLabel: 'Bekijken', estimatedImpact: 'x',
      entityKey: 'eve-compliance_gap-inv-1', sourceGeneratorId: 'eve-auditor',
    });
    const pending = await getQueue();
    expect(pending.filter((q: any) => q.preparedData?.invoiceId === 'inv-1')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// A card is only shown while its target exists
// ---------------------------------------------------------------------------
// The French demo queue showed Dutch seed invoices ("Rappel pour F-2026-0041").
describe('queueTargetExists', () => {
  const { queueTargetExists } = require('../aiActionQueueService');
  const entities = {
    jobs: [{ id: 'j-fr-1' }],
    invoices: [{ id: 'FA-2026-0087' }],
    quotes: [{ id: 'DE-2026-0012' }],
  };

  test('a card for an invoice this contractor does not have is hidden', () => {
    expect(queueTargetExists({ preparedData: { invoiceId: 'F-2026-0041' } }, entities)).toBe(false);
    expect(queueTargetExists({ preparedData: { jobId: 'j-seed-4' } }, entities)).toBe(false);
    expect(queueTargetExists({ preparedData: { quoteId: 'q-seed-1' } }, entities)).toBe(false);
  });

  test('a card for an entity they do have is shown', () => {
    expect(queueTargetExists({ preparedData: { invoiceId: 'FA-2026-0087' } }, entities)).toBe(true);
    expect(queueTargetExists({ preparedData: { jobId: 'j-fr-1', quoteId: 'DE-2026-0012' } }, entities)).toBe(true);
  });

  test('a card that names no entity is shown', () => {
    expect(queueTargetExists({ preparedData: { template: 'x' } }, entities)).toBe(true);
    expect(queueTargetExists({ preparedData: undefined }, entities)).toBe(true);
  });
});

describe('rekeyQueueTargets — a card follows its entity through an id change', () => {
  beforeEach(() => clearStorage());

  test('temp job id and offline invoice number are both rewritten', async () => {
    const { rekeyQueueTargets } = require('../aiActionQueueService');
    await addToQueue({
      type: 'draft_invoice', title: 'Factuur', description: 'd', preparedData: { jobId: 'j-1700' },
      actionLabel: 'Maak', estimatedImpact: 'x', entityKey: 'invoice-for-job:j-1700',
    });
    await addToQueue({
      type: 'draft_reminder', title: 'Herinnering', description: 'd', preparedData: { invoiceId: 'I-OFF-9' },
      actionLabel: 'Stuur', estimatedImpact: 'x', entityKey: 'reminder-for-invoice:I-OFF-9',
    });
    await rekeyQueueTargets('j-1700', 'b8c1-uuid');
    await rekeyQueueTargets('I-OFF-9', 'I0042');
    const q = await getQueue();
    expect(q.some((i) => i.preparedData.jobId === 'b8c1-uuid')).toBe(true);
    expect(q.some((i) => i.preparedData.invoiceId === 'I0042')).toBe(true);
    expect(q.some((i) => i.preparedData.jobId === 'j-1700' || i.preparedData.invoiceId === 'I-OFF-9')).toBe(false);
  });
});
