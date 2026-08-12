import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './i18n';

const PROFILE_KEY = '@vasco_user_profile';

let accountLanguage: string | undefined;

/**
 * Record the language carried by the signed-in ACCOUNT — synchronously, at the
 * moment the user is set.
 *
 * `PROFILE_KEY` is only written by a profile edit or by onboarding, so on a
 * first login it does not exist yet and the lookup below finds nothing. Worse,
 * even once AuthContext seeds it, that write is a storage round-trip competing
 * with `backgroundJobScheduler`, which calls `populateQueue` on app open. React
 * effects fire bottom-up, so a provider-level effect cannot be relied on to win
 * that race either.
 *
 * Setting this from the sign-in handler removes the race entirely: it is plain
 * module state assigned before the resulting render commits, so it is already
 * in place by the time anything schedules work.
 */
export function setAccountLanguage(lang?: string | null): void {
  accountLanguage = typeof lang === 'string' && lang ? lang : undefined;
}

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
  let saved: string | undefined;
  // Read and parse in their own guard: a corrupt or unreadable profile must
  // not also cost the contractor the account language below.
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) {
      const profile = JSON.parse(raw) as { language?: unknown };
      const l = profile?.language;
      if (typeof l === 'string' && l) saved = l;
    }
  } catch {}

  try {
    // An explicitly saved preference outranks the account's own language: the
    // profile is what the contractor last chose, the account is only where
    // they started.
    const target = saved ?? accountLanguage;
    if (target && i18n.language !== target) {
      await i18n.changeLanguage(target);
    }
  } catch {
    // A formatting preference must never take down the caller. Falling through
    // leaves the device language, which is the pre-existing behaviour.
  }
  return i18n.language;
}
