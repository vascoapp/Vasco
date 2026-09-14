// The day planner printed "7.5 Std. / 10 Std." and "5.5 Std." in German — the
// raw number handed to common.durationH. Rendered through the REAL catalogue:
// jest.setup.ts mocks src/i18n/i18n to return defaultValue (learnings #326).
import i18next from 'i18next';
import de from '../locales/de.json';
import en from '../locales/en.json';
import { formatHoursDuration, hmToHours } from '../formatDuration';
import { detectConflicts } from '../../services/scheduleConflictService';

const i18n = i18next.createInstance();
beforeAll(async () => {
  await i18n.init({
    resources: { de: { translation: de }, en: { translation: en } },
    lng: 'de', fallbackLng: false, interpolation: { escapeValue: false }, compatibilityJSON: 'v4',
  });
});
const t = (k: string, o: Record<string, unknown>) => i18n.t(k, o) as string;

describe('formatHoursDuration (German)', () => {
  it('never prints a decimal hour', () => {
    expect(formatHoursDuration(t, 7.5)).not.toMatch(/\d[.,]\d/);
    expect(formatHoursDuration(t, 7.5)).toBe(t('common.durationHm', { h: 7, m: '30' }));
    expect(formatHoursDuration(t, 5.5)).toContain('5:30');
  });
  it('prints whole hours without minutes', () => {
    expect(formatHoursDuration(t, 10)).toBe(t('common.durationH', { h: 10 }));
  });
  it('prints under an hour in minutes', () => {
    expect(formatHoursDuration(t, 0.5)).toBe(t('common.durationMin', { m: 30 }));
  });
});

describe('hmToHours', () => {
  it('keeps the minutes', () => {
    expect(hmToHours('08:30')).toBe(8.5);
    expect(hmToHours('16:45')).toBe(16.75);
  });
  it('rejects what is not a time', () => {
    expect(hmToHours('')).toBeNull();
    expect(hmToHours('25:00')).toBeNull();
    expect(hmToHours(undefined)).toBeNull();
  });
});

describe('conflict reasons carry data, not only an English sentence', () => {
  it('names the other job and its real window', () => {
    const r = detectConflicts(
      { startHour: 9, durationHours: 1 },
      [{ jobId: 'j1', title: 'Heizungswartung', startHour: 8.5, durationHours: 2 }],
    );
    const overlap = r.issues.find((i) => i.kind === 'overlap')!;
    expect(overlap.conflictingTitle).toBe('Heizungswartung');
    expect([overlap.windowStart, overlap.windowEnd]).toEqual([8.5, 10.5]);
    expect(overlap.message).toContain('08:30–10:30');
    expect(overlap.message).not.toMatch(/\d\.\d+:00/);
  });
});
