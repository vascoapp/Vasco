/**
 * @jest-environment node
 *
 * A CANCELLED SHARE IS NOT A SENT REMINDER
 *
 * `Share.share` RESOLVES with `{ action: 'dismissedAction' }` when the user
 * backs out — it does not throw. Both reminder handlers wrapped the call in
 * try/catch and returned success from the happy path, so the catch never ran
 * and cancelling still reported "Reminder sent".
 *
 * That is not cosmetic. `executeAction` writes the result to the action log and
 * emits a learning event, and the collections flow escalates off "a reminder
 * was already sent" — so a cancelled share could push a customer toward a final
 * notice for a message they never received.
 *
 * The handlers already carried an `action.shareCancelled` string, so the intent
 * was always there; only the mechanism was wrong. These tests pin the
 * mechanism, which is the part that silently regresses.
 */

const mockShare = jest.fn();

jest.mock('react-native', () => ({
  Share: {
    share: (...a: unknown[]) => mockShare(...a),
    // The real constant. A test that hardcodes 'dismissedAction' would still
    // pass if the production code compared against the wrong member.
    dismissedAction: 'dismissedAction',
    sharedAction: 'sharedAction',
  },
  Alert: { alert: (...a: unknown[]) => mockAlert(...a) },
  // iOS reports a dismissal; Android never does (see the Android block below).
  Platform: { get OS() { return mockOS.value; } },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
}));
const mockAlert = jest.fn();
const mockOS = { value: 'ios' };
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
// Returns a promise: executeAction calls .catch() on it.
jest.mock('../dataCollector', () => ({ emitBusinessEvent: jest.fn(async () => undefined) }));
jest.mock('../learningStorage', () => ({ recordMetricSnapshot: jest.fn() }));
jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'u1',
  // formatMoney2 reaches for this via the i18n formatting module.
  getCurrentCountry: () => 'NL',
  getCurrentTrade: () => 'plumbing',
  // signCustomerMessage signs with the profile's business name.
  getCurrentBusinessName: () => 'Hughes Plumbing',
}));

import { executeAction } from '../actionExecutor';

const reminder = {
  type: 'send_reminder' as const,
  params: { customerName: 'Bakkerij Smit', invoiceId: 'INV-1', amount: 280 },
};
const followup = {
  type: 'send_followup' as const,
  params: { customerName: 'Hotel NH', quoteId: 'Q-1', amount: 350 },
};

beforeEach(() => jest.clearAllMocks());

describe('send_reminder', () => {
  it('does NOT report success when the share sheet is dismissed', async () => {
    mockShare.mockResolvedValue({ action: 'dismissedAction' });
    const r = await executeAction(reminder as never, 'i1', 'g1');
    expect(r.success).toBe(false);
  });

  it('reports success when the share is actually completed', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    const r = await executeAction(reminder as never, 'i1', 'g1');
    expect(r.success).toBe(true);
  });

  it('still fails closed when the share throws', async () => {
    mockShare.mockRejectedValue(new Error('no share sheet'));
    const r = await executeAction(reminder as never, 'i1', 'g1');
    expect(r.success).toBe(false);
  });

  // Android resolves 'sharedAction' even for a backed-out chooser (RN docs),
  // so "sharedAction" proves nothing there: the contractor is asked.
  describe('on Android', () => {
    beforeEach(() => { mockOS.value = 'android'; mockShare.mockResolvedValue({ action: 'sharedAction' }); });
    afterEach(() => { mockOS.value = 'ios'; });

    it('does not report a reminder sent when the contractor says "not yet"', async () => {
      mockAlert.mockImplementation((_t: unknown, _b: unknown, buttons: any[]) => buttons[0].onPress());
      const r = await executeAction(reminder as never, 'i1', 'g1');
      expect(mockAlert).toHaveBeenCalledTimes(1);
      expect(r.success).toBe(false);
    });

    it('reports it once the contractor confirms', async () => {
      mockAlert.mockImplementation((_t: unknown, _b: unknown, buttons: any[]) => buttons[1].onPress());
      const r = await executeAction(reminder as never, 'i1', 'g1');
      expect(r.success).toBe(true);
    });
  });
});

describe('send_followup — the same handler shape, so the same trap', () => {
  it('does NOT report success when dismissed', async () => {
    mockShare.mockResolvedValue({ action: 'dismissedAction' });
    const r = await executeAction(followup as never, 'i1', 'g1');
    expect(r.success).toBe(false);
  });

  it('reports success when completed', async () => {
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    const r = await executeAction(followup as never, 'i1', 'g1');
    expect(r.success).toBe(true);
  });
});
