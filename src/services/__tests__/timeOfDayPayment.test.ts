/**
 * @jest-environment node
 *
 * R261 — invoice payment-timing hint logic.
 */

import {
  buildPaymentTimingHint,
  dayPart,
  type PaymentTimingBucket,
} from '../timeOfDayPaymentService';

describe('buildPaymentTimingHint', () => {
  const mk = (
    h: number, dow: number, paidRate: number, medianDays: number | null, n = 20,
  ): PaymentTimingBucket => ({
    hourOfDay: h, dayOfWeek: dow,
    paidRate, medianDaysToPaid: medianDays,
    sampleSize: n, contractorCount: 6,
  });

  test('returns null below MIN_BUCKETS_FOR_HINT', () => {
    expect(buildPaymentTimingHint([])).toBeNull();
    expect(buildPaymentTimingHint([mk(9, 2, 0.6, 12)])).toBeNull();
    expect(buildPaymentTimingHint([
      mk(9, 2, 0.6, 12), mk(10, 2, 0.65, 11), mk(11, 2, 0.55, 13),
    ])).toBeNull();
  });

  test('returns null when neither lift nor days-saved meets threshold', () => {
    const buckets = [
      mk(9, 1, 0.50, 12), mk(10, 1, 0.51, 11.5),
      mk(11, 1, 0.52, 12.2), mk(12, 1, 0.50, 11.8),
    ];
    expect(buildPaymentTimingHint(buckets)).toBeNull();
  });

  test('best bucket is fastest paid + highest paid_rate', () => {
    const buckets = [
      mk(9, 2, 0.85, 8, 30),    // Tue 9am — best
      mk(20, 6, 0.40, 25, 25),  // Sat 8pm — worst
      mk(14, 3, 0.60, 18, 20),
      mk(16, 4, 0.65, 15, 15),
    ];
    const hint = buildPaymentTimingHint(buckets);
    expect(hint).not.toBeNull();
    expect(hint!.bestBucket.dayOfWeek).toBe(2);
    expect(hint!.bestBucket.hourOfDay).toBe(9);
    expect(hint!.worstBucket.dayOfWeek).toBe(6);
    expect(hint!.daysSavedVsWorst).toBeCloseTo(17, 5);
    expect(hint!.totalSamples).toBe(90);
  });

  test('handles null median days gracefully', () => {
    const buckets = [
      mk(9, 2, 0.85, 8),
      mk(20, 6, 0.40, null),
      mk(14, 3, 0.60, 18),
      mk(16, 4, 0.65, 15),
    ];
    const hint = buildPaymentTimingHint(buckets);
    expect(hint).not.toBeNull();
    // Worst should be the null-medianDays one (score = paidRate - 60/60 = -0.6)
    expect(hint!.worstBucket.medianDaysToPaid).toBeNull();
    // daysSaved is non-finite when worst.median is null → reported as 0
    expect(hint!.daysSavedVsWorst).toBe(0);
  });
});

describe('dayPart', () => {
  test.each([
    [0, 'morning'], [10, 'morning'],
    [11, 'midday'], [13, 'midday'],
    [14, 'afternoon'], [17, 'afternoon'],
    [18, 'evening'], [22, 'evening'],
  ])('hour %i → %s', (h, expected) => {
    expect(dayPart(h)).toBe(expected);
  });
});
