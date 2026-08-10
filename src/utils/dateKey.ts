// =============================================================================
// DATE KEYS — calendar-day strings in LOCAL time
// =============================================================================
//
// `date.toISOString().slice(0, 10)` is the wrong way to get a calendar day.
// toISOString() converts to UTC first, so for any timezone east of Greenwich
// (all six EU markets) a local midnight becomes the PREVIOUS day:
//
//   new Date(2026, 6, 19)           // Sun 19 Jul 00:00 CEST (UTC+2)
//     .toISOString().slice(0, 10)   // → "2026-07-18"  ❌ Saturday
//
// That shifted every bucket in the weekly planner by one day: jobs scheduled
// on Tuesday rendered under Monday and the last day of the week was empty.
// Use these helpers whenever the string is a calendar day the USER sees or
// that is compared against a stored `scheduledDate`.
//
// (Keep toISOString() for real instants — created_at, API timestamps, sorting.
// Those are points in time, not calendar days, and UTC is correct there.)
// =============================================================================

/** `YYYY-MM-DD` for the given date, in the device's local timezone. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The inverse of `localDateKey`: a `YYYY-MM-DD` calendar day → LOCAL midnight.
 *
 * `new Date('2026-05-12')` parses a date-only string as **UTC** midnight, so in
 * all six EU markets it lands at 01:00/02:00 local and any comparison against a
 * local week boundary is hours out — the same bug this file exists to prevent,
 * running the other way. The family could WRITE a local day key but not READ
 * one, and a helper family with a gap invites the bug straight back (#130).
 *
 * Returns null rather than an Invalid Date: a caller that cannot tell the two
 * apart renders "Invalid Date" at the user, which has happened here before.
 */
export function parseLocalDateKey(key: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key ?? ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * `YYYY-MM-DD` for today, local time. Call this at render/handler time —
 * never hoist the result to module scope, where it freezes at bundle load
 * and the app reports a stale "today" for the rest of the session.
 */
export function todayKey(): string {
  return localDateKey(new Date());
}

/**
 * Monday 00:00 of the week containing `d`, local time.
 *
 * Monday-start because every market this app ships to is EU (and the UK),
 * where the working week starts Monday — `getDay()` returns 0 for Sunday, so
 * the naive `-getDay()` lands a week early every Sunday.
 *
 * Extracted from `weekly-overview.tsx`, which had the only copy. The week
 * planner needs the same boundary, and two private copies of calendar
 * arithmetic is exactly how this codebase ended up with screens disagreeing
 * about which day it is.
 */
export function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** The seven local date keys of the week containing `d`, Monday first. */
export function weekKeys(d: Date): string[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return localDateKey(day);
  });
}
