/**
 * Stripe Connect (decision 2a, 2026-10-09): the contractor signs in at Stripe,
 * the SERVER keeps the account link and makes payment links; no secret key on
 * the phone. And a connected account's payment marks only its OWNER's invoice.
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const read = (rel: string) => stripComments(fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8'));

const mockInvoke = jest.fn();
let mockUid: string | null = 'user-a';
jest.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: (...a: any[]) => mockInvoke(...a) } }, isSupabaseConfigured: true }));
jest.mock('../lib/currentUser', () => ({ ...jest.requireActual('../lib/currentUser'), getAuthedUserId: () => mockUid }));

import { getConnectStatus, startConnect, __resetConnectStatusForTests } from '../integrations/stripeConnect';
import { createPaymentLink } from '../integrations/stripe';

beforeEach(() => { mockInvoke.mockReset(); mockUid = 'user-a'; __resetConnectStatusForTests(); });

describe('the app side', () => {
  it('connected through Connect: the payment link is made by the SERVER', async () => {
    mockInvoke.mockImplementation(async (_fn: string, { body }: any) =>
      body.action === 'status'
        ? { data: { configured: true, connected: true }, error: null }
        : { data: { url: 'https://buy.stripe.com/x', id: 'plink_1' }, error: null });
    const link = await createPaymentLink({ invoiceId: 'INV-7', amount: 120, description: 'Boiler', currency: 'GBP' } as any);
    expect(link).toEqual({ url: 'https://buy.stripe.com/x', id: 'plink_1' });
    const sent = mockInvoke.mock.calls.find((c) => c[1].body.action === 'payment-link')[1].body;
    expect(sent).toMatchObject({ invoiceId: 'INV-7', amount: 120, currency: 'GBP' });
    // The contractor's id is never sent — the server takes it from the session.
    expect(sent.userId).toBeUndefined();
  });

  it('a customer-decision DEPOSIT keeps its tracker code through Connect', async () => {
    mockInvoke.mockImplementation(async (_fn: string, { body }: any) =>
      body.action === 'status'
        ? { data: { configured: true, connected: true }, error: null }
        : { data: { url: 'https://buy.stripe.com/d', id: 'plink_d' }, error: null });
    await createPaymentLink({ invoiceId: 'deposit-abc', amount: 50, description: 'Deposit', currency: 'GBP', metadata: { trackerAccessCode: '0123456789abcdef0123456789abcdef' } } as any);
    const sent = mockInvoke.mock.calls.find((c) => c[1].body.action === 'payment-link')[1].body;
    expect(sent.trackerAccessCode).toBe('0123456789abcdef0123456789abcdef');
  });

  it('server unreachable = not configured (the old screen stays, no dead button)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('down') });
    expect(await getConnectStatus()).toEqual({ configured: false, connected: false, livemode: false });
  });

  it('only Stripe’s own consent page is opened', async () => {
    mockInvoke.mockResolvedValue({ data: { url: 'https://evil.example/connect' }, error: null });
    expect(await startConnect()).toBeNull();
    mockInvoke.mockResolvedValue({ data: { url: 'https://connect.stripe.com/oauth/authorize?x=1' }, error: null });
    expect(await startConnect()).toMatch(/^https:\/\/connect\.stripe\.com\//);
  });

  it('a status answered after an account switch is not used', async () => {
    mockInvoke.mockImplementation(async () => { mockUid = 'user-b'; return { data: { configured: true, connected: true }, error: null }; });
    expect((await getConnectStatus()).connected).toBe(false);
  });
});

describe('the server side', () => {
  const connect = read('supabase/functions/stripe-connect/index.ts');
  const callback = read('supabase/functions/stripe-connect-callback/index.ts');
  const webhook = read('supabase/functions/stripe-webhook/index.ts');

  it('payment links carry the SESSION user, never one from the request body', () => {
    expect(connect).toMatch(/'metadata\[userId\]': user\.id/);
    expect(connect).toMatch(/'payment_intent_data\[metadata\]\[userId\]': user\.id/);
    expect(connect).not.toMatch(/body\.userId/);
  });

  it('the status answer is booleans only — the account id stays on the server', () => {
    const status = /if \(action === 'status'\) \{([\s\S]*?)\n  \}/.exec(connect)?.[1] ?? '';
    expect(status).toMatch(/configured/);
    expect(status).not.toMatch(/stripe_account_id/);
  });

  it('the callback writes nothing without a verified state, and never moves an account between users', () => {
    const verifyAt = callback.indexOf('verifyConnectState(');
    expect(verifyAt).toBeGreaterThan(-1);
    expect(callback.indexOf("from('stripe_connections')")).toBeGreaterThan(verifyAt);
    expect(callback).toMatch(/if \(!userId\) return back\('failed'\)/);
    expect(callback).toMatch(/'23505'\) return back\('taken'\)/);
  });

  it('a connected account’s payment is matched to the account OWNER, not the metadata', () => {
    expect(webhook).toMatch(/STRIPE_CONNECT_WEBHOOK_SECRET/);
    expect(webhook).toMatch(/from\('stripe_connections'\)\.select\('user_id'\)\.eq\('stripe_account_id', event\.account\)/);
    expect(webhook).toMatch(/const lookup = connectedOwner\s*\? invoiceLookup\(invoiceId, connectedOwner\)/);
    expect(webhook).toMatch(/if \(connectedOwner\) trackerUpdate = trackerUpdate\.eq\('user_id', connectedOwner\)/);
    // An unknown connected account changes nothing.
    expect(webhook).toMatch(/if \(!owner\?\.user_id\) \{[\s\S]*?status: 'unknown account'/);
  });

  it('the tracker code reaches Stripe on both metadata blocks, shape-checked', () => {
    expect(connect).toMatch(/fields\['metadata\[trackerAccessCode\]'\] = tracker/);
    expect(connect).toMatch(/fields\['payment_intent_data\[metadata\]\[trackerAccessCode\]'\] = tracker/);
    expect(connect).toMatch(/\^\[A-Za-z0-9_-\]\{4,64\}\$/);
  });

  it('a contractor revoking Vasco in Stripe is forgotten (no "Connected" over dead links)', () => {
    expect(webhook).toMatch(/event\.type === 'account\.application\.deauthorized'[\s\S]{0,400}from\('stripe_connections'\)\.delete\(\)\.eq\('stripe_account_id', event\.account\)/);
  });

  it('erasing an account revokes Vasco’s access at Stripe', () => {
    expect(read('supabase/functions/drain-account-deletions/index.ts')).toMatch(/connect\.stripe\.com\/oauth\/deauthorize/);
  });

  it('nothing is GRANTed to anon, and the app cannot write the link', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../../supabase/migrations/20261009000002_stripe_connections.sql'), 'utf8');
    expect(sql).toMatch(/revoke all on public\.stripe_connections from anon/);
    expect(sql).toMatch(/grant select on public\.stripe_connections to authenticated;/);
    expect(sql).not.toMatch(/grant (insert|update|delete|all)[^;]*to authenticated/i);
    expect(sql).not.toMatch(/to anon/i);
  });
});
