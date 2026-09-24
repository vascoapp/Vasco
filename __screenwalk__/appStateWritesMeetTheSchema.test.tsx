/**
 * Every write AppState makes on the core path is accepted by the LIVE schema.
 *
 * AppState builds its create payloads inline (addCustomer → createCustomer,
 * addQuote → createDocument + line items, …). No test had ever sent them to
 * anything that could say no: the unit suite's backend was "not configured"
 * and the walk's backend accepted any chain. Here the real providers run on
 * the fake backend (src/test-utils/fakeSupabase.ts — the production column
 * list, NOT NULL, RLS, RPC argument names), signed in as a real contractor,
 * and the suite fails on any call production would reject (convergence plan
 * P0.3, 2026-09-24).
 */
import React from 'react';
import { act } from 'react-test-renderer';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-000000000001';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-000000000001' });
  const user = {
    id: 'aaaaaaaa-1111-4111-8111-000000000001',
    email: 'walk@vascobuild.test',
    user_metadata: { role: 'contractor', country: 'DE', language: 'de' },
  };
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

const settle = async (n = 8) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const SCHEMA = new Set(['PGRST204', '23502', '42703', '42P01', 'PGRST202', '42501', 'PGRST200', '23505']);
const rejected = () => fake.calls.filter((c) => c.error && SCHEMA.has(c.error.code))
  .map((c) => `${c.op} ${c.table}: ${c.error!.code} ${c.error!.message}`);

it('the core path writes rows production accepts', async () => {
  let n = 0;
  fake.rpc('next_document_number', ({ p_doc_type }) => ({ data: `${p_doc_type === 'quote' ? 'AN' : 'RE'}-${++n}`, error: null }));

  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 12, language: 'de' });
  expect(r.error).toBeNull();
  expect(app).toBeTruthy();

  let customerId = '';
  await act(async () => {
    customerId = await app.addCustomer('Familie Becker', 'becker@example.de', '+49 221 123456', 'Hauptstr. 1', {
      city: 'Köln', postcode: '50667', country: 'DE', vatId: 'DE123456789',
    } as any);
  });
  await settle();

  let jobId = '';
  await act(async () => {
    jobId = await app.addJob('Bad sanieren', customerId, 'Fliesen + Armaturen', {
      address_street: 'Hauptstr. 1', address_city: 'Köln', address_postcode: '50667', address_country: 'DE',
      scheduled_date: '2026-10-01', estimated_duration: 16, quoted_amount: 2400, trade: 'plumbing', priority: 'normal',
    });
  });
  await settle();
  await act(async () => { app.updateJob(jobId, { description: 'Fliesen, Armaturen, Silikon' } as any); });
  await act(async () => { await app.updateCustomer(customerId, { phone: '+49 221 999999' } as any); });
  await settle();

  let quoteId = '';
  await act(async () => {
    quoteId = await app.addQuote('Familie Becker', 'Bad sanieren', [
      { id: 'l1', description: 'Arbeitsstunden', quantity: 16, unitPrice: 65, vatRate: 19 } as any,
      { id: 'l2', description: 'Armatur', quantity: 1, unitPrice: 189.9, vatRate: 19 } as any,
    ]);
  });
  await settle();
  await act(async () => { app.markQuoteSent(quoteId); });
  await settle();

  let invoiceId = '';
  await act(async () => { invoiceId = await app.addInvoice(quoteId); });
  await settle();
  await act(async () => { app.markInvoiceSent(invoiceId); });
  await settle();
  await act(async () => { app.markInvoicePaid(invoiceId); });
  await settle();

  await act(async () => { await app.updateBusinessProfile({ businessName: 'Müller Sanitär', vatNumber: 'DE123456789', iban: 'DE89370400440532013000', country: 'DE', vatScheme: 'standard' } as any); });
  await settle();

  // The rows landed — the path was exercised, not skipped.
  expect(fake.rows('customers').length).toBeGreaterThan(0);
  expect(fake.rows('jobs').length).toBeGreaterThan(0);
  expect(fake.rows('documents').length).toBeGreaterThanOrEqual(2);
  expect(fake.rows('line_items').length).toBeGreaterThanOrEqual(2);
  expect(rejected()).toEqual([]);
  teardown(r);
});
