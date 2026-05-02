// =============================================================================
// REMINDER GATE (R287)
// =============================================================================
// Wraps `validateReminderBeforeSend` from workflowValidatorService so all
// reminder-send call sites get consistent error/warning UX without each
// duplicating the validation logic. Returns a Promise<boolean>: true means
// the caller should proceed with the share / send, false means the user
// cancelled or the validator blocked it.
//
// Before R287, validateReminderBeforeSend was orphan code — exported but
// imported nowhere — so contractors could send reminders for already-paid
// invoices, draft invoices, or 5+ times in a row.
// =============================================================================

import { Alert } from 'react-native';
import i18n from '../i18n/i18n';
import { validateReminderBeforeSend } from './workflowValidatorService';
import type { CustomerTag } from './customerTaggingService';

export async function gateReminderSend(
  invoice: { status?: string; [k: string]: any },
  remindersAlreadySent: number = 0,
  customerTag?: CustomerTag,
): Promise<boolean> {
  const t = i18n.t.bind(i18n);
  const validation = validateReminderBeforeSend(invoice, remindersAlreadySent);

  // Hard errors — block with explanation. Already-paid + not-yet-sent are
  // both correctness violations, not preferences.
  if (!validation.valid) {
    Alert.alert(
      t('validator.reminderBlockedTitle', 'Cannot send reminder'),
      validation.errors.map(e => e.message).join('\n'),
    );
    return false;
  }

  // R300: tag-aware confirmation layer. The customer's tag is shown to the
  // contractor in the AI queue customerContext line but didn't gate behavior
  // before. Now: VIPs get a softer-language confirm before any reminder,
  // INACTIVE gets a different prompt (often the customer left, no point
  // burning the relationship), default tags fall through to the standard
  // warning loop. RISKY skips the confirm because the contractor probably
  // wants to send anyway — but we still respect the >5 threshold.
  if (customerTag === 'vip') {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('validator.vipReminderTitle', 'Send reminder to VIP?'),
        t('validator.vipReminderBody', 'This is a VIP customer. A friendly call may work better than a written reminder.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('validator.sendAnyway', 'Send anyway'), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!proceed) return false;
  } else if (customerTag === 'inactive') {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('validator.inactiveReminderTitle', 'Inactive customer'),
        t('validator.inactiveReminderBody', 'This customer has been inactive for over a year. Continue anyway?'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('validator.sendAnyway', 'Send anyway'), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!proceed) return false;
  }

  // Warnings — confirm before sending. Currently only the "5+ already sent"
  // warning lives here; treat any future warning the same way.
  if (validation.warnings.length > 0) {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        t('validator.reminderWarningTitle', 'Send reminder?'),
        validation.warnings.map(w => w.message).join('\n'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('common.continue', 'Continue'), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  }
  return true;
}
