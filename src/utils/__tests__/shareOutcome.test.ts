import { wasShareDismissed, SHARE_DISMISSED } from '../shareOutcome';

describe('wasShareDismissed', () => {
  it('is true only for an explicit dismissal', () => {
    expect(wasShareDismissed({ action: 'dismissedAction' })).toBe(true);
    expect(wasShareDismissed({ action: SHARE_DISMISSED })).toBe(true);
  });

  it('is false for a completed share', () => {
    expect(wasShareDismissed({ action: 'sharedAction' })).toBe(false);
    expect(wasShareDismissed({ action: 'sharedAction', activityType: 'com.apple.UIKit.activity.Mail' })).toBe(false);
  });

  /**
   * The trap this helper exists to avoid. A first version compared against
   * `Share.dismissedAction`; under a mock that leaves the constant undefined,
   * `undefined === undefined` reads EVERY share as dismissed — every send in
   * the app silently stops recording, all at once. Absence of an `action` is
   * absence of evidence, not evidence of dismissal.
   */
  it('treats a missing or malformed result as NOT dismissed', () => {
    expect(wasShareDismissed({})).toBe(false);
    expect(wasShareDismissed(undefined)).toBe(false);
    expect(wasShareDismissed(null)).toBe(false);
    expect(wasShareDismissed({ action: undefined })).toBe(false);
    expect(wasShareDismissed('dismissedAction')).toBe(false); // a bare string is not a result
  });

  it('pins the constant to React Native\'s own value', () => {
    // RN: `static dismissedAction: 'dismissedAction' = 'dismissedAction'`
    expect(SHARE_DISMISSED).toBe('dismissedAction');
  });
});
