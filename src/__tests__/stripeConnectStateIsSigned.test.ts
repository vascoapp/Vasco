/**
 * Stripe Connect's OAuth `state` is the ONLY proof, at the callback, of which
 * Vasco account a returning Stripe account belongs to (the redirect carries no
 * session). Forged, altered, re-signed or stale states must be refused — an
 * accepted one attaches a stranger's Stripe account to a contractor, whose
 * invoices that stranger could then mark paid. Decision 2a, 2026-10-09.
 */
import { signConnectState, verifyConnectState, STATE_TTL_MS } from '../../supabase/functions/_shared/stripeConnectState';

const SECRET = 'a-long-enough-test-secret-0123456789';
const USER = '11111111-2222-3333-4444-555555555555';

it('a state signed for a user verifies to that user', async () => {
  const s = await signConnectState(USER, SECRET);
  expect(await verifyConnectState(s, SECRET)).toBe(USER);
});

it('two states for the same user differ (nonce)', async () => {
  expect(await signConnectState(USER, SECRET)).not.toBe(await signConnectState(USER, SECRET));
});

it('an altered payload — another user id — is refused', async () => {
  const s = await signConnectState(USER, SECRET);
  const [payload, sig] = s.split('.');
  const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  json.u = '99999999-2222-3333-4444-555555555555';
  const forged = Buffer.from(JSON.stringify(json)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  expect(await verifyConnectState(`${forged}.${sig}`, SECRET)).toBeNull();
});

it('a state signed with another secret is refused', async () => {
  const s = await signConnectState(USER, 'some-other-secret-that-is-long-enough');
  expect(await verifyConnectState(s, SECRET)).toBeNull();
});

it('an expired state is refused', async () => {
  const issued = Date.now() - STATE_TTL_MS - 1000;
  const s = await signConnectState(USER, SECRET, issued);
  expect(await verifyConnectState(s, SECRET)).toBeNull();
  expect(await verifyConnectState(s, SECRET, issued + 1000)).toBe(USER);
});

it('garbage, a bare user id, or extra segments are refused', async () => {
  const s = await signConnectState(USER, SECRET);
  for (const bad of [null, undefined, '', USER, 'a.b', `${s}.x`, s.split('.')[0], 42]) {
    expect(await verifyConnectState(bad, SECRET)).toBeNull();
  }
});

it('no secret, no state', async () => {
  await expect(signConnectState(USER, '')).rejects.toThrow();
  expect(await verifyConnectState(await signConnectState(USER, SECRET), '')).toBeNull();
});
