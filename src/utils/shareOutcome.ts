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
 */
export const SHARE_DISMISSED = 'dismissedAction';

export function wasShareDismissed(result: unknown): boolean {
  const action = (result as { action?: unknown } | null | undefined)?.action;
  return action === SHARE_DISMISSED;
}
