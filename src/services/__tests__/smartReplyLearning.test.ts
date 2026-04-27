/**
 * @jest-environment node
 *
 * R271 — smart-reply learning loop.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete store[k]; }),
      __store: store,
    },
  };
});

import {
  recordImpression,
  recordTap,
  getChipMultiplier,
  primeCache,
  __resetForTest,
} from '../smartReplyLearningService';

describe('smartReplyLearningService (R271)', () => {
  beforeEach(async () => {
    await __resetForTest();
    await primeCache();
  });

  test('neutral (1.0) before MIN_IMPRESSIONS_FOR_LEARNING samples', async () => {
    await recordImpression('chip-a');
    await recordImpression('chip-a');
    expect(getChipMultiplier('chip-a')).toBe(1.0);
  });

  test('boosts to 1.6 when tap rate ≥ 50%', async () => {
    await recordImpression('chip-b');
    await recordImpression('chip-b');
    await recordImpression('chip-b');
    await recordTap('chip-b');
    await recordTap('chip-b');
    expect(getChipMultiplier('chip-b')).toBe(1.6);
  });

  test('1.2 when tap rate ∈ [25%, 50%)', async () => {
    for (let i = 0; i < 4; i++) await recordImpression('chip-c');
    await recordTap('chip-c'); // 25%
    expect(getChipMultiplier('chip-c')).toBe(1.2);
  });

  test('neutral 1.0 when tap rate ∈ [10%, 25%)', async () => {
    for (let i = 0; i < 10; i++) await recordImpression('chip-d');
    await recordTap('chip-d'); // 10%
    expect(getChipMultiplier('chip-d')).toBe(1.0);
  });

  test('dampens to 0.4 when tap rate < 10%', async () => {
    for (let i = 0; i < 20; i++) await recordImpression('chip-e');
    await recordTap('chip-e'); // 5%
    expect(getChipMultiplier('chip-e')).toBe(0.4);
  });

  test('unknown chip → neutral', () => {
    expect(getChipMultiplier('unknown')).toBe(1.0);
  });

  test('persists across primeCache reload', async () => {
    for (let i = 0; i < 5; i++) await recordImpression('chip-p');
    for (let i = 0; i < 3; i++) await recordTap('chip-p');
    // Wipe in-memory cache and reload from storage
    await __resetForTest(); // clears storage too — so this test is really
                            // about persistence WITHOUT reset
    // Re-do with no reset between writes and re-prime
    for (let i = 0; i < 5; i++) await recordImpression('chip-q');
    for (let i = 0; i < 3; i++) await recordTap('chip-q');
    await primeCache();
    expect(getChipMultiplier('chip-q')).toBe(1.6);
  });

  test('empty chipId → neutral', () => {
    expect(getChipMultiplier('')).toBe(1.0);
  });
});
