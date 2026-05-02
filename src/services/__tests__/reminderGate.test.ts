// =============================================================================
// reminderGate.test.ts (R287)
// =============================================================================
// Verifies the validator gate around reminder sends. Before R287,
// validateReminderBeforeSend was orphan code — exported but called nowhere.
// =============================================================================

import { Alert } from 'react-native';
import { gateReminderSend } from '../reminderGate';

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('gateReminderSend', () => {
  it('blocks reminders for paid invoices', async () => {
    const ok = await gateReminderSend({ status: 'paid' }, 0);
    expect(ok).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
    const [title] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toMatch(/cannot send/i);
  });

  it('blocks reminders for draft invoices (not yet sent)', async () => {
    const ok = await gateReminderSend({ status: 'draft' }, 0);
    expect(ok).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('passes through for sent invoices with no warnings', async () => {
    const ok = await gateReminderSend({ status: 'sent' }, 0);
    expect(ok).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('confirms before sending when 5+ reminders already sent', async () => {
    // Mock Alert to auto-confirm via the second button (Continue)
    (Alert.alert as jest.Mock).mockImplementation((_t, _m, btns) => {
      const continueBtn = (btns ?? []).find((b: any) => b.text && b.text.toLowerCase().match(/continue/));
      continueBtn?.onPress?.();
    });
    const ok = await gateReminderSend({ status: 'sent' }, 5);
    expect(ok).toBe(true);
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('cancels when user dismisses warning', async () => {
    (Alert.alert as jest.Mock).mockImplementation((_t, _m, btns) => {
      const cancelBtn = (btns ?? []).find((b: any) => b.style === 'cancel');
      cancelBtn?.onPress?.();
    });
    const ok = await gateReminderSend({ status: 'sent' }, 7);
    expect(ok).toBe(false);
  });
});
