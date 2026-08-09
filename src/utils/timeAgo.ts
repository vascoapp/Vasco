// =============================================================================
// RELATIVE TIME — "nu", "5m", "3u", "2d", then a real date
// =============================================================================
// There were two copies of this. `notifications.tsx` had a localised one inside
// the component; `JobComments.tsx` had a module-level copy that returned
// hardcoded English ("Just now", "5m ago") and fell back to
// `toLocaleDateString(undefined)` — the DEVICE locale — on anything older than
// a week. JobComments is mounted on the job detail screen, so a Dutch
// contractor read their own job's comments timestamped in English.
//
// Being module-level is exactly why it drifted: outside the component there is
// no `t` in scope, so English is the path of least resistance. Both are now on
// this one, which takes `t` as an argument so it cannot happen again.
// =============================================================================

import { formatDayMonth, type Country } from '../i18n/formatting';

type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Relative time for a recent event, falling back to a real date after a week.
 *
 * Keys live under `notifications.*` and already exist in all six locales —
 * reused rather than duplicated, so the two surfaces cannot word the same
 * elapsed time differently.
 */
export function formatTimeAgo(
  date: Date | string,
  t: TFn,
  country: Country = 'NL',
  now: number = Date.now(),
): string {
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  if (!Number.isFinite(then)) return '';

  const mins = Math.floor((now - then) / 60000);
  // A clock skew or a future timestamp should read as "now", not "-3m".
  if (mins < 1) return t('notifications.justNow', { defaultValue: 'Just now' });
  if (mins < 60) return t('notifications.minutesAgo', { defaultValue: '{{count}}m', count: mins });

  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notifications.hoursAgo', { defaultValue: '{{count}}h', count: hours });

  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.daysAgo', { defaultValue: '{{count}}d', count: days });

  // Past a week "37d" stops being useful; give the actual date, in the
  // contractor's locale rather than the handset's.
  return formatDayMonth(new Date(then), country);
}
