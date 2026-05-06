// =============================================================================
// WHATSAPP SERVICE — Open WhatsApp with pre-filled messages
// =============================================================================

import { Linking, Alert } from 'react-native';
import i18n from '../i18n/i18n';

/** Open WhatsApp with a pre-filled message to a phone number */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  // Clean phone: remove spaces, dashes. Ensure starts with country code
  const cleaned = phone.replace(/[\s\-().]/g, '');
  const number = cleaned.startsWith('+') ? cleaned.substring(1) : cleaned;

  const encoded = encodeURIComponent(message);
  const url = `whatsapp://send?phone=${number}&text=${encoded}`;
  const webUrl = `https://wa.me/${number}?text=${encoded}`;

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    // Fallback to web URL (works on web + when app not installed)
    await Linking.openURL(webUrl);
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
  const amt = amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  const overdue = daysOverdue > 0 ? i18n.t('whatsapp.invoiceOverdue', { days: daysOverdue }) : '';
  return i18n.t('whatsapp.invoiceReminder', { name: customerName, ref: invoiceId, amount: amt, overdue });
}

/** Send quote follow-up via WhatsApp */
export function buildQuoteFollowUpMessage(customerName: string, jobTitle: string, amount: number): string {
  const amt = amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return i18n.t('whatsapp.quoteFollowup', { name: customerName, job: jobTitle, amount: amt });
}

/** Send progress update via WhatsApp */
export function buildProgressMessage(customerName: string, jobTitle: string, hoursWorked: number): string {
  return i18n.t('whatsapp.progressUpdate', { name: customerName, job: jobTitle, hours: hoursWorked });
}
