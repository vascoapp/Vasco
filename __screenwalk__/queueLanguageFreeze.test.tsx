/**
 * The AI action queue freezes its copy in the language it was generated in.
 *
 * `aiActionQueueService` resolves card copy with `i18n.t` at GENERATION time
 * (`const t = i18n.t.bind(i18n)`) and persists the resulting `title` /
 * `description` / `estimatedImpact` strings into `@vasco_ai_queue`. Nothing
 * re-translates them on read, so a card keeps its original language forever.
 *
 * Memory has recorded the persistence twice, but only as a testing gotcha
 * ("the fix is invisible on an existing card — clear the queue to regenerate").
 * The user-facing consequence was never written down: if a fix cannot reach an
 * existing card, neither can the contractor changing their language.
 *
 * This test states the consequence rather than the mechanism.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../src/i18n/i18n';

const QUEUE_KEY = '@vasco_ai_queue';

describe('AI queue copy vs. the language the contractor reads in', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps the generation-time language after the contractor switches language', async () => {
    await i18n.changeLanguage('nl');
    const dutch = i18n.t('aiQueue.speedsUpPayment');
    expect(dutch).toBe('Versnelt betaling met ~5 dagen');

    // A card generated while the app was Dutch, persisted exactly as the
    // service writes it.
    await AsyncStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([{ id: 'q1', title: i18n.t('aiQueue.reminderFor', { ref: 'Hotel NH' }), estimatedImpact: dutch }]),
    );

    // The contractor switches to German in Profiel.
    await i18n.changeLanguage('de');
    expect(i18n.t('aiQueue.speedsUpPayment')).not.toBe(dutch); // the KEY translates fine

    const stored = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) as string);
    // ...but the card the contractor is looking at does not.
    expect(stored[0].estimatedImpact).toBe(dutch);
    expect(stored[0].title).toContain('Herinnering');
  });

  it('applySavedLanguage settles the language before copy is authored', async () => {
    const { applySavedLanguage } = require('../src/i18n/savedLanguage');

    // Boot state: i18n came up on the DEVICE locale, profile says Dutch.
    await i18n.changeLanguage('en');
    await AsyncStorage.setItem(
      '@vasco_user_profile',
      JSON.stringify({ trade: 'plumbing', country: 'NL', language: 'nl' }),
    );

    expect(i18n.t('aiQueue.speedsUpPayment')).toBe('Speeds up payment by ~5 days');
    await applySavedLanguage();
    // Anything persisting copy after this point stores Dutch, as it should.
    expect(i18n.t('aiQueue.speedsUpPayment')).toBe('Versnelt betaling met ~5 dagen');
  });

  it('applySavedLanguage leaves the device language when no profile is saved', async () => {
    const { applySavedLanguage } = require('../src/i18n/savedLanguage');
    await i18n.changeLanguage('en');
    expect(await applySavedLanguage()).toBe('en');
  });

  it('renders every queue string correctly when translated at READ time', async () => {
    // Control: the keys themselves are complete in all six locales, so the
    // defect is the persistence, not a missing translation.
    for (const lng of ['nl', 'de', 'fr', 'es', 'it']) {
      await i18n.changeLanguage(lng);
      expect(i18n.t('aiQueue.speedsUpPayment')).not.toMatch(/Speeds up payment/);
      expect(i18n.t('aiQueue.reminderFor', { ref: 'X' })).not.toMatch(/^Reminder for/);
    }
    await i18n.changeLanguage('nl');
  });
});
