/**
 * "Days left in your trial" is a count of calendar days. ceil(ms / 24h) said
 * 31 on a 30-day trial that crossed the switch to winter time (local
 * Europe/Amsterdam; CI in UTC never saw it). Property, not a sample
 * (learnings #230): the same trial reads the same at 00:01, 12:00 and 23:59,
 * and one day later reads one less.
 *
 * ⚠️ `process.env.TZ` inside a jest worker does not reach V8, so this file
 * re-runs itself in a child jest with TZ set for real (as
 * calendarDaysAcrossTimezones does).
 */
import { spawnSync } from 'child_process';
import path from 'path';

const IS_CHILD = process.env.TRIAL_TZ_CHILD === '1';

if (!IS_CHILD) {
  describe('trial days across DST', () => {
    it('passes in Europe/Amsterdam', () => {
      const root = path.resolve(__dirname, '../../..');
      const r = spawnSync(
        process.execPath,
        [require.resolve('jest/bin/jest'), '--config', path.join(root, 'jest.config.js'), '--runTestsByPath', __filename],
        { cwd: root, env: { ...process.env, TZ: 'Europe/Amsterdam', TRIAL_TZ_CHILD: '1' }, encoding: 'utf8' },
      );
      if (r.status !== 0) throw new Error(`child run failed:\n${r.stderr || r.stdout}`);
    }, 180_000);
  });
}

(IS_CHILD ? describe : describe.skip)('a 30-day trial that crosses the end of summer time', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { daysLeftInTrial, TRIAL_DAYS } = require('../subscriptionService');
  afterEach(() => jest.useRealTimers());

  const trialFrom = (start: Date) => {
    const end = new Date(start);
    end.setDate(end.getDate() + TRIAL_DAYS); // what startTrial does
    return { tier: 'pro', trialEndsAt: end.toISOString() } as any;
  };

  it('the process really observes DST', () => {
    expect(new Date(2026, 9, 13).getTimezoneOffset()).not.toBe(new Date(2026, 10, 13).getTimezoneOffset());
  });

  it.each([[0, 1], [12, 0], [23, 59]])('reads %i:%i the same: TRIAL_DAYS on day one, one less a day later', (h, m) => {
    const start = new Date(2026, 9, 13, h, m); // 13 Oct; 25 Oct ends summer time
    const state = trialFrom(start);
    jest.useFakeTimers().setSystemTime(start);
    expect(daysLeftInTrial(state)).toBe(TRIAL_DAYS);
    jest.setSystemTime(new Date(2026, 9, 14, h, m));
    expect(daysLeftInTrial(state)).toBe(TRIAL_DAYS - 1);
  });
});
