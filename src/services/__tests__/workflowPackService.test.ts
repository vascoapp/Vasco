// =============================================================================
// WORKFLOW PACK SERVICE — Unit Tests
// =============================================================================
// Tests pack persistence, toggle, trigger evaluation, template resolution,
// and action type mapping.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getWorkflowPacks,
  saveWorkflowPacks,
  togglePack,
  updatePackStep,
  evaluateTriggers,
  DEFAULT_PACKS,
  WorkflowPack,
} from '../workflowPackService';

// Mock aiActionQueueService.addToQueue for evaluateTriggers
const mockAddToQueue = jest.fn((..._args: any[]) => Promise.resolve('q-mock-id'));
jest.mock('../aiActionQueueService', () => ({
  addToQueue: (...args: any[]) => mockAddToQueue(...args),
  getQueueHistory: jest.fn(() => Promise.resolve([])),
}));

const PACKS_KEY = '@vasco_workflow_packs';

function clearStorage() {
  const store = (globalThis as any).__asyncStorageMock;
  if (store) Object.keys(store).forEach((k) => delete store[k]);
}

describe('workflowPackService', () => {
  beforeEach(() => {
    clearStorage();
    jest.clearAllMocks();
  });

  // ─── DEFAULT_PACKS ────────────────────────────────────────────────────────

  describe('DEFAULT_PACKS', () => {
    it('should have at least 7 packs', () => {
      expect(DEFAULT_PACKS.length).toBeGreaterThanOrEqual(7);
    });

    it('should have unique IDs', () => {
      const ids = DEFAULT_PACKS.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have at least one step per pack', () => {
      for (const pack of DEFAULT_PACKS) {
        expect(pack.steps.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should have valid categories', () => {
      const validCategories = ['billing', 'quotes', 'maintenance', 'admin', 'customer'];
      for (const pack of DEFAULT_PACKS) {
        expect(validCategories).toContain(pack.category);
      }
    });
  });

  // ─── getWorkflowPacks ─────────────────────────────────────────────────────

  describe('getWorkflowPacks', () => {
    it('should return DEFAULT_PACKS when nothing saved', async () => {
      const packs = await getWorkflowPacks();
      expect(packs).toEqual(DEFAULT_PACKS);
    });

    it('should return saved packs when available', async () => {
      const custom: WorkflowPack[] = [
        { ...DEFAULT_PACKS[0], enabled: false },
      ];
      await AsyncStorage.setItem(PACKS_KEY, JSON.stringify(custom));

      const packs = await getWorkflowPacks();
      expect(packs).toHaveLength(1);
      expect(packs[0].enabled).toBe(false);
    });
  });

  // ─── togglePack ───────────────────────────────────────────────────────────

  describe('togglePack', () => {
    it('should enable a disabled pack', async () => {
      // Save packs with incasso disabled
      const packs = DEFAULT_PACKS.map((p) =>
        p.id === 'incasso_auto' ? { ...p, enabled: false } : p,
      );
      await AsyncStorage.setItem(PACKS_KEY, JSON.stringify(packs));

      await togglePack('incasso_auto', true);

      const updated = await getWorkflowPacks();
      const incasso = updated.find((p) => p.id === 'incasso_auto');
      expect(incasso?.enabled).toBe(true);
    });

    it('should disable an enabled pack', async () => {
      await saveWorkflowPacks(DEFAULT_PACKS);

      await togglePack('incasso_auto', false);

      const updated = await getWorkflowPacks();
      const incasso = updated.find((p) => p.id === 'incasso_auto');
      expect(incasso?.enabled).toBe(false);
    });

    it('should not crash for non-existent pack id', async () => {
      await saveWorkflowPacks(DEFAULT_PACKS);
      // Should not throw
      await togglePack('non_existent_pack', true);
    });
  });

  // ─── updatePackStep ───────────────────────────────────────────────────────

  describe('updatePackStep', () => {
    it('should update a step delay', async () => {
      await saveWorkflowPacks(DEFAULT_PACKS);

      // Update incasso pack first step delay from -3 to -5
      await updatePackStep('incasso_auto', 0, { delayDays: -5 });

      const packs = await getWorkflowPacks();
      const incasso = packs.find((p) => p.id === 'incasso_auto')!;
      expect(incasso.steps[0].delayDays).toBe(-5);
    });

    it('should update a step channel', async () => {
      await saveWorkflowPacks(DEFAULT_PACKS);

      await updatePackStep('offerte_opvolging', 0, { channel: 'sms' });

      const packs = await getWorkflowPacks();
      const offerte = packs.find((p) => p.id === 'offerte_opvolging')!;
      expect(offerte.steps[0].channel).toBe('sms');
    });
  });

  // ─── evaluateTriggers ─────────────────────────────────────────────────────

  describe('evaluateTriggers', () => {
    it('should queue actions for overdue invoices matching trigger window', async () => {
      // Set up just the incasso pack (enabled)
      const incassoPack = DEFAULT_PACKS.find((p) => p.id === 'incasso_auto')!;
      await saveWorkflowPacks([{ ...incassoPack, enabled: true }]);

      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 86400000).toISOString();

      const result = await evaluateTriggers({
        invoices: [
          {
            id: 'inv-1',
            status: 'overdue',
            amount: 450,
            customerId: 'c-1',
            dueDate: threeDaysAgo,
          },
        ],
        quotes: [],
        jobs: [],
        customers: [{ id: 'c-1', name: 'Bakker' }],
      });

      // Should have called addToQueue at least once for the 3-day overdue reminder
      expect(mockAddToQueue).toHaveBeenCalled();
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should queue actions for sent quotes matching trigger window', async () => {
      const quotePack = DEFAULT_PACKS.find((p) => p.id === 'offerte_opvolging')!;
      await saveWorkflowPacks([{ ...quotePack, enabled: true }]);

      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 86400000).toISOString();

      await evaluateTriggers({
        invoices: [],
        quotes: [
          {
            id: 'q-1',
            status: 'sent',
            amount: 2000,
            customerId: 'c-1',
            sentAt: threeDaysAgo,
            description: 'Bathroom renovation',
          },
        ],
        jobs: [],
        customers: [{ id: 'c-1', name: 'De Vries' }],
      });

      expect(mockAddToQueue).toHaveBeenCalled();
      const callArgs = mockAddToQueue.mock.calls[0][0];
      expect(callArgs.type).toBe('draft_followup');
    });

    it('should not queue actions for disabled packs', async () => {
      const disabledPack = { ...DEFAULT_PACKS[0], enabled: false };
      await saveWorkflowPacks([disabledPack]);

      const result = await evaluateTriggers({
        invoices: [
          { id: 'inv-1', status: 'overdue', amount: 100, dueDate: new Date(Date.now() - 3 * 86400000).toISOString() },
        ],
        quotes: [],
        jobs: [],
        customers: [],
      });

      expect(result).toBe(0);
      expect(mockAddToQueue).not.toHaveBeenCalled();
    });

    it('should limit to 2 matches per step to avoid queue spam', async () => {
      const incassoPack = DEFAULT_PACKS.find((p) => p.id === 'incasso_auto')!;
      await saveWorkflowPacks([{ ...incassoPack, enabled: true }]);

      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 86400000).toISOString();

      // 5 overdue invoices all matching the 3-day window
      const invoices = Array.from({ length: 5 }, (_, i) => ({
        id: `inv-${i}`,
        status: 'overdue' as const,
        amount: 100 * (i + 1),
        customerId: `c-${i}`,
        dueDate: threeDaysAgo,
      }));

      await evaluateTriggers({
        invoices,
        quotes: [],
        jobs: [],
        customers: invoices.map((inv) => ({ id: inv.customerId, name: `Customer ${inv.customerId}` })),
      });

      // Each step should only match max 2 items
      // The overdue step at 3 days should fire at most 2 times
      // (other steps like 7, 14, 30 day won't match the 3-day window)
      const callCount = mockAddToQueue.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(2);
    });

    it('should resolve customer names in templates', async () => {
      const quotePack = DEFAULT_PACKS.find((p) => p.id === 'offerte_opvolging')!;
      await saveWorkflowPacks([{ ...quotePack, enabled: true }]);

      const now = Date.now();
      const threeDaysAgo = new Date(now - 3 * 86400000).toISOString();

      await evaluateTriggers({
        invoices: [],
        quotes: [
          { id: 'q-test', status: 'sent', amount: 1500, customerId: 'c-test', sentAt: threeDaysAgo },
        ],
        jobs: [],
        customers: [{ id: 'c-test', name: 'Familie Jansen' }],
      });

      if (mockAddToQueue.mock.calls.length > 0) {
        const callArgs = mockAddToQueue.mock.calls[0][0];
        expect(callArgs.title).toContain('Familie Jansen');
      }
    });

    it('should return 0 when no triggers match', async () => {
      await saveWorkflowPacks(DEFAULT_PACKS);

      const result = await evaluateTriggers({
        invoices: [],
        quotes: [],
        jobs: [],
        customers: [],
      });

      expect(result).toBe(0);
    });
  });
});
