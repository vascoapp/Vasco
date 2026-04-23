/**
 * @jest-environment node
 */

import { pickWinback, __internal } from '../churnWinbackPolicy';

const base = {
  daysSinceLastActivity: 0,
  daysSinceSignup: 0,
  hasMonetaryActivity: false,
};

describe('pickWinback gate', () => {
  test('returns null below silent threshold', () => {
    expect(pickWinback({ ...base, daysSinceLastActivity: 13, daysSinceSignup: 30 })).toBeNull();
  });

  test('returns null for brand-new signups (< 7 days since signup)', () => {
    // Hypothetical case: 14d silent but signed up only 6d ago — impossible
    // in reality, but the gate should still refuse.
    expect(pickWinback({ ...base, daysSinceLastActivity: 14, daysSinceSignup: 6 })).toBeNull();
  });

  test('new_stalled when no monetary activity', () => {
    const r = pickWinback({ daysSinceLastActivity: 20, daysSinceSignup: 20, hasMonetaryActivity: false });
    expect(r?.variant).toBe('new_stalled');
    expect(r?.daysSinceLastActivity).toBe(20);
  });

  test('active_quiet when monetary activity exists', () => {
    const r = pickWinback({ daysSinceLastActivity: 21, daysSinceSignup: 60, hasMonetaryActivity: true });
    expect(r?.variant).toBe('active_quiet');
  });
});

describe('locale coverage', () => {
  const activeQuiet = { daysSinceLastActivity: 18, daysSinceSignup: 60, hasMonetaryActivity: true };
  const newStalled  = { daysSinceLastActivity: 18, daysSinceSignup: 30, hasMonetaryActivity: false };

  test('every (locale × variant) resolves with {days} filled + non-empty subject/body', () => {
    for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it'] as const) {
      const a = pickWinback(activeQuiet, loc)!;
      const n = pickWinback(newStalled, loc)!;
      for (const r of [a, n]) {
        expect(r.subject.length).toBeGreaterThan(0);
        expect(r.body.length).toBeGreaterThan(20);
        expect(r.body).toContain('18');                 // {days} filled
        expect(r.body).not.toContain('{days}');
      }
    }
  });

  test('NL new_stalled subject + body are Dutch', () => {
    const r = pickWinback(newStalled, 'nl')!;
    expect(r.subject.toLowerCase()).toContain('vasco');
    expect(r.body).toMatch(/offerte|dagen/);
  });

  test('IT active_quiet body references fatture', () => {
    const r = pickWinback(activeQuiet, 'it')!;
    expect(r.body).toMatch(/fatture/i);
  });
});

describe('threshold constants', () => {
  test('silent threshold is at least 2 weeks', () => {
    expect(__internal.MIN_DAYS_SILENT).toBeGreaterThanOrEqual(14);
  });
  test('signup grace period is at least a week', () => {
    expect(__internal.MIN_DAYS_SINCE_SIGNUP).toBeGreaterThanOrEqual(7);
  });
  test('templates exist for every supported locale', () => {
    for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it'] as const) {
      expect(__internal.TEMPLATES[loc].new_stalled.subject).toBeTruthy();
      expect(__internal.TEMPLATES[loc].active_quiet.subject).toBeTruthy();
    }
  });
});
