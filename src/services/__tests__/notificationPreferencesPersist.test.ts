/**
 * @jest-environment node
 */
// Every switch on the notifications screen lived in memory only: muting
// "Angebot abgelaufen" lasted until the app was next killed, and the screen
// gave no hint of that (#339, sweep 2026-09-16).
//
// The account boundary is the other half. The singleton survives logout, so
// the stored inbox and the stored mute list both have to be gone BEFORE the
// next account hydrates — and the reset used to clear memory and then re-read
// the very same key.
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    // Deliberately SLOW: a removal that has not finished when the next account
    // hydrates is exactly the race being guarded. With an instant mock, code
    // that fires the removal alongside hydrate() looks correct.
    removeItem: jest.fn((k: string) => new Promise<void>((resolve) => {
      setTimeout(() => { mockStore.delete(k); resolve(); }, 20);
    })),
  },
}));

const PREFS_KEY = '@vasco_notification_prefs_v1';
const PERSIST_KEY = '@vasco_notifications_v2';

import { notificationService } from '../notificationService';
import { setCurrentUser } from '../../lib/currentUser';
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

const flush = () => new Promise((r) => setTimeout(r, 0));
/** Long enough for the slow removeItem above to land. */
const settle = () => new Promise((r) => setTimeout(r, 60));

/** The real transition: the singleton's reset is wired to a user change. */
const switchAccountTo = async (id: string) => {
  setCurrentUser({ id });
  await settle();
  await flush();
};

const prefFor = (type: string) => notificationService.getPreferences().find((p) => p.type === type);

describe('notification preferences survive a restart', () => {
  it('a toggle is written to storage', async () => {
    const first = notificationService.getPreferences()[0];
    const before = first.enabled;
    notificationService.togglePreference(first.type, 'enabled');
    await flush();

    expect(prefFor(first.type)?.enabled).toBe(!before);
    const saved = JSON.parse(mockStore.get(PREFS_KEY) ?? '[]');
    expect(saved.find((p: { type: string }) => p.type === first.type).enabled).toBe(!before);
  });

  it('an unknown type in storage does not drop a preference the release added', async () => {
    mockStore.set(PREFS_KEY, JSON.stringify([{ type: 'no_such_type', enabled: false }]));
    // Re-hydrate the way a cold start would.
    await switchAccountTo('user-1');

    // Every default type is still listed — merged by type, not replaced.
    expect(notificationService.getPreferences().length).toBeGreaterThan(0);
    expect(notificationService.getPreferences().some((p) => (p.type as string) === 'no_such_type')).toBe(false);
  });
});

describe('the next account does not inherit the last one', () => {
  it('clears both stored copies before hydrating', async () => {
    mockStore.set(PREFS_KEY, JSON.stringify([{ type: 'overdue_invoice', enabled: false }]));
    mockStore.set(PERSIST_KEY, JSON.stringify([{ id: 'n1', type: 'overdue_invoice', createdAt: new Date().toISOString() }]));

    await switchAccountTo('user-2');

    expect(mockStore.has(PREFS_KEY)).toBe(false);
    expect(mockStore.has(PERSIST_KEY)).toBe(false);
    expect(notificationService.getNotifications?.().length ?? 0).toBe(0);
    // Back to the defaults, not user A's mute.
    expect(prefFor('overdue_invoice')?.enabled).toBe(true);
  });
});

describe('the defaults stay default', () => {
  it('a toggle does not rewrite the template every later account starts from', async () => {
    // `[...defaultPreferences]` copies the ARRAY and shares the OBJECTS, and
    // togglePreference mutates in place — so user A's mute became the default.
    const type = notificationService.getPreferences()[0].type;
    const original = notificationService.getPreferences()[0].enabled;
    notificationService.togglePreference(type, 'enabled');
    await flush();
    expect(prefFor(type)?.enabled).toBe(!original);

    mockStore.clear();
    await switchAccountTo('user-3');
    expect(prefFor(type)?.enabled).toBe(original);
  });
});

