// Generator copy says "1 factuur", not "1 facturen" (emulator walk 2026-09-29:
// "1 facturen achterstallig: € 450" on Geld). gt() takes `<key>_one` for count 1.
import { gt, TRANSLATIONS } from '../generatorTranslations';

it('uses the singular for one', () => {
  expect(gt('fin_overdue_title', 'nl', { count: 1, amount: '€ 450' })).toBe('1 factuur achterstallig: € 450');
  expect(gt('fin_overdue_message', 'de', { count: 1, amount: '450 €', days: 15 })).toMatch(/^1 Rechnung offen/);
  expect(gt('evidence_based_on_jobs', 'nl', { count: 1 })).toBe('Op basis van 1 klus');
});

it('keeps the plural for more', () => {
  expect(gt('fin_overdue_title', 'nl', { count: 2, amount: '€ 900' })).toBe('2 facturen achterstallig: € 900');
});

it('every _one variant has all six languages and a plural sibling', () => {
  for (const k of Object.keys(TRANSLATIONS).filter((k) => k.endsWith('_one'))) {
    expect(TRANSLATIONS[k.slice(0, -4)]).toBeDefined();
    for (const l of ['nl', 'en', 'de', 'fr', 'es', 'it']) expect([k, l, typeof (TRANSLATIONS[k] as any)[l]]).toEqual([k, l, 'string']);
  }
});
