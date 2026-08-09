import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './i18n';

const PROFILE_KEY = '@vasco_user_profile';

/**
 * Apply the contractor's saved language preference to i18next.
 *
 * `i18n.ts` only reads the DEVICE locale at boot. The saved preference is
 * applied afterwards, asynchronously, once AuthContext has loaded the profile.
 * Anything that resolves copy in the gap between those two points resolves it
 * in the device language.
 *
 * That gap is not theoretical: the AI action queue PERSISTS the strings it
 * resolves at generation time, so a card generated inside the window keeps the
 * device language forever — a Dutch contractor on an English phone read
 * "Reminder for Vloerverwarming check" and "Speeds up payment by ~5 days"
 * between two correctly-Dutch cards on the home screen.
 *
 * Callers that author persisted copy must await this first.
 * Idempotent and safe to call repeatedly; resolves to the active language.
 */
export async function applySavedLanguage(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) {
      const profile = JSON.parse(raw) as { language?: unknown };
      const saved = profile?.language;
      if (typeof saved === 'string' && saved && i18n.language !== saved) {
        await i18n.changeLanguage(saved);
      }
    }
  } catch {
    // A formatting preference must never take down the caller. Falling through
    // leaves the device language, which is the pre-existing behaviour.
  }
  return i18n.language;
}