describe('nothing starts from a SHARED copy of the defaults', () => {
  // The behavioural test above only exercises the reset path, so it cannot see
  // the field initialiser. This one can: `[...defaultPreferences]` copies the
  // array and shares the objects, and togglePreference mutates them in place.
  // stripComments: the fix's own comment quotes the shape it removed.
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../notificationService.ts'), 'utf8'));

  it('never spreads the defaults array', () => {
    expect(src).not.toMatch(/\[\.\.\.defaultPreferences\]/);
  });

  it('clones every element, at both sites', () => {
    const clones = src.match(/defaultPreferences\.map\(\(p\) => \(\{ \.\.\.p \}\)\)/g) ?? [];
    expect(clones.length).toBe(2);
  });
});

describe('a cold start is not a new account', () => {
  // `currentUserId` starts as the 'current-user' placeholder and becomes the
  // real id the moment AuthContext restores the session, so EVERY launch
  // looked like a user change and deleted both stored copies: the mute this
  // file is about never survived a restart, and neither did the inbox.
  const OWNER_KEY = '@vasco_notifications_owner_v1';

  it('keeps the inbox and the mutes when the same account resolves', async () => {
    mockStore.clear();
    mockStore.set(OWNER_KEY, 'user-7');
    mockStore.set(PREFS_KEY, JSON.stringify([{ type: 'overdue_invoice', enabled: false }]));
    mockStore.set(PERSIST_KEY, JSON.stringify([{ id: 'n7', type: 'overdue_invoice', createdAt: new Date().toISOString() }]));

    await switchAccountTo('user-7');

    expect(mockStore.has(PREFS_KEY)).toBe(true);
    expect(mockStore.has(PERSIST_KEY)).toBe(true);
    expect(prefFor('overdue_invoice')?.enabled).toBe(false);
  });

  it('still drops them for a DIFFERENT account', async () => {
    mockStore.clear();
    mockStore.set(OWNER_KEY, 'user-7');
    mockStore.set(PREFS_KEY, JSON.stringify([{ type: 'overdue_invoice', enabled: false }]));
    mockStore.set(PERSIST_KEY, JSON.stringify([{ id: 'n7', type: 'overdue_invoice', createdAt: new Date().toISOString() }]));

    await switchAccountTo('user-8');

    expect(mockStore.has(PREFS_KEY)).toBe(false);
    expect(mockStore.has(PERSIST_KEY)).toBe(false);
    expect(prefFor('overdue_invoice')?.enabled).toBe(true);
  });

  it('stamps the owner when a preference is written, so the next launch keeps it', async () => {
    mockStore.clear();
    setCurrentUser({ id: 'user-9' });
    await settle();
    const type = notificationService.getPreferences()[0].type;
    notificationService.togglePreference(type, 'enabled');
    await flush();
    await settle();
    expect(mockStore.get(OWNER_KEY)).toBe('user-9');
  });
});

describe('every push the app sends can be switched off', () => {
  // The switches screen offered eight types; the app pushed two events that had
  // no type at all — a payment landing (invoicePaymentWatcher) and a customer
  // accepting or asking for a change (customerInteractionWatcher). Both watchers
  // checked quiet hours and nothing else, so muting anything silenced only the
  // AI queue, which was the one path that called shouldDeliver (sweep
  // 2026-09-18).
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '../../..');
  const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

  it('the two watchers go through the gate that reads the preference', () => {
    for (const rel of ['src/services/invoicePaymentWatcher.ts', 'src/services/customerInteractionWatcher.ts']) {
      const src = read(rel);
      expect({ rel, gated: /shouldDeliver\(/.test(src) }).toEqual({ rel, gated: true });
    }
  });

  it('their events have a type the screen can offer a switch for', () => {
    const types = notificationService.getPreferences().map((p) => p.type as string);
    expect(types).toContain('invoice_paid');
    expect(types).toContain('customer_interaction');
  });

  it('muting a type stops its delivery', () => {
    const { shouldDeliver } = require('../pushNotificationService');
    expect(shouldDeliver('invoice_paid')).toBe(true);
    notificationService.togglePreference('invoice_paid', 'enabled');
    expect(shouldDeliver('invoice_paid')).toBe(false);
    notificationService.togglePreference('invoice_paid', 'enabled');
  });
});

