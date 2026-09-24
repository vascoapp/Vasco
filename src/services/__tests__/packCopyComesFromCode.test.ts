/**
 * Every automation-pack message a customer can receive comes from the copy in
 * code — `step.template` (Dutch) or `step.defaults[locale]` — never from the
 * locale files under `step.i18nKey`.
 *
 * Those keys hold pre-R49 copy, and for the appointment pack a LABEL: a Dutch
 * contractor's customer got the day-before SMS "Morgen" and the legacy,
 * formal, amount-less dunning text. Dutch has no `defaults.nl` for most steps,
 * so it always fell through to the locale file. The jest i18n stub returned ''
 * there, so no test could see it; this runs on REAL i18next (P0, 2026-09-24).
 */
import i18n from '../../i18n/i18n';
import { DEFAULT_PACKS, pickTemplateForLocale } from '../workflowPackService';

const LOCALES = ['nl', 'en', 'de', 'fr', 'es', 'it'] as const;

afterAll(async () => { await i18n.changeLanguage('en'); });

describe('pack copy comes from code', () => {
  for (const lng of LOCALES) {
    it(`${lng}: every step resolves to its in-code copy, whatever language i18n is in`, async () => {
      await i18n.changeLanguage(lng === 'en' ? 'nl' : 'en'); // deliberately NOT the target
      for (const pack of DEFAULT_PACKS) {
        for (const step of pack.steps as any[]) {
          const expected = step.defaults?.[lng] ?? (lng === 'nl' ? step.template : step.defaults?.en ?? step.template);
          expect(`${pack.id}:${lng}:${pickTemplateForLocale(step, lng)}`).toBe(`${pack.id}:${lng}:${expected}`);
        }
      }
    });
  }

  it('the Dutch appointment SMS is a sentence with the time, not the label "Morgen"', async () => {
    await i18n.changeLanguage('nl');
    const step = DEFAULT_PACKS.find((p) => p.id === 'afspraak_herinnering')!.steps[0];
    const text = pickTemplateForLocale(step, 'nl');
    expect(text).toContain('{{time}}');
    expect(text).not.toBe('Morgen');
  });
});
