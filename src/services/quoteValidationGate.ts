// =============================================================================
// QUOTE VALIDATION GATE (R304)
// =============================================================================
// Wraps `validateQuoteBeforeSend` with UI confirmation. Callers run this
// BEFORE invoking addQuote — if validation fails (no customer, zero amount,
// no line items), an Alert shows the issues with a "Send anyway" override.
//
// Closes the R2 deferral where the validator was wired into addQuote but
// the comment said `// Still allow creation` — every error silently swallowed.
// Now the contractor can knowingly override (e.g. zero-amount placeholder
// quote) but doesn't accidentally send a broken one.
//
// Same pattern as `gateReminderSend` from R287.
// =============================================================================

import { Alert } from 'react-native';
import i18n from '../i18n/i18n';
import { validateQuoteBeforeSend } from './workflowValidatorService';

export async function gateQuoteValidation(
  quote: { customer?: string; amount?: number; lineItems?: any[]; status?: string },
  existingQuotes: any[],
  country?: string,
): Promise<boolean> {
  const t = i18n.t.bind(i18n);
  const validation = validateQuoteBeforeSend(quote, existingQuotes, country);

  // No issues — proceed silently
  if (validation.valid && validation.warnings.length === 0) return true;

  const allMessages = [
    ...validation.errors.map((e) => `• ${e.message}`),
    ...validation.warnings.map((w) => `· ${w.message}`),
  ].join('\n');

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      validation.valid
        ? t('validator.quoteWarningTitle', 'Quote has warnings')
        : t('validator.quoteErrorTitle', 'Quote has issues'),
      allMessages,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: validation.valid
            ? t('common.continue', 'Continue')
            : t('validator.sendAnyway', 'Send anyway'),
          // Hard errors get destructive style so the contractor explicitly
          // overrides rather than tapping through.
          style: validation.valid ? 'default' : 'destructive',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
