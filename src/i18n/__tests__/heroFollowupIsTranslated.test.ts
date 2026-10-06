/**
 * Oggi's "follow up on N open quotes" had NO key in any locale — every
 * contractor with a sent quote read the English fallback, plural for one
 * ("Follow up on 1 open quotes"). IT walk 2026-10-06.
 */
import i18n from '../i18n';

const LANGS = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;

it.each(LANGS)('%s: the follow-up line is translated, and singular for one quote', async (lng) => {
  await i18n.changeLanguage(lng);
  const one = i18n.t('dk.hero.guideFollowup', { count: 1 });
  const two = i18n.t('dk.hero.guideFollowup', { count: 2 });
  expect(one).not.toMatch(/dk\.hero/);
  expect(one).toContain('1');
  expect(two).toContain('2');
  // A singular form of its own (French "devis en attente" happens to read the
  // same in both — the key must still exist, so i18next never falls back).
  expect(i18n.exists('dk.hero.guideFollowup_one', { lng, fallbackLng: false } as any)).toBe(true);
  if (lng !== 'en') expect(one).not.toMatch(/Follow up/);
});
