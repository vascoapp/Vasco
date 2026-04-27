/**
 * @jest-environment node
 *
 * R260 — time-of-day acceptance hint logic.
 */

import { buildTimeOfDayHint, dayPart, type TimeOfDayBucket } from '../timeOfDayAcceptanceService';

describe('buildTimeOfDayHint', () => {
  const mk = (h: number, dow: number, rate: number, n = 20): TimeOfDayBucket => ({
    hourOfDay: h, dayOfWeek: dow,
    acceptanceRate: rate, sampleSize: n, contractorCount: 6,
  });

  test('returns null below MIN_BUCKETS_FOR_HINT', () => {
    expect(buildTimeOfDayHint([])).toBeNull();
    expect(buildTimeOfDayHint([mk(9, 2, 0.6)])).toBeNull();
    expect(buildTimeOfDayHint([mk(9, 2, 0.6), mk(10, 2, 0.7), mk(11, 2, 0.5)])).toBeNull();
  });

  test('returns null when lift below threshold', () => {
    const buckets = [
      mk(9, 1, 0.50), mk(10, 1, 0.52), mk(11, 1, 0.51), mk(12, 1, 0.53),
    ];
    expect(buildTimeOfDayHint(buckets)).toBeNull();
  });

  test('picks best and worst when lift exceeds threshold', () => {
    const buckets = [
      mk(9, 2, 0.70, 30),   // Tuesday morning best
      mk(20, 6, 0.30, 25),  // Saturday evening worst
      mk(14, 3, 0.55, 20),
      mk(16, 4, 0.60, 15),
    ];
    const hint = buildTimeOfDayHint(buckets);
    expect(hint).not.toBeNull();
    expect(hint!.bestBucket.dayOfWeek).toBe(2);
    expect(hint!.bestBucket.hourOfDay).toBe(9);
    expect(hint!.worstBucket.dayOfWeek).toBe(6);
    expect(hint!.liftPoints).toBeCloseTo(0.4, 5);
    expect(hint!.totalSamples).toBe(90);
  });
});

describe('classifyNow (R262)', () => {
  const { classifyNow } = require('../timeOfDayAcceptanceService');
  const mk = (h: number, dow: number, rate: number, n = 20) => ({
    hourOfDay: h, dayOfWeek: dow,
    acceptanceRate: rate, sampleSize: n, contractorCount: 6,
  });

  test('returns neutral when too few buckets', () => {
    expect(classifyNow([mk(9, 2, 0.6)], 9, 2)).toEqual({ tone: 'neutral', liftVsNow: 0 });
  });

  test('send_now when current hour matches the best bucket', () => {
    const buckets = [
      mk(9, 2, 0.80), mk(10, 2, 0.50), mk(20, 6, 0.30), mk(14, 3, 0.55),
    ];
    const r = classifyNow(buckets, 9, 2);
    expect(r.tone).toBe('send_now');
  });

  test('send_later when current bucket is significantly worse than best', () => {
    const buckets = [
      mk(9, 2, 0.85), mk(20, 6, 0.30), mk(14, 3, 0.55), mk(16, 4, 0.60),
    ];
    const r = classifyNow(buckets, 20, 6);
    expect(r.tone).toBe('send_later');
    expect(r.liftVsNow).toBeCloseTo(0.55, 5);
  });

  test('falls back to weighted-average when current bucket gated out', () => {
    // Weighted avg = 0.45 (from 80*30 + 30*70 / 100). Best 0.85. Lift 0.40.
    const buckets = [
      { hourOfDay: 9, dayOfWeek: 2, acceptanceRate: 0.80, sampleSize: 30, contractorCount: 6 },
      { hourOfDay: 9, dayOfWeek: 2, acceptanceRate: 0.85, sampleSize: 1, contractorCount: 6 },
      { hourOfDay: 20, dayOfWeek: 6, acceptanceRate: 0.30, sampleSize: 70, contractorCount: 6 },
      { hourOfDay: 14, dayOfWeek: 3, acceptanceRate: 0.50, sampleSize: 10, contractorCount: 6 },
    ];
    // Now-time (3, 4) doesn't exist → falls back to weighted average ~0.485
    const r = classifyNow(buckets, 3, 4);
    expect(r.tone).toBe('send_later');
  });
});

describe('dayPart', () => {
  test.each([
    [0, 'morning'], [8, 'morning'], [10, 'morning'],
    [11, 'midday'], [13, 'midday'],
    [14, 'afternoon'], [17, 'afternoon'],
    [18, 'evening'], [22, 'evening'],
  ])('hour %i → %s', (h, expected) => {
    expect(dayPart(h)).toBe(expected);
  });
});
