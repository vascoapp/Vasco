/**
 * @jest-environment node
 *
 * R323: the app rendered in the DEVICE language on a contractor's first login.
 *
 * `@vasco_user_profile` is written only by a profile edit or by onboarding, so
 * on a first login it does not exist. `applySavedLanguage` found nothing and
 * left i18next on the device locale — and because `populateQueue` PERSISTS the
 * copy it resolves, every AI queue card generated in that window kept the wrong
 * language forever. On the sim (device en-US, account nl) the whole home screen
 * rendered in English, and `pack_queued` events were stamped `locale: "en"`,
 * which is what `pickTemplateForLocale` uses to choose the message the
 * CUSTOMER receives.
 *
 * These tests pin the resolution order that fixes it:
 *   saved profile > account language > device locale.
 */

// jest.setup.ts replaces src/i18n/i18n with a stub whose `language` is the
// fixed string 'en' and whose `changeLanguage` is a no-op jest.fn(). Under that
// mock a language change is unobservable and every assertion here would pass
// vacuously. Un-mock it — driving real i18next is the whole point.
jest.unmock('../i18n');
jest.mock('expo-localization', () => ({
  // Pin the DEVICE locale so the fallback case asserts against a known value
  // rather than whatever machine runs the suite.
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { store.delete(k); }),
      clear: jest.fn(async () => { store.clear(); }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

import i18n from '../i18n';
import { applySavedLanguage, setAccountLanguage } from '../savedLanguage';

const PROFILE_KEY = '@vasco_user_profile';

describe('applySavedLanguage resolution order', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setAccountLanguage(undefined);
    await i18n.changeLanguage('en');
  });

  afterAll(async () => {
    setAccountLanguage(undefined);
    await i18n.changeLanguage('en');
  });

  it('falls back to the ACCOUNT language when no profile has been saved yet', async () => {
    // The first-login case. Before the fix this returned 'en' and the whole
    // app — plus every persisted queue card — stayed English.
    setAccountLanguage('nl');

    await expect(applySavedLanguage()).resolves.toBe('nl');
    expect(i18n.language).toBe('nl');
  });

  it('prefers the SAVED profile over the account language', async () => {
    // What the contractor last chose outranks where they started, so a
    // language switch in settings survives.
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ language: 'de' }));
    setAccountLanguage('nl');

    await expect(applySavedLanguage()).resolves.toBe('de');
    expect(i18n.language).toBe('de');
  });

  it('keeps the device language when neither source has one', async () => {
    await expect(applySavedLanguage()).resolves.toBe('en');
    expect(i18n.language).toBe('en');
  });

  it('ignores an empty or non-string account language', async () => {
    setAccountLanguage('');
    await expect(applySavedLanguage()).resolves.toBe('en');

    setAccountLanguage(null);
    await expect(applySavedLanguage()).resolves.toBe('en');
  });

  it('clearing the account language stops it applying to the next user', async () => {
    // Module state outlives the session; sign-out must reset it or the next
    // contractor inherits the previous one's language.
    setAccountLanguage('nl');
    await applySavedLanguage();
    expect(i18n.language).toBe('nl');

    await i18n.changeLanguage('en');
    setAccountLanguage(undefined);

    await expect(applySavedLanguage()).resolves.toBe('en');
  });

  it('survives unparseable profile JSON and still applies the account language', async () => {
    await AsyncStorage.setItem(PROFILE_KEY, '{not json');
    setAccountLanguage('nl');

    // A formatting preference must never take down its caller, but a corrupt
    // profile should not cost the contractor their language either.
    await expect(applySavedLanguage()).resolves.toBe('nl');
  });
});
