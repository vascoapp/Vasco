/**
 * Signing in as another contractor with no logout in between — an
 * email-confirm / recovery link for a second account opened on this phone, or
 * a demo switch — must leave the previous contractor's data behind.
 *
 * Only a `null` user wiped AppState, so a direct A→B change ran B's refresh on
 * A's arrays: the Dutch demo listed the Italian account's quotes (emulator,
 * 2026-09-30), and against a real backend A's line items would have looked
 * like B's offline orphans and been SENT to B's account.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { AppStateProvider, useAppState } from '../src/state/AppState';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

let auth: ReturnType<typeof useAuth> | null = null;
let quotes: string[] = [];
let projects = 0;
let profileLoaded = false;
const Probe = () => {
  auth = useAuth();
  const { quotes: q, projects: p, profileLoaded: loaded } = useAppState();
  quotes = q.map((x) => String(x.customer ?? ''));
  projects = p.length;
  profileLoaded = loaded;
  return <Text>{quotes.length}</Text>;
};

const settle = async () => {
  for (let i = 0; i < 30; i++) await act(async () => { await new Promise((r) => setTimeout(r, 1)); });
};

it('the Dutch demo after the Italian one shows Dutch quotes, none of the Italian', async () => {
  let tree: renderer.ReactTestRenderer | undefined;
  await act(async () => { tree = renderer.create(<AuthProvider><AppStateProvider><Probe /></AppStateProvider></AuthProvider>); });
  await settle();

  await act(async () => { await auth!.login('idraulico@vasco.it.dev', 'demo'); });
  await settle();
  const italian = [...quotes];
  expect(italian.some((c) => /Rossi|Conti/.test(c))).toBe(true);

  await act(async () => { await auth!.login('contractor@vasco.dev', 'demo'); });
  await settle();

  expect(quotes.filter((c) => italian.includes(c))).toEqual([]);
  // The positive half: an empty list would also pass the line above.
  expect(quotes.length).toBeGreaterThan(0);
  // Business settings waits on profileLoaded, and so does the scheduler that
  // builds Vandaag's cards — a demo has no session to refresh it (review).
  expect(profileLoaded).toBe(true);
  tree!.unmount();
}, 60_000);

it('the aannemer after the Italian contractor gets the projects back', async () => {
  let tree: renderer.ReactTestRenderer | undefined;
  await act(async () => { tree = renderer.create(<AuthProvider><AppStateProvider><Probe /></AppStateProvider></AuthProvider>); });
  await settle();
  await act(async () => { await auth!.login('idraulico@vasco.it.dev', 'demo'); });
  await settle();
  await act(async () => { await auth!.login('aannemer@vasco.dev', 'demo'); });
  await settle();
  expect(projects).toBeGreaterThan(0);
  tree!.unmount();
}, 60_000);
