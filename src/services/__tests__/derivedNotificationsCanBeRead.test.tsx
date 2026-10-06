/**
 * A derived notification can be marked read, and stays read (W119 review).
 *
 * Derived entries (overdue invoice, decided quote, …) are rebuilt from
 * AppState on every render with `read: false`, and markRead ignored them — so
 * a decided quote held the bell badge up for 14 days and could not be
 * dismissed. Read state is now kept per id under an `@vasco_` key (wiped at
 * logout), and the bell counts UNREAD entries.
 */
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
  },
}));

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import fs from 'fs';
import path from 'path';
import { useCombinedNotifications } from '../notificationService';

const sentYesterday = new Date(Date.now() - 86_400_000).toISOString();
const state = { invoices: [], jobs: [], customers: [], quotes: [{ id: 'Q0001', status: 'accepted', sentAt: sentYesterday, customerName: 'Edilizia Bianchi S.r.l.' }] };

let hook: ReturnType<typeof useCombinedNotifications>;
function Probe() { hook = useCombinedNotifications(state as any); return null; }
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

it('markRead on a decided-quote entry sticks, across a remount', async () => {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<Probe />); });
  await flush();
  const entry = () => hook.notifications.find((n) => n.id === 'live-quote-accepted-Q0001');
  expect(entry()?.read).toBe(false);

  await act(async () => { hook.markRead('live-quote-accepted-Q0001'); });
  await flush();
  expect(entry()?.read).toBe(true);

  // A fresh mount (cold start) reads it back from storage.
  act(() => { r.unmount(); });
  await act(async () => { TestRenderer.create(<Probe />); });
  await flush();
  expect(entry()?.read).toBe(true);
  expect([...mockStore.keys()].some((k) => k.startsWith('@vasco_'))).toBe(true);
});

it('the bell counts UNREAD entries, not every entry', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../../app/(contractor)/index.tsx'), 'utf8');
  expect(src).toMatch(/inboxNotifications\.filter\(\(n\) => !n\.read\)\.length/);
  expect(src).not.toMatch(/\{inboxNotifications\.length\}/);
});

it('two screens share it: reading on the inbox clears Oggi too (one store)', async () => {
  let a!: ReturnType<typeof useCombinedNotifications>, b!: ReturnType<typeof useCombinedNotifications>;
  const s2 = { ...state, quotes: [{ id: 'Q0002', status: 'accepted', sentAt: sentYesterday, customerName: 'X' }] };
  function A() { a = useCombinedNotifications(s2 as any); return null; }
  function B() { b = useCombinedNotifications(s2 as any); return null; }
  await act(async () => { TestRenderer.create(<><A /><B /></>); });
  await flush();
  const read = (h: typeof a) => h.notifications.find((n) => n.id === 'live-quote-accepted-Q0002')?.read;
  expect(read(b)).toBe(false);
  await act(async () => { a.markRead('live-quote-accepted-Q0002'); });
  await flush();
  expect(read(b)).toBe(true);
});
