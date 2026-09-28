// =============================================================================
// WHATSAPP SERVICE — Open WhatsApp with pre-filled messages
// =============================================================================

import { Linking, Alert } from 'react-native';
import i18n from '../i18n/i18n';
import { formatMoney2 } from '../i18n/formatting';
import { toE164 } from '../utils/phone';

/**
 * Open WhatsApp with a pre-filled message. `https://wa.me/…` works whether or
 * not the app is installed (the web page hands over to it); `whatsapp://`
 * failed silently on phones without WhatsApp and three screens swallowed the
 * error, so a tap did nothing (emulator walk 2026-09-28).
 *
 * A national number is made international with the contractor's country
 * (`toE164`). If that is impossible (country unknown), WhatsApp still opens
 * with the text and the contractor picks the contact — never a wrong number.
 */
export async function sendWhatsApp(phone: string | undefined, message: string, contractorCountry?: string): Promise<boolean> {
  const e164 = toE164(phone, contractorCountry);
  const encoded = encodeURIComponent(message);
  const url = e164 ? `https://wa.me/${e164}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert('WhatsApp', i18n.t('whatsapp.openFailed', 'Could not open WhatsApp. Make sure it is installed.'));
    return false;
  }
}

// R66 round 7: localize WhatsApp customer-facing message templates. NL
// contractors heavily rely on WhatsApp for customer comms; sending an
// English reminder to a Dutch customer is the kind of thing that erodes
// trust on launch day.

/** Send invoice reminder via WhatsApp */
export function buildInvoiceReminderMessage(customerName: string, invoiceId: string, amount: number, daysOverdue: number): string {
  const amt = formatMoney2(amount);
  const overdue = daysOverdue > 0 ? i18n.t('whatsapp.invoiceOverdue', { days: daysOverdue }) : '';
  return i18n.t('whatsapp.invoiceReminder', { name: customerName, ref: invoiceId, amount: amt, overdue });
}

/** Send quote follow-up via WhatsApp */
export function buildQuoteFollowUpMessage(customerName: string, jobTitle: string, amount: number): string {
  const amt = formatMoney2(amount);
  return i18n.t('whatsapp.quoteFollowup', { name: customerName, job: jobTitle, amount: amt });
}

/** Send progress update via WhatsApp */
export function buildProgressMessage(customerName: string, jobTitle: string, hoursWorked: number): string {
  return i18n.t('whatsapp.progressUpdate', { name: customerName, job: jobTitle, hours: hoursWorked });
}
