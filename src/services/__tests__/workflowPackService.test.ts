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
  PACK_I18N_NS,
  resolvePackName,
  resolvePackDescription,
  WorkflowPack,
} from '../workflowPackService';

// Mock aiActionQueueService.addToQueue for evaluateTriggers
const mockAddToQueue = jest.fn((..._args: any[]) => Promise.resolve('q-mock-id'));
jest.mock('../aiActionQueueService', () => ({
  addToQueue: (...args: any[]) => mockAddToQueue(...args),
  getQueueHistory: jest.fn(() => Promise.resolve([])),
}));

// R66r49 #5: tier gate added to evaluateTriggers — mock as paid tier so
// the queueing path runs. `hasAutomationPacks: true` matches Advanced+.
jest.mock('../subscriptionService', () => ({
  loadSubscription: jest.fn(() => Promise.resolve({ tier: 'pro', billingCycle: 'monthly' })),
  getTierLimits: jest.fn(() => ({ hasAutomationPacks: true })),
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
    // R66r51: pin wall-clock to a deterministic morning slot. The
    // `daily_17:00` trigger fires when `new Date(now).getHours() >= 17`
    // regardless of input data, so without pinning the system time the
    // `einde_dag` pack's 3 steps fire spuriously after 17:00 local —
    // breaking "should not queue when disabled / no triggers" assertions.
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-10T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── DEFAULT_PACKS ────────────────────────────────────────────────────────

  describe('DEFAULT_PACKS', () => {
    it('should have at least 10 packs', () => {
      // R66r49 #5: floor bumped from 7 → 10 after dailyUpdate / handover /
      // permits packs were added (R306-era). Tests at <10 silently passed
      // while contractors couldn't see the newer packs in their UI.
      expect(DEFAULT_PACKS.length).toBeGreaterThanOrEqual(10);
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

    it('should preserve saved pack state and merge in missing packs', async () => {
      // R66r49 #5: getWorkflowPacks now merges missing packs from
      // DEFAULT_PACKS (by id). A storage list with only 1 pack now
      // returns the user's customized pack + the other 9 defaults,
      // not just the 1. Pre-fix, contractors who saved their pack
      // list before R306 (which added 3 newer packs) had stale arrays
      // missing those packs entirely and couldn't toggle them.
      const custom: WorkflowPack[] = [
        { ...DEFAULT_PACKS[0], enabled: false },
      ];
      await AsyncStorage.setItem(PACKS_KEY, JSON.stringify(custom));

      const packs = await getWorkflowPacks();
      expect(packs).toHaveLength(DEFAULT_PACKS.length);
      // The user's customization on pack 0 must persist.
      expect(packs[0].id).toBe(DEFAULT_PACKS[0].id);
      expect(packs[0].enabled).toBe(false);
      // The other 9 packs should be the defaults.
      expect(packs[1].id).toBe(DEFAULT_PACKS[1].id);
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
  // ─── Localised pack names (walk finding, Android /contractor/automations) ──
  // The card titles rendered `pack.name`, a hardcoded Dutch literal, directly
  // above correctly-translated step labels — an English contractor read
  // "Incasso Automatisch" over "After 3 days: Send friendly reminder".
  //
  // This asserts the locale DATA, not the i18n runtime: jest.setup mocks
  // `src/i18n/i18n` with a `t` that always returns `defaultValue`, so calling
  // resolvePackName() here would return the Dutch literal no matter what the
  // locale files contain. The regression that actually bites is a pack added
  // without keys, or keys added to en/nl only — both are visible in the JSON.
  describe('pack name localisation', () => {
    const LANGS = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;
    const locales: Record<string, any> = {
      en: require('../../i18n/locales/en.json'),
      nl: require('../../i18n/locales/nl.json'),
      de: require('../../i18n/locales/de.json'),
      fr: require('../../i18n/locales/fr.json'),
      es: require('../../i18n/locales/es.json'),
      it: require('../../i18n/locales/it.json'),
    };

    it('maps every default pack to an i18n namespace', () => {
      for (const pack of DEFAULT_PACKS) {
        expect(PACK_I18N_NS[pack.id]).toBeTruthy();
      }
    });

    it('has a name and description for every pack in all six locales', () => {
      for (const lang of LANGS) {
        for (const pack of DEFAULT_PACKS) {
          const ns = locales[lang].workflowPacks[PACK_I18N_NS[pack.id]];
          expect(typeof ns?.name).toBe('string');
          expect(typeof ns?.description).toBe('string');
          expect(ns.name.trim().length).toBeGreaterThan(0);
          expect(ns.description.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('does not leave the Dutch string in the other five locales', () => {
      for (const lang of LANGS.filter((l) => l !== 'nl')) {
        for (const pack of DEFAULT_PACKS) {
          const ns = locales[lang].workflowPacks[PACK_I18N_NS[pack.id]];
          const dutch = locales.nl.workflowPacks[PACK_I18N_NS[pack.id]];
          expect(ns.name).not.toBe(dutch.name);
          expect(ns.description).not.toBe(dutch.description);
        }
      }
    });

    // The resolver keys off `pack.id`, deliberately not off a field on the
    // pack object, so a pack round-tripped through AsyncStorage before this
    // fix still localises. A new field would be undefined for exactly the
    // users who already have the bug.
    it('resolves from the id alone, with no extra fields on the pack', () => {
      expect(resolvePackName({ id: 'incasso_auto', name: 'x' })).toBeTruthy();
      expect(resolvePackDescription({ id: 'incasso_auto', description: 'x' })).toBeTruthy();
    });

    it('degrades to the literal for an unknown pack id', () => {
      expect(resolvePackName({ id: 'made_up', name: 'Fallback' })).toBe('Fallback');
      expect(resolvePackDescription({ id: 'made_up', description: 'Desc' })).toBe('Desc');
    });
  });

  // ─── Appointment reminders (job_scheduled) ────────────────────────────────
  // Every other trigger looks BACKWARDS at something that already happened.
  // This one looks forward, so the cases worth pinning are the ones that would
  // send a customer the wrong thing: a reminder for cancelled work, a reminder
  // on the wrong day, or one with nobody to send it to.
  describe('appointment reminder trigger', () => {
    const dayKey = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const ctx = (jobs: any[]) => ({
      invoices: [], quotes: [], jobs,
      customers: [{ id: 'c1', name: 'Familie de Vries' }],
    });

    const job = (over: any = {}) => ({
      id: 'j1', title: 'Badkamer', customerId: 'c1', status: 'scheduled',
      scheduledDate: dayKey(1), scheduledStartTime: '09:00', ...over,
    });

    beforeEach(() => clearStorage());

    async function queuedTitles(jobs: any[]) {
      mockAddToQueue.mockClear();
      const pack = DEFAULT_PACKS.find((p) => p.id === 'afspraak_herinnering')!;
      await saveWorkflowPacks([{ ...pack, enabled: true }]);
      await evaluateTriggers(ctx(jobs) as any);
      return mockAddToQueue.mock.calls.map((c: any[]) => String(c[0].title));
    }

    it('reminds the customer the day before', async () => {
      const titles = await queuedTitles([job({ scheduledDate: dayKey(1) })]);
      expect(titles.length).toBeGreaterThan(0);
    });

    it('does not remind about a cancelled visit', async () => {
      // "See you tomorrow" for work that was called off is worse than silence.
      expect(await queuedTitles([job({ status: 'cancelled' })])).toHaveLength(0);
    });

    it('does not remind about work already finished', async () => {
      expect(await queuedTitles([job({ status: 'completed' })])).toHaveLength(0);
    });

    it('ignores a visit that is not on the target day', async () => {
      expect(await queuedTitles([job({ scheduledDate: dayKey(5) })])).toHaveLength(0);
    });

    it('skips a job with no customer to remind', async () => {
      // Queueing it would hand the contractor an action they cannot send.
      expect(await queuedTitles([job({ customerId: 'nobody' })])).toHaveLength(0);
    });

    it('skips a job with no scheduled date at all', async () => {
      expect(await queuedTitles([job({ scheduledDate: undefined })])).toHaveLength(0);
    });
  });
});
