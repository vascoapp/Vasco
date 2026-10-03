/**
 * The line-item heal resolves a document by its NUMBER — and a quote and an
 * invoice can share one (learnings #384, open item). An invoice created
 * offline, still queued, numbered like a quote already on the server: its
 * lines must not be written onto that quote. A plain orphan (document on the
 * server, lines never sent) is still healed onto it.
 *
 * The real AppState on the live-schema fake, the real refresh.
 */
import React from 'react';
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-0000000000e1';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-0000000000e1' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-0000000000e1', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'NL', language: 'nl' } };
  m.supabase.auth.signInWithPassword = async () => ({ data: { user, session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getSession = async () => ({ data: { session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getUser = async () => ({ data: { user }, error: null });
  return m;
});

import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { useAppState } from '../src/state/AppState';

const fake = require('../src/lib/supabase').__fake as FakeSupabase;
let app: ReturnType<typeof useAppState>;
function Probe() { app = useAppState(); return null; }
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const line = (description: string) => ({ id: `li-${description}`, description, quantity: 1, unitPrice: 100, vatRate: 21 });

it('an offline invoice\'s lines never land on the same-numbered quote; a real orphan is healed', async () => {
  fake.seed('documents', [
    { user_id: UID, doc_type: 'quote', status: 'sent', document_number: 'NR-7' },
    { user_id: UID, doc_type: 'invoice', status: 'draft', document_number: 'F-9' },
  ]);
  const [quoteRow, invoiceRow] = fake.rows('documents');

  // On the device: invoice NR-7 created offline (its insert still queued),
  // and invoice F-9 whose lines never reached the server.
  await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
  await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
    { id: 'NR-7', customer: 'Familie Jansen', amount: 121, status: 'draft', dueInDays: 14 },
  ]));
  await AsyncStorage.setItem('@vasco_line_items', JSON.stringify({ 'NR-7': [line('offline-invoice')], 'F-9': [line('orphan')] }));
  await AsyncStorage.setItem('@vasco_offline_writes', JSON.stringify([
    { id: 'w1', table: 'documents', op: 'insert', payload: { document_number: 'NR-7', doc_type: 'invoice' }, createdAt: Date.now(), attempts: 0 },
  ]));

  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 12, language: 'nl' });
  expect(r.error).toBeNull();
  await act(async () => { await app.refreshData(); });
  await settle(20);

  const written = fake.rows('line_items');
  expect(written.filter((l) => l.document_id === quoteRow.id)).toEqual([]);
  expect(written.filter((l) => l.document_id === invoiceRow.id).map((l) => l.description)).toEqual(['orphan']);
  teardown(r);
});
