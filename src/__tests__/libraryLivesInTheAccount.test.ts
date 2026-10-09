/**
 * The pricebook, own quote templates and job forms live in the ACCOUNT
 * (UK re-walk W190, user decision 2026-10-09). They were AsyncStorage-only and
 * logout wipes AsyncStorage: a contractor lost the price list on every logout,
 * reinstall or new phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRows: Array<{ user_id: string; kind: string; item_id: string; data: any; updated_at: string }> = [];
let mockUid: string | null = 'user-a';
let mockOnPull: (() => void) | null = null;
let mockOffline = false;

jest.mock('../lib/currentUser', () => ({ getAuthedUserId: () => mockUid, subscribeUserChange: () => () => {} }));
jest.mock('../services/offlineWriteQueue', () => ({
  persistOrQueue: async (_t: string, _op: string, run: () => Promise<void>) => { await run(); },
}));
jest.mock('../lib/supabase', () => {
  const from = () => {
    const filters: Record<string, string> = {};
    const q: any = {
      select: () => q,
      eq: (c: string, v: string) => { filters[c] = v; return q; },
      then: (res: any, rej: any) =>
        Promise.resolve().then(() => mockOnPull?.()).then(() => ({ data: mockRows.filter((r) => r.user_id === filters.user_id && r.kind === filters.kind), error: null })).then(res, rej),
      upsert: async (row: any) => {
        if (mockOffline) return { error: { message: 'offline' } };
        const i = mockRows.findIndex((r) => r.user_id === row.user_id && r.kind === row.kind && r.item_id === row.item_id);
        if (i >= 0) mockRows[i] = row; else mockRows.push(row);
        return { error: null };
      },
    };
    return q;
  };
  return { supabase: { from }, isSupabaseConfigured: true };
});

import { mergeLibrary, syncLibraryList, pushLibraryItem, deleteLibraryItem } from '../services/userLibrarySync';
import { syncPricebook, savePricebook, loadPricebook } from '../services/pricebookService';

const at = (d: string) => `2026-10-0${d}T10:00:00.000Z`;

beforeEach(async () => { mockRows.length = 0; mockUid = 'user-a'; mockOnPull = null; mockOffline = false; await AsyncStorage.clear(); });

describe('mergeLibrary', () => {
  it('keeps the newer copy, either side', () => {
    const { merged, toPush } = mergeLibrary(
      [{ id: 'a', updatedAt: at('5'), v: 'local' }, { id: 'b', updatedAt: at('1'), v: 'local' }] as any[],
      [{ item_id: 'a', data: { id: 'a', updatedAt: at('2'), v: 'remote' } }, { item_id: 'b', data: { id: 'b', updatedAt: at('3'), v: 'remote' } }],
    );
    expect(merged.find((x: any) => x.id === 'a').v).toBe('local');
    expect(merged.find((x: any) => x.id === 'b').v).toBe('remote');
    expect(toPush.map((x) => x.id)).toEqual(['a']);
  });

  it('a deletion on another phone removes the item here (tombstone beats an older copy)', () => {
    const { merged, toPush } = mergeLibrary(
      [{ id: 'a', updatedAt: at('1') }],
      [{ item_id: 'a', data: { _deleted: true, updatedAt: at('2') } }],
    );
    expect(merged).toEqual([]);
    expect(toPush).toEqual([]);
  });

  it('an item the account never saw is uploaded; a remote-only one comes down', () => {
    const { merged, toPush } = mergeLibrary(
      [{ id: 'local-only', updatedAt: at('1') }],
      [{ item_id: 'remote-only', data: { id: 'remote-only', updatedAt: at('1') } }],
    );
    expect(merged.map((x) => x.id).sort()).toEqual(['local-only', 'remote-only']);
    expect(toPush.map((x) => x.id)).toEqual(['local-only']);
  });
});

describe('the pricebook survives a logout', () => {
  it('an empty device (logout / new phone) gets the account’s price list back', async () => {
    const entry = { id: 'pb1', name: 'Boiler service', unitPrice: 95, updatedAt: at('1') };
    await pushLibraryItem('pricebook_item', 'pb1', entry);
    await AsyncStorage.clear(); // what sessionCleanup does on logout
    expect(await loadPricebook()).toEqual([]);
    const merged = await syncPricebook();
    expect(merged?.map((e) => e.id)).toEqual(['pb1']);
    expect((await loadPricebook()).map((e) => e.id)).toEqual(['pb1']);
  });

  it('a deleted item does not come back', async () => {
    await pushLibraryItem('pricebook_item', 'pb1', { id: 'pb1', updatedAt: at('1') });
    await deleteLibraryItem('pricebook_item', 'pb1');
    await AsyncStorage.clear();
    expect(await syncPricebook()).toEqual([]);
  });

  it('another account’s library is never merged in', async () => {
    await pushLibraryItem('pricebook_item', 'pb1', { id: 'pb1', updatedAt: at('1') });
    mockUid = 'user-b';
    expect(await syncPricebook()).toEqual([]);
  });

  it('a logout/switch while the pull is out: the old account’s rows are not merged into the new one', async () => {
    await pushLibraryItem('pricebook_item', 'pb1', { id: 'pb1', updatedAt: at('1') });
    mockOnPull = () => { mockUid = 'user-b'; };
    expect(await syncPricebook()).toBeNull();
    expect(await loadPricebook()).toEqual([]);
  });

  it('an edit made while the pull was out is not overwritten by the merge', async () => {
    await savePricebook([{ id: 'old', updatedAt: at('1') } as any]);
    const merged = await syncLibraryList('pricebook_item', async () => {
      // The device copy is read AFTER the pull — this edit landed meanwhile.
      return [{ id: 'old', updatedAt: at('1') }, { id: 'typed-during-pull', updatedAt: at('2') }];
    });
    expect(merged?.map((e) => e.id).sort()).toEqual(['old', 'typed-during-pull']);
  });
});

/** A fresh app start: new module instances over the same (mocked) account. */
const freshQuoteTemplates = () => {
  let svc: any;
  jest.isolateModules(() => { svc = require('../services/quoteTemplateService').quoteTemplateService; });
  return svc;
};

