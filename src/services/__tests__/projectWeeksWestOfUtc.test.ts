/**
 * A project's weeks count from its start Monday in EVERY time zone.
 *
 * `new Date('2026-10-05')` is UTC midnight — in New York that is Sunday 4 Oct,
 * so `startOfWeek` anchored the whole plan on Monday 28 Sep, a week early. The
 * start picker writes only Mondays, so every moved project hit it (review
 * 2026-10-04).
 *
 * CI runs in UTC, where the bug cannot show, and jest gives each test its own
 * copy of `process.env` (setting TZ here does nothing). So the real service
 * runs in a child node with TZ=America/New_York (sucrase strips the types;
 * it is installed via expo-constants > @expo/config, a production dependency).
 */
import { execFileSync } from 'child_process';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

function inNewYork(): Record<string, unknown> {
  const script = `
    const s = require('./src/services/projectSequenceService.ts');
    const p = (startDate) => ({ id: 'p', title: 'p', status: 'active', startDate, milestones: [], jobIds: [] });
    const moved = s.shiftedProjectStart('2026-10-05', 2, new Date(2026, 9, 7));
    process.stdout.write(JSON.stringify({
      trapLive: new Date('2026-10-05').getDay() === 0,
      week1Start: s.projectWeekStart(p('2026-10-05'), 1).toDateString(),
      weekOnWed: s.currentProjectWeek(p('2026-10-05'), new Date(2026, 9, 7, 12)),
      weekBefore: s.currentProjectWeek(p('2026-10-05'), new Date(2026, 9, 2, 12)),
      moved,
      movedWeek1: s.projectWeekStart(p(moved), 1).toDateString(),
    }));
  `;
  const out = execFileSync(process.execPath, ['-r', 'sucrase/register/ts', '-e', script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'America/New_York' },
  });
  return JSON.parse(out);
}

describe('project weeks west of UTC (New York)', () => {
  const r = inNewYork();

  it('runs where the trap is live', () => {
    expect(r.trapLive).toBe(true);
  });

  it('week 1 is the week of the stored Monday', () => {
    expect(r.week1Start).toBe('Mon Oct 05 2026');
    expect(r.weekOnWed).toBe(1);
    expect(r.weekBefore).toBe(0);
  });

  it('a moved start lands where the picker said', () => {
    expect(r.moved).toBe('2026-10-19');
    expect(r.movedWeek1).toBe('Mon Oct 19 2026');
  });
});
