/**
 * @jest-environment node
 */

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

let mockAttributeResult: boolean = false;
let mockAttributeCalls: Array<{ code: string; userId: string }> = [];
jest.mock('../referralService', () => ({
  attributeReferral: jest.fn(async (code: string, userId: string) => {
    mockAttributeCalls.push({ code, userId });
    return mockAttributeResult;
  }),
}));

import {
  normalizeCode,
  stashPendingReferral,
  getPendingReferral,
  clearPendingReferral,
  applyPendingReferral,
  __internal,
} from '../referralAttributionService';

beforeEach(() => {
  mockStorage.clear();
  mockAttributeResult = false;
  mockAttributeCalls = [];
});

describe('normalizeCode', () => {
  test('trims + uppercases a valid 6-char code', () => {
    expect(normalizeCode(' abc234 ')).toBe('ABC234');
    expect(normalizeCode('mnqrst')).toBe('MNQRST');
  });
  test('rejects too-short codes', () => {
    expect(normalizeCode('ABC')).toBeNull();
  });
  test('rejects codes containing forbidden chars (0/O/1/I + lowercase after normalize = digits)', () => {
    expect(normalizeCode('ABC0D2')).toBeNull();  // contains 0
    expect(normalizeCode('ABC1D2')).toBeNull();  // contains 1
    expect(normalizeCode('AB-234')).toBeNull();  // non-alphanumeric
  });
  test('null / undefined / empty → null', () => {
    expect(normalizeCode(null)).toBeNull();
    expect(normalizeCode(undefined)).toBeNull();
    expect(normalizeCode('')).toBeNull();
  });
  test('accepts 4-8 char range', () => {
    expect(normalizeCode('AB23')).toBe('AB23');       // 4 — lower bound
    expect(normalizeCode('ABCDEF78')).toBe('ABCDEF78'); // 8 — upper bound
    expect(normalizeCode('ABCDEFGH2')).toBeNull();    // 9 — too long
  });
});

describe('stash / get / clear', () => {
  test('stashes + retrieves a normalized code', async () => {
    await stashPendingReferral(' abc234 ');
    expect(await getPendingReferral()).toBe('ABC234');
  });
  test('stashing invalid code → null + storage unchanged', async () => {
    expect(await stashPendingReferral('bad!')).toBeNull();   // '!' rejected
    expect(await stashPendingReferral('abc')).toBeNull();    // 3 chars — too short
    expect(mockStorage.has(__internal.PENDING_KEY)).toBe(false);
  });
  test('clear removes the pending code', async () => {
    await stashPendingReferral('ABC234');
    await clearPendingReferral();
    expect(await getPendingReferral()).toBeNull();
  });
});

describe('applyPendingReferral', () => {
  test('no pending code → returns false without RPC', async () => {
    expect(await applyPendingReferral('user-1')).toBe(false);
    expect(mockAttributeCalls).toHaveLength(0);
  });

  test('valid code + successful RPC → true + storage cleared', async () => {
    mockAttributeResult = true;
    await stashPendingReferral('ABC234');
    expect(await applyPendingReferral('user-1')).toBe(true);
    expect(mockAttributeCalls).toEqual([{ code: 'ABC234', userId: 'user-1' }]);
    expect(await getPendingReferral()).toBeNull();
  });

  test('RPC failure still clears storage (no retry loop)', async () => {
    mockAttributeResult = false;
    await stashPendingReferral('ABC234');
    expect(await applyPendingReferral('user-1')).toBe(false);
    expect(await getPendingReferral()).toBeNull();
  });
});