describe('own quote templates survive a logout', () => {
  it('a saved template and a deleted built-in come back from the account on a new phone', async () => {
    const first = freshQuoteTemplates();
    await first.syncFromAccount();
    const mine = first.saveTemplate('Bathroom refit', 'badkamer', [{ description: 'Labour', quantity: 8, unit: 'h', unitPrice: 55, vatRate: 20, type: 'labor' }]);
    const builtin = first.getTemplates(undefined, 'NL').find((t: any) => t.i18nId);
    first.deleteTemplate(builtin.id);
    await new Promise((r) => setImmediate(r)); // let the queued pushes land

    await AsyncStorage.clear(); // logout
    const second = freshQuoteTemplates();
    await second.syncFromAccount();
    const ids = second.getTemplates(undefined, 'NL').map((t: any) => t.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(builtin.id);
    expect(second.getTemplate(mine.id).createdAt).toBeInstanceOf(Date);
  });

  it('a deleted own template stays deleted', async () => {
    const first = freshQuoteTemplates();
    await first.syncFromAccount();
    const mine = first.saveTemplate('Temp', 'badkamer', []);
    first.deleteTemplate(mine.id);
    await new Promise((r) => setImmediate(r));
    await AsyncStorage.clear();
    const second = freshQuoteTemplates();
    await second.syncFromAccount();
    expect(second.getTemplate(mine.id)).toBeUndefined();
  });
});

describe('job forms survive a logout', () => {
  it('a filled-in form comes back for its job', async () => {
    const { saveResponse, flushPendingResponsePushes } = require('../services/jobFormService');
    await saveResponse({ id: 'r1', jobId: 'job-1', templateId: 't1', templateName: 'Gas safety', answers: [], updatedAt: at('1') });
    // Logout right after typing: the waiting push is sent before the wipe.
    await flushPendingResponsePushes();
    await AsyncStorage.clear();
    let responsesForJob: any;
    jest.isolateModules(() => { ({ responsesForJob } = require('../services/jobFormService')); });
    expect((await responsesForJob('job-1')).map((r: any) => r.id)).toEqual(['r1']);
  });
});

/** Mount a hook with react-test-renderer and hand back its latest value. */
function mountHook<T>(useIt: () => T): { current: () => T } {
  const React = require('react');
  const { create, act } = require('react-test-renderer');
  let value: T;
  const Probe = () => { value = useIt(); return null; };
  act(() => { create(React.createElement(Probe)); });
  return { current: () => value };
}
const { act: rtrAct } = require('react-test-renderer');

describe('the editors write to the account', () => {
  it('a pricebook entry saved and deleted in the editor reaches the account each time', async () => {
    const { usePricebook } = require('../services/pricebookService');
    const h = mountHook(usePricebook);
    // Let the mount's sync finish first: it uploads whatever the device holds,
    // which would hide a save that never pushed.
    await rtrAct(async () => { await new Promise((r) => setImmediate(r)); });
    await rtrAct(async () => { await (h.current() as any).upsert({ id: 'pb9', name: 'Callout', unitPrice: 60, unit: 'stuk', category: 'labor' }); });
    await new Promise((r) => setImmediate(r));
    expect(mockRows.find((r) => r.item_id === 'pb9')?.data.name).toBe('Callout');
    await rtrAct(async () => { await (h.current() as any).remove('pb9'); });
    await new Promise((r) => setImmediate(r));
    expect(mockRows.find((r) => r.item_id === 'pb9')?.data._deleted).toBe(true);
  });

  it('a job form saved and deleted in the editor reaches the account each time', async () => {
    const { useJobFormTemplates } = require('../services/jobFormService');
    const h = mountHook(useJobFormTemplates);
    await rtrAct(async () => { await new Promise((r) => setImmediate(r)); });
    await rtrAct(async () => { await (h.current() as any).upsert({ id: 'f1', name: 'Gas check', fields: [] }); });
    await new Promise((r) => setImmediate(r));
    expect(mockRows.find((r) => r.item_id === 'f1')?.data.name).toBe('Gas check');
    await rtrAct(async () => { await (h.current() as any).remove('f1'); });
    await new Promise((r) => setImmediate(r));
    expect(mockRows.find((r) => r.item_id === 'f1')?.data._deleted).toBe(true);
  });
});

describe('quote template edits reach the account at once', () => {
  const pushed = (id: string) => mockRows.find((r) => r.kind === 'quote_template' && r.item_id === id)?.data;

  it('editing an own template pushes the edit', async () => {
    const svc = freshQuoteTemplates();
    await svc.syncFromAccount();
    const mine = svc.saveTemplate('Boiler', 'badkamer', []);
    await new Promise((r) => setImmediate(r));
    svc.updateTemplate(mine.id, { name: 'Boiler service' });
    await new Promise((r) => setImmediate(r));
    expect(pushed(mine.id)?.name).toBe('Boiler service');
  });

  it('overriding a built-in pushes the override and hides the built-in in the account', async () => {
    const svc = freshQuoteTemplates();
    await svc.syncFromAccount();
    const builtin = svc.getTemplates(undefined, 'NL').find((t: any) => t.i18nId);
    const override = svc.updateTemplate(builtin.id, { name: 'My version' });
    await new Promise((r) => setImmediate(r));
    expect(pushed(override.id)?.name).toBe('My version');
    const meta = mockRows.find((r) => r.kind === 'quote_template_meta')?.data;
    expect(meta.deletedBuiltinIds).toContain(builtin.id);
  });

  it('an account switch during the sync leaves the new account’s templates alone', async () => {
    const a = freshQuoteTemplates();
    await a.syncFromAccount();
    a.saveTemplate('A-only', 'badkamer', []);
    await new Promise((r) => setImmediate(r));
    await AsyncStorage.clear();
    const b = freshQuoteTemplates();
    mockOnPull = () => { mockUid = 'user-b'; };
    await b.syncFromAccount();
    mockOnPull = null;
    expect(b.getTemplates(undefined, 'UK').map((t: any) => t.name)).not.toContain('A-only');
  });
});

describe('review 2026-10-09', () => {
  it('a deletion made offline is not undone by the next pull, and is said again', async () => {
    await pushLibraryItem('pricebook_item', 'pb1', { id: 'pb1', updatedAt: at('1') });
    await savePricebook([{ id: 'pb1', updatedAt: at('1') } as any]);
    mockOffline = true;                       // the tombstone does not reach the account
    await deleteLibraryItem('pricebook_item', 'pb1');
    await savePricebook([]);
    mockOffline = false;
    expect(await syncPricebook()).toEqual([]); // not resurrected
    await new Promise((r) => setImmediate(r));
    expect(mockRows.find((r) => r.item_id === 'pb1')?.data._deleted).toBe(true); // re-sent
  });

  it('the EDIT time decides, not when a copy happened to be pushed', () => {
    const { merged } = mergeLibrary(
      [{ id: 'a', updatedAt: at('5'), v: 'newer edit here' }] as any[],
      [{ item_id: 'a', data: { id: 'a', updatedAt: at('2'), v: 'older edit' }, updated_at: at('9') }],
    );
    expect((merged[0] as any).v).toBe('newer edit here');
  });

  it('a quote template saved while the first sync is out is kept', async () => {
    const svc = freshQuoteTemplates();
    let saved: any;
    // Offline for that moment: the template exists only on this device, so the
    // merge must read the device AFTER the pull to keep it.
    mockOnPull = () => { if (!saved) { mockOffline = true; saved = svc.saveTemplate('Typed during sync', 'badkamer', []); } };
    await svc.syncFromAccount();
    mockOnPull = null;
    mockOffline = false;
    expect(svc.getTemplates(undefined, 'UK').map((t: any) => t.name)).toContain('Typed during sync');
  });

  it('a form filled while typing is pushed once when typing settles, at once when completed', async () => {
    jest.useFakeTimers();
    try {
      const { saveResponse, RESPONSE_PUSH_DELAY_MS } = require('../services/jobFormService');
      const base = { id: 'r9', jobId: 'j', templateId: 't', templateName: 'Gas', answers: [] };
      for (let i = 0; i < 5; i++) await saveResponse({ ...base, updatedAt: at('1'), answers: [{ i }] });
      const pushes = () => mockRows.filter((r) => r.item_id === 'r9').length;
      expect(pushes()).toBe(0);
      jest.advanceTimersByTime(RESPONSE_PUSH_DELAY_MS + 1);
      jest.useRealTimers();
      await new Promise((r) => setImmediate(r));
      expect(mockRows.find((r) => r.item_id === 'r9')?.data.answers).toEqual([{ i: 4 }]);
      await saveResponse({ ...base, updatedAt: at('2'), completedAt: at('2') });
      await new Promise((r) => setImmediate(r));
      expect(mockRows.find((r) => r.item_id === 'r9')?.data.completedAt).toBe(at('2'));
    } finally {
      jest.useRealTimers();
    }
  });
});

it('logout sends waiting job-form pushes BEFORE signing out (the wipe follows)', () => {
  const fs = require('fs'); const path = require('path');
  const { stripComments } = require('../utils/stripComments');
  const auth = stripComments(fs.readFileSync(path.resolve(__dirname, '../context/AuthContext.tsx'), 'utf8'));
  const flush = auth.indexOf('flushPendingResponsePushes()');
  expect(flush).toBeGreaterThan(-1);
  expect(flush).toBeLessThan(auth.indexOf('await supabase.auth.signOut();'));
});
