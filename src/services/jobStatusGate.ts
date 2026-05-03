// =============================================================================
// JOB STATUS CHANGE GATE (R22)
// =============================================================================
// Wraps `validateJobStatusChange` so user-driven status transitions surface
// warnings/errors before the change instead of silently accepting them.
// Closes R2 deferral: AppState.updateJobStatus already runs the validator
// and returns `{ warnings }`, but no caller reads it — the user-facing
// "advance status" tap on /contractor/job/[id] just fired without checking.
//
// Same pattern as `gateReminderSend` (R287) and `gateQuoteValidation` (R304).
// =============================================================================

import { Alert } from 'react-native';
import i18n from '../i18n/i18n';
import { validateJobStatusChange } from './workflowValidatorService';

export async function gateJobStatusChange(
  currentStatus: string,
  newStatus: string,
  job: any,
): Promise<boolean> {
  const t = i18n.t.bind(i18n);
  const validation = validateJobStatusChange(currentStatus, newStatus, job);

  if (validation.valid && validation.warnings.length === 0) return true;

  const allMessages = [
    ...validation.errors.map((e) => `• ${e.message}`),
    ...validation.warnings.map((w) => `· ${w.message}`),
  ].join('\n');

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      validation.valid
        ? t('validator.jobStatusWarningTitle', 'Status change has warnings')
        : t('validator.jobStatusErrorTitle', 'Status change has issues'),
      allMessages,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: validation.valid
            ? t('common.continue', 'Continue')
            : t('validator.changeAnyway', 'Change anyway'),
          style: validation.valid ? 'default' : 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
