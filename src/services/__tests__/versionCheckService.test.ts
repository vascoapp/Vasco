/**
 * @jest-environment node
 */

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => (mockStorage.has(key) ? mockStorage.get(key) : null)),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

const mockSupabaseState = {
  fromShouldReturn: null as null | { data: any; error: any },
};
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => mockSupabaseState.fromShouldReturn ?? { data: null, error: null },
        }),
      }),
    }),
  },
}));

import { checkForUpdate, setVersionConfig } from '../versionCheckService';

beforeEach(() => {
  mockStorage.clear();
  mockSupabaseState.fromShouldReturn = null;
});

describe('versionCheckService', () => {
  test('no remote + no cache → falls back to default config (no update)', async () => {
    const result = await checkForUpdate();
    expect(result.currentVersion).toBe('1.0.0');
    expect(result.updateAvailable).toBe(false);
    expect(result.forceUpdate).toBe(false);
  });

  test('remote returns newer version → updateAvailable = true', async () => {
    mockSupabaseState.fromShouldReturn = {
      data: {
        value: {
          minimumVersion: '1.0.0',
          latestVersion: '1.2.0',
          updateUrl: 'https://apps.apple.com/app/vasco',
          forceUpdateBelow: '0.9.0',
        },
      },
      error: null,
    };
    const result = await checkForUpdate();
    expect(result.updateAvailable).toBe(true);
    expect(result.forceUpdate).toBe(false);
    expect(result.latestVersion).toBe('1.2.0');
  });

  test('forceUpdateBelow above current → forceUpdate = true', async () => {
    mockSupabaseState.fromShouldReturn = {
      data: {
        value: {
          minimumVersion: '1.0.0',
          latestVersion: '1.5.0',
          updateUrl: 'https://apps.apple.com/app/vasco',
          forceUpdateBelow: '1.1.0',
        },
      },
      error: null,
    };
    const result = await checkForUpdate();
    expect(result.forceUpdate).toBe(true);
    expect(result.updateAvailable).toBe(true);
  });

  test('malformed remote value → ignored, falls back to cache', async () => {
    await setVersionConfig({
      minimumVersion: '1.0.0',
      latestVersion: '1.3.0',
      updateUrl: 'https://x.com',
      forceUpdateBelow: '0.9.0',
    });
    mockSupabaseState.fromShouldReturn = { data: { value: { junk: true } }, error: null };
    const result = await checkForUpdate();
    expect(result.latestVersion).toBe('1.3.0');
  });

  test('value stored as JSON string is parsed', async () => {
    mockSupabaseState.fromShouldReturn = {
      data: {
        value: JSON.stringify({
          minimumVersion: '1.0.0',
          latestVersion: '1.7.0',
          updateUrl: 'https://x.com',
          forceUpdateBelow: '0.9.0',
        }),
      },
      error: null,
    };
    const result = await checkForUpdate();
    expect(result.latestVersion).toBe('1.7.0');
  });
});
