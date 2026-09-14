// =============================================================================
// DURATIONS — one way to print "how long", in every locale
// =============================================================================
// Werk, the job screen and the week overview each carried a private copy of
// "whole hours → {{h}} Std., otherwise {{h}}:{{mm}} Std.". The day planner had
// no copy and passed the raw number straight into `common.durationH`, so a
// German contractor read "7.5 Std. / 10 Std." and a block "5.5 Std." — an
// English decimal point — beside "5:30 Std." for the same job on Aufträge
// (device walk, 2026-09-14).
// =============================================================================

type T = (key: string, opts: Record<string, unknown>) => string;

/** Hours (may be fractional) → "2 Std." / "5:30 Std." / "30 Min.". */
export function formatHoursDuration(t: T, hours: number): string {
  const totalMins = Math.max(0, Math.round((Number.isFinite(hours) ? hours : 0) * 60));
  if (totalMins > 0 && totalMins < 60) {
    return t('common.durationMin', { defaultValue: '{{m}} min', m: totalMins });
  }
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m === 0
    ? t('common.durationH', { defaultValue: '{{h}}h', h })
    : t('common.durationHm', { defaultValue: '{{h}}h{{m}}', h, m: String(m).padStart(2, '0') });
}

/** "08:30" → 8.5. Returns null for anything that is not an HH:MM time. */
export function hmToHours(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h + m / 60;
}
