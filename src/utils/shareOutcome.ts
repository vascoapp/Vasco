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
import { Alert, Platform } from 'react-native';
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
export function confirmShareSent(result: unknown): Promise<boolean> {
  const outcome = shareOutcome(result);
  if (outcome !== 'unknown') return Promise.resolve(outcome === 'shared');
  return askWasSent();
}

/**
 * Ask the contractor whether it went out. For hand-offs no platform reports
 * on — a share on Android, or opening WhatsApp / mail on either platform.
 */
export function askWasSent(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (sent: boolean) => { if (!settled) { settled = true; resolve(sent); } };
    Alert.alert(
      appI18n.t('share.sentTitle', 'Did it go out?'),
      appI18n.t('share.sentBody', 'Vasco cannot see whether it was sent. It is only recorded once you confirm it.'),
      [
        { text: appI18n.t('share.sentNo', 'Not yet'), style: 'cancel', onPress: () => settle(false) },
        { text: appI18n.t('share.sentYes', 'Yes, sent'), onPress: () => settle(true) },
      ],
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}
