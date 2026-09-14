// How many days late is an invoice due 31 Aug, on 14 Sep at 17:00? Fourteen —
// in every timezone, at every hour.
//
// 2026-09-14, German device: Finanzen said "15T überfällig" while the queue card
// beside it said "14 Tage" — Finanzen rounded milliseconds against a key that
// `new Date()` parses as UTC midnight. `utils/invoiceDue` had the right idea
// (calendar days) and the same parse, which is the PREVIOUS local day anywhere
// west of UTC. This file pins the process to New York, where both old versions
// read 15, so the suite cannot pass on a host that happens to sit at UTC+2.
//
// ⚠️ `process.env.TZ = …` inside a jest worker does NOT reach V8 — jest
// sandboxes process.env, and the first draft of this file ran in the host's
// zone while claiming New York (its own sanity test caught it). So the file
// re-runs itself in a child jest process started with TZ set for real.
import { spawnSync } from 'child_process';
import path from 'path';
import { parseCalendarDay, calendarDaysBetween } from '../dateKey';
import { daysOverdue, daysUntilDue } from '../invoiceDue';
import { analyzeFinancials } from '../../services/financialAnalysisService';

const IS_CHILD = process.env.CALENDAR_TZ_CHILD === '1';

if (!IS_CHILD) {
  describe('calendar days across timezones', () => {
    it('passes in America/New_York', () => {
      const root = path.resolve(__dirname, '../../..');
      const r = spawnSync(
        process.execPath,
        [require.resolve('jest/bin/jest'), '--config', path.join(root, 'jest.config.js'), '--runTestsByPath', __filename],
        { cwd: root, env: { ...process.env, TZ: 'America/New_York', CALENDAR_TZ_CHILD: '1' }, encoding: 'utf8' },
      );
      if (r.status !== 0) throw new Error(`child run failed:\n${r.stderr || r.stdout}`);
    }, 180_000);
  });
}

const AFTERNOON = new Date(2026, 8, 14, 17, 0, 0);  // 14 Sep, 17:00 local
const LATE_EVENING = new Date(2026, 8, 14, 23, 30, 0);

(IS_CHILD ? describe : describe.skip)('calendar days do not depend on the timezone or the hour', () => {
  it('the process really is west of UTC', () => {
    expect(new Date(2026, 8, 14).getTimezoneOffset()).toBeGreaterThan(0);
  });

  it('reads a YYYY-MM-DD key as that local day', () => {
    const d = parseCalendarDay('2026-08-31')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 7, 31, 0]);
  });

  it('reads an ISO instant as the local day it falls on', () => {
    // 02:30 UTC on 1 Sep is still 31 Aug in New York.
    const d = parseCalendarDay('2026-09-01T02:30:00.000Z')!;
    expect([d.getMonth(), d.getDate()]).toEqual([7, 31]);
  });

  it('counts whole days across the November DST change', () => {
    expect(calendarDaysBetween(new Date(2026, 10, 1, 0, 30), new Date(2026, 10, 2, 23, 30))).toBe(1);
  });

  it('invoiceDue: due 31 Aug is 14 days overdue all of 14 Sep', () => {
    expect(daysOverdue({ dueDate: '2026-08-31' }, AFTERNOON)).toBe(14);
    expect(daysOverdue({ dueDate: '2026-08-31' }, LATE_EVENING)).toBe(14);
    expect(daysUntilDue({ dueDate: '2026-09-14' }, LATE_EVENING)).toBe(0);
  });

  it('Finanzen overdue list agrees with invoiceDue', () => {
    const fin = analyzeFinancials(
      [{ id: 'RE-1', customer: 'c', job: 'j', amount: 5200, status: 'overdue', dueInDays: -14, dueDate: '2026-08-31' }] as never,
      [],
      AFTERNOON,
    );
    expect(fin.overdueDetails[0].daysOverdue).toBe(14);
  });
});
