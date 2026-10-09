/**
 * Did the share sheet actually send anything?
 *
 * `Share.share` RESOLVES with `{ action: 'dismissedAction' }` when the user
 * backs out — React Native's own docs say so — it does NOT throw. Code that
 * awaits it inside a try/catch and then writes state has recorded a send that
 * never happened. That defect has now been found and fixed five times in this
 * repo (R71 ai.tsx, actionExecutor, facturen.tsx, queueItemExecutor,
 * reputationService), so the check lives in one place.
 *
 * Compared against the STRING, not `Share.dismissedAction`. The constant is
 * `'dismissedAction'` either way, but a mock or a stripped build can leave the
 * constant undefined, and `undefined === undefined` would then read EVERY
 * share as dismissed — failing closed, silently, everywhere at once.
 *
 * Absence of evidence is not dismissal: a result with no `action` at all is
 * treated as NOT dismissed, because the only thing we may act on is an
 * explicit report that the user backed out.
 *
 * ⚠️ ANDROID NEVER REPORTS A DISMISSAL. React Native's docs: on Android the
 * promise "will always be resolved with action being Share.sharedAction" — and
 * it resolves as soon as the chooser OPENS. So `!wasShareDismissed(res)` is
 * true on every Android share, sent or not (aannemer walk, 2026-09-29): a
 * backed-out reminder advanced the queue, a purchase order went "submitted".
 * Use `shareOutcome` for a claim and `confirmShareSent` for a record.
 */
import { Alert, AppState, Platform } from 'react-native';
import appI18n from '../i18n/i18n';

export const SHARE_DISMISSED = 'dismissedAction';

export function wasShareDismissed(result: unknown): boolean {
  const action = (result as { action?: unknown } | null | undefined)?.action;
  return action === SHARE_DISMISSED;
}

/**
 * What the platform can tell us: iOS reports a dismissal, Android reports
 * nothing either way ('unknown'). A toast or a haptic claims only on 'shared'.
 */
export type ShareOutcome = 'dismissed' | 'shared' | 'unknown';

export function shareOutcome(result: unknown): ShareOutcome {
  if (wasShareDismissed(result)) return 'dismissed';
  return Platform.OS === 'android' ? 'unknown' : 'shared';
}

/**
 * May we RECORD that it went out (status sent, reminder done, queue item
 * executed)? iOS answers from the sheet; on Android the contractor is asked —
 * status follows the artefact, never the button (#197 / #339). Dismissing the
 * question is "not yet". Awaiting it also serialises a loop of shares, which
 * on Android otherwise opens every chooser at once.
 */
export function confirmShareSent(result: unknown, subject?: string): Promise<boolean> {
  const outcome = shareOutcome(result);
  if (outcome !== 'unknown') return Promise.resolve(outcome === 'shared');
  return askWasSent(subject);
}

/**
 * Ask the contractor whether it went out. For hand-offs no platform reports
 * on — a share on Android, or opening WhatsApp / mail on either platform.
 */
export async function askWasSent(subject?: string): Promise<boolean> {
  await whenInForeground();
  return new Promise((resolve) => {
    let settled = false;
    const settle = (sent: boolean) => { if (!settled) { settled = true; resolve(sent); } };
    Alert.alert(
      appI18n.t('share.sentTitle', 'Did it go out?'),
      // Name WHAT, when the caller knows: the question arrives after a hand-off
      // to another app and "it" was ambiguous (UK re-walk W186, 2026-10-09).
      subject
        ? appI18n.t('share.sentBodyNamed', { defaultValue: 'Did “{{subject}}” go out? Vasco cannot see it — it is only recorded once you confirm.', subject })
        : appI18n.t('share.sentBody', 'Vasco cannot see whether it was sent. It is only recorded once you confirm it.'),
      [
        { text: appI18n.t('share.sentNo', 'Not yet'), style: 'cancel', onPress: () => settle(false) },
        { text: appI18n.t('share.sentYes', 'Yes, sent'), onPress: () => settle(true) },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}

/**
 * Resolve once Vasco is in the foreground again.
 *
 * ⚠️ React Native 0.81, Android: an Alert raised while the activity is PAUSED
 * is lost for good — DialogModule parks it on a FragmentManagerHelper that its
 * getter re-creates on every access, so onHostResume looks on a fresh, empty
 * one and the callback never fires. The share chooser (and WhatsApp, Chrome…)
 * pauses us, and `Share.share` resolves as the chooser OPENS — so the question
 * vanished, the promise hung, and nothing was recorded or re-opened (emulator,
 * 2026-09-29). Wait a beat for the hand-off to take the screen, then for the
 * app to be active; AppState flips on the same onHostPause/onHostResume.
 */
export function whenInForeground(settleMs = 600): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (AppState.currentState === 'active') { resolve(); return; }
      const sub = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        sub.remove();
        // onHostResume sets DialogModule's foreground flag in the same pass
        // that emits 'active'; let it land before the Alert goes out.
        setTimeout(resolve, 250);
      });
    }, settleMs);
  });
}
