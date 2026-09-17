/**
 * @jest-environment node
 */
// The Moneybird connect screen collected an API token, wrote it to a plain
// AsyncStorage key of its own invention (`@vasco_moneybird_config`) that no
// other file ever read, and reported "Verbinding geslaagd" without contacting
// Moneybird once. The integration reads its config from SecureStore under
// `vasco_moneybird`, so every export ran unauthenticated and every "test"
// passed (#339, sweep 2026-09-16).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

const ROOT = path.resolve(__dirname, '../../..');

const mockStore = new Map<string, string>();
jest.mock('../../lib/secureStorage', () => ({
  getSecureItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setSecureItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
  deleteSecureItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
  migrateToSecure: jest.fn(async () => {}),
}));

import { connectWithPersonalToken, isConnected, clearMoneybirdConfig, getContacts } from '../moneybird';

const okJson = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

describe('connectWithPersonalToken', () => {
  beforeEach(() => { mockStore.clear(); jest.restoreAllMocks(); });

  it('verifies the token against Moneybird and stores it where the integration reads', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okJson([{ id: 123456, name: 'De Vries Installaties' }]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await connectWithPersonalToken({ accessToken: '  tok-live  ' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/administrations.json');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-live');
    expect(res).toEqual({ ok: true, administrationId: '123456' });
    // The one that matters: the integration itself now reads as connected.
    await expect(isConnected()).resolves.toBe(true);
    expect(mockStore.get('vasco_moneybird')).toContain('tok-live');
  });

  it('refuses a rejected token and stores nothing', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson({ error: 'unauthorized' }, 401)) as unknown as typeof fetch;
    await expect(connectWithPersonalToken({ accessToken: 'bad' })).resolves.toEqual({ ok: false, reason: 'invalid_token' });
    await expect(isConnected()).resolves.toBe(false);
  });

  it('refuses an administration id the account does not have', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson([{ id: 111 }])) as unknown as typeof fetch;
    // Falling back to the first administration would export the contractor's
    // invoices into a set of books they did not choose.
    await expect(connectWithPersonalToken({ accessToken: 'tok', administrationId: '999' }))
      .resolves.toEqual({ ok: false, reason: 'no_administration' });
    await expect(isConnected()).resolves.toBe(false);
  });

  it('reports a network failure as such, not as a bad token', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(connectWithPersonalToken({ accessToken: 'tok' })).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('never tries to refresh a personal token (it has no refresh token)', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson([{ id: 7 }])) as unknown as typeof fetch;
    await connectWithPersonalToken({ accessToken: 'tok' });

    const calls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      calls.push(String(url));
      return okJson([{ id: 'c1' }]);
    }) as unknown as typeof fetch;
    await getContacts();

    // expiresAt is 0 — the old guard read that as "expired 56 years ago" and
    // sent every call to the OAuth refresh endpoint with an empty token.
    expect(calls.some((u) => u.includes('oauth/token'))).toBe(false);
    expect(calls.some((u) => u.includes('/7/contacts.json'))).toBe(true);
  });

  it('clearMoneybirdConfig disconnects', async () => {
    global.fetch = jest.fn().mockResolvedValue(okJson([{ id: 7 }])) as unknown as typeof fetch;
    await connectWithPersonalToken({ accessToken: 'tok' });
    await clearMoneybirdConfig();
    await expect(isConnected()).resolves.toBe(false);
  });
});

describe('the connect screen is wired to the integration', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'app/(modals)/moneybird.tsx'), 'utf8'));

  it('keeps no token store of its own', () => {
    expect(src).not.toMatch(/AsyncStorage/);
    expect(src).not.toMatch(/@vasco_moneybird_config/);
  });

  it('tests by calling Moneybird, and clears the flag on disconnect', () => {
    expect(src).toMatch(/connectWithPersonalToken\(/);
    expect(src).toMatch(/clearMoneybirdConfig\(/);
    expect(src).toMatch(/disconnectMoneybird\(\)/);
  });

  it('only reports success when the call succeeded', () => {
    const handler = src.slice(src.indexOf('const handleTest'), src.indexOf('const handleDisconnect'));
    const success = handler.indexOf("setTestResult('success')");
    expect(success).toBeGreaterThan(-1);
    // Everything before the success line must include the guard that returns.
    expect(handler.slice(0, success)).toMatch(/if \(!result\.ok\)[\s\S]*return;/);
  });
});

describe('the token belongs to the account that connected it', () => {
  // One device-wide keychain key, and nothing dropped it on a user change:
  // after A signed out and B signed in, B's invoice screen showed Moneybird as
  // connected and an export would have gone into A's books with A's token.
  const { setCurrentUser } = require('../../lib/currentUser');

  beforeEach(() => { mockStore.clear(); jest.restoreAllMocks(); });
  afterAll(() => { setCurrentUser(null); });

  it('reads as connected for the account that connected it', async () => {
    setCurrentUser({ id: 'user-A' });
    global.fetch = jest.fn().mockResolvedValue(okJson([{ id: 1, name: 'A BV' }])) as unknown as typeof fetch;
    await connectWithPersonalToken({ accessToken: 'tok-A' });

    await expect(isConnected()).resolves.toBe(true);
    expect(JSON.parse(mockStore.get('vasco_moneybird') ?? '{}').userId).toBe('user-A');
  });

  it('does not read as connected for the NEXT account on the device', async () => {
    setCurrentUser({ id: 'user-A' });
    global.fetch = jest.fn().mockResolvedValue(okJson([{ id: 1, name: 'A BV' }])) as unknown as typeof fetch;
    await connectWithPersonalToken({ accessToken: 'tok-A' });

    setCurrentUser({ id: 'user-B' });
    await expect(isConnected()).resolves.toBe(false);
  });

  it('treats a config stored before the owner field as someone else\'s', async () => {
    mockStore.set('vasco_moneybird', JSON.stringify({ accessToken: 'tok-old', refreshToken: '', administrationId: '1', expiresAt: 0 }));
    setCurrentUser({ id: 'user-C' });
    await expect(isConnected()).resolves.toBe(false);
  });
});

