/**
 * `daysUntil` (dateKey) replaced six `Math.ceil((new Date(x) - now) / day)`
 * copies (learnings #423): the customer portal's deadline pill, certificate
 * expiry, the payments "days to get paid", the background scheduler's alerts,
 * decision timing and DSO/on-time learning. Property, not a sample: the same
 * date reads the same at 00:01, 12:00 and 23:59, across the end of summer
 * time, east AND west of UTC. Re-runs itself with TZ set for real (a worker's
 * process.env.TZ does not reach V8).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const ZONE = process.env.DAYS_TZ_CHILD;

if (!ZONE) {
  describe('daysUntil across timezones', () => {
    it.each(['Europe/Amsterdam', 'America/New_York'])('passes in %s', (tz) => {
      const r = spawnSync(
        process.execPath,
        [require.resolve('jest/bin/jest'), '--config', path.join(ROOT, 'jest.config.js'), '--runTestsByPath', __filename],
        { cwd: ROOT, env: { ...process.env, TZ: tz, DAYS_TZ_CHILD: tz }, encoding: 'utf8' },
      );
      if (r.status !== 0) throw new Error(`child run (${tz}) failed:\n${r.stderr || r.stdout}`);
    }, 180_000);

    it('no live file counts calendar days in milliseconds (repo-wide)', () => {
      // The shape #298/#423/#424 fixed 32 times. Elapsed-time uses that really
      // mean "hours / 24" are allowed by name, with the reason.
      const ALLOWED: Record<string, string> = {
        'src/services/mlHealthCheck.ts': 'staleDays = elapsed age of a computation',
        'src/services/capacityPlanningService.ts': 'both sides set to local midnight, rounded',
        'src/intelligence/learningStorage.ts': 'ISO-week formula',
        'src/utils/dateKey.ts': 'the comment describing the old shape',
      };
      const dormant = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);
      const SHAPE = /Math\.(ceil|floor|round)\(.*(getTime\(\)|Date\.now\(\)).*\/ ?\(?(MS_PER_DAY|MS_DAY|dayMs|DAY_MS|86_?400_?000|864e5|1000 ?\* ?60 ?\* ?60 ?\* ?24|24 ?\* ?60 ?\* ?60 ?\* ?1000|1000 ?\* ?3600 ?\* ?24)/;
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
          const rel = path.join(dir, e.name);
          if (e.isDirectory()) { if (!/node_modules|__tests__|__screenwalk__/.test(e.name)) walk(rel); continue; }
          if (!/\.(ts|tsx)$/.test(e.name) || dormant.has(rel) || ALLOWED[rel]) continue;
          fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').forEach((line, i) => {
            if (SHAPE.test(line)) offenders.push(`${rel}:${i + 1}`);
          });
        }
      };
      walk('app'); walk('src');
      expect(offenders).toEqual([]);
    });

    it('the six call sites use dateKey, not millisecond day arithmetic', () => {
      const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
      const portal = read('src/components/customer/CustomerDecisionPortal.tsx');
      expect(portal).not.toMatch(/MS_DAY\b/);
      expect(portal).toMatch(/const until = daysUntil\(dueDate\);/);
      const certs = read('app/(contractor)/certificaten.tsx');
      expect(certs).not.toMatch(/\/ \(1000 \* 60 \* 60 \* 24\)|\/ MS_PER_DAY/);
      expect(certs).toMatch(/return daysUntil\(date\) \?\? 0;/);
      const pay = read('src/components/contractor/IntegratedPayments.tsx');
      expect(pay).not.toMatch(/\/ 86_400_000/);
      const sched = read('src/intelligence/backgroundJobScheduler.ts');
      expect(sched).not.toMatch(/Math\.(ceil|floor|round)\(.*(getTime\(\)|Date\.now\(\)).*\/ \(?(MS_PER_DAY|dayMs)\b/);
      const dec = read('src/intelligence/decisionIntelligence.ts');
      expect(dec).not.toMatch(/\(1000 \* 60 \* 60 \* 24\)/);
      const learn = read('src/intelligence/learningStorage.ts');
      expect(learn).not.toMatch(/Math\.round\(\(paid - issued\) \/ MS_PER_DAY\)/);
      expect(learn).not.toMatch(/const onTime = paid <= due;/);
    });
  });
}

(ZONE ? describe : describe.skip)(`daysUntil in ${ZONE}`, () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { daysUntil, calendarDaysBetween, parseCalendarDay } = require('../dateKey');

  it('the process really is in that zone', () => {
    const off = new Date(2026, 6, 1).getTimezoneOffset();
    expect(ZONE === 'America/New_York' ? off > 0 : off < 0).toBe(true);
  });

  it.each([[0, 1], [12, 0], [23, 59]])('a key due tomorrow reads 1 at %i:%i, today 0, yesterday -1', (h, m) => {
    const now = new Date(2026, 9, 19, h, m);
    expect(daysUntil('2026-10-20', now)).toBe(1);
    expect(daysUntil('2026-10-19', now)).toBe(0);
    expect(daysUntil('2026-10-18', now)).toBe(-1);
  });

  it.each([[0, 1], [12, 0], [23, 59]])('30 days across the end of summer time read 30 at %i:%i', (h, m) => {
    const now = new Date(2026, 9, 13, h, m);
    const end = new Date(now); end.setDate(end.getDate() + 30);
    expect(daysUntil(end, now)).toBe(30);
    expect(daysUntil(end.toISOString(), now)).toBe(30);
    expect(daysUntil('2026-11-12', now)).toBe(30);
  });

  it('unreadable input is null, not NaN', () => {
    expect(daysUntil('', new Date())).toBeNull();
    expect(daysUntil(null, new Date())).toBeNull();
    expect(daysUntil('not a date', new Date())).toBeNull();
    expect(daysUntil(new Date('x'), new Date())).toBeNull();
  });

  it('an invoice row due tomorrow reads dueInDays 1 at any hour (mappers)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { documentRowToInvoice } = require('../../lib/mappers');
    for (const [h, m] of [[0, 1], [12, 0], [23, 59]]) {
      jest.useFakeTimers().setSystemTime(new Date(2026, 9, 19, h, m));
      expect(documentRowToInvoice({ id: 'x', doc_type: 'invoice', status: 'sent', due_date: '2026-10-20', user_id: 'u' } as any).dueInDays).toBe(1);
    }
    jest.useRealTimers();
  });

  it('a license expiring today is 0 days out just after midnight (licenseExpiry)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getExpiringLicenses } = require('../../services/licenseExpiryService');
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 20, 0, 30));
    const [l] = getExpiringLicenses({ licenses: [{ id: 'l', expiryDate: '2026-10-20' }] } as any);
    jest.useRealTimers();
    expect(l.daysUntilExpiry).toBe(0);
    expect(l.severity).toBe('urgent');
  });

  it('paying on the due date is on time (the learningStorage rule)', () => {
    const paid = parseCalendarDay(new Date(2026, 9, 20, 16, 30).toISOString());
    const due = parseCalendarDay('2026-10-20');
    expect(calendarDaysBetween(paid, due) >= 0).toBe(true);
  });
});
