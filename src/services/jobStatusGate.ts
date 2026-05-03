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
import { validateJobStatusChange, validateCertBeforeJobStart } from './workflowValidatorService';
import { complianceService } from './complianceService';

export async function gateJobStatusChange(
  currentStatus: string,
  newStatus: string,
  job: any,
): Promise<boolean> {
  const t = i18n.t.bind(i18n);
  const validation = validateJobStatusChange(currentStatus, newStatus, job);

  // R23: also run cert validation when transitioning into an active state.
  // Closes R2 deferral — validateCertBeforeJobStart was orphan code; now
  // surfaces expired/expiring certs before the contractor can start work.
  // Cert store is seeded empty per R289 production hardening; warning fires
  // only when the contractor has actually registered certs that match the
  // job's trade, so empty-state contractors don't see noisy false alarms.
  const isStartingWork =
    (newStatus === 'in-progress' || newStatus === 'bezig')
    && currentStatus !== 'in-progress' && currentStatus !== 'bezig';
  if (isStartingWork) {
    try {
      const certs = complianceService.getCertifications();
      const certCheck = validateCertBeforeJobStart(
        { trade: job.trade, title: job.title },
        certs.map((c) => ({
          name: c.name,
          type: c.category,
          trade: (c as any).trade ?? c.category,
          expiryDate: c.expiryDate instanceof Date ? c.expiryDate.toISOString() : String(c.expiryDate ?? ''),
          status: c.status,
        })),
      );
      if (!certCheck.valid) {
        validation.errors.push(...certCheck.errors);
      }
      if (certCheck.warnings.length > 0) {
        validation.warnings.push(...certCheck.warnings);
      }
    } catch {
      // Compliance service unavailable → skip cert gate (non-blocking).
    }
  }

  // Recompute valid after merging cert errors
  const finalValid = validation.errors.length === 0;
  if (finalValid && validation.warnings.length === 0) return true;

  const allMessages = [
    ...validation.errors.map((e) => `• ${e.message}`),
    ...validation.warnings.map((w) => `· ${w.message}`),
  ].join('\n');

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      finalValid
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
