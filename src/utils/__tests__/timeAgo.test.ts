/**
 * There were two copies of relative-time formatting: a localised one in the
 * notifications inbox, and a MODULE-LEVEL one in JobComments that returned
 * hardcoded English ("Just now", "5m ago") and fell back to the DEVICE locale
 * for anything older than a week. JobComments is mounted on the job detail
 * screen, so a Dutch contractor read their own job's comments in English.
 *
 * Module scope is why it drifted — no `t` up there, so English is the easy
 * path. This one takes `t` as an argument.
 */
import { formatTimeAgo } from '../timeAgo';

// Stands in for i18next: interpolates {{count}} so a param mismatch is visible.
const t = ((key: string, opts?: any) => {
  const map: Record<string, string> = {
    'notifications.justNow': 'nu',
    'notifications.minutesAgo': '{{count}}m',
    'notifications.hoursAgo': '{{count}}u',
    'notifications.daysAgo': '{{count}}d',
  };
  const s = map[key] ?? key;
  return s.replace('{{count}}', String(opts?.count ?? ''));
}) as any;

const NOW = new Date('2026-08-09T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatTimeAgo', () => {
  it('uses the translator, never a hardcoded English string', () => {
    expect(formatTimeAgo(ago(10_000), t, 'NL', NOW)).toBe('nu');
    expect(formatTimeAgo(ago(5 * MIN), t, 'NL', NOW)).toBe('5m');
    expect(formatTimeAgo(ago(3 * HOUR), t, 'NL', NOW)).toBe('3u');
    expect(formatTimeAgo(ago(2 * DAY), t, 'NL', NOW)).toBe('2d');
  });

  it('switches to a real date past a week, in the CONTRACTOR locale', () => {
    // "37d" stops being useful, and the old code used the device locale here.
    const nl = formatTimeAgo(ago(30 * DAY), t, 'NL', NOW);
    const uk = formatTimeAgo(ago(30 * DAY), t, 'UK', NOW);
    expect(nl).toMatch(/jul/i);      // 10 jul
    expect(uk).toMatch(/Jul/);       // 10 Jul
    expect(nl).not.toMatch(/\d+d$/);
  });

  it('reads a future timestamp as "now" rather than negative minutes', () => {
    // Clock skew between device and server is normal; "-3m" is not a time.
    expect(formatTimeAgo(new Date(NOW + 5 * MIN), t, 'NL', NOW)).toBe('nu');
  });

  it('returns empty rather than "Invalid Date" on unparseable input', () => {
    expect(formatTimeAgo('Just now', t, 'NL', NOW)).toBe('');
    expect(formatTimeAgo('', t, 'NL', NOW)).toBe('');
  });

  it('crosses each boundary at the right point', () => {
    expect(formatTimeAgo(ago(59 * MIN), t, 'NL', NOW)).toBe('59m');
    expect(formatTimeAgo(ago(60 * MIN), t, 'NL', NOW)).toBe('1u');
    expect(formatTimeAgo(ago(23 * HOUR), t, 'NL', NOW)).toBe('23u');
    expect(formatTimeAgo(ago(24 * HOUR), t, 'NL', NOW)).toBe('1d');
    expect(formatTimeAgo(ago(6 * DAY), t, 'NL', NOW)).toBe('6d');
    expect(formatTimeAgo(ago(7 * DAY), t, 'NL', NOW)).not.toMatch(/d$/);
  });
});
