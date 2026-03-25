// =============================================================================
// WHATSAPP SERVICE — Open WhatsApp with pre-filled messages
// =============================================================================

import { Linking, Alert } from 'react-native';

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
    Alert.alert('WhatsApp', 'Could not open WhatsApp. Make sure it is installed.');
    return false;
  }
}

/** Send invoice reminder via WhatsApp */
export function buildInvoiceReminderMessage(customerName: string, invoiceId: string, amount: number, daysOverdue: number): string {
  return `Hi ${customerName},\n\nThis is a friendly reminder about invoice ${invoiceId} for €${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}${daysOverdue > 0 ? ` which is ${daysOverdue} days overdue` : ''}.\n\nCould you arrange payment at your earliest convenience?\n\nThank you,\nSent via Vasco`;
}

/** Send quote follow-up via WhatsApp */
export function buildQuoteFollowUpMessage(customerName: string, jobTitle: string, amount: number): string {
  return `Hi ${customerName},\n\nI wanted to follow up on the quote for "${jobTitle}" (€${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}).\n\nDo you have any questions or would you like to proceed?\n\nBest regards,\nSent via Vasco`;
}

/** Send progress update via WhatsApp */
export function buildProgressMessage(customerName: string, jobTitle: string, hoursWorked: number): string {
  return `Hi ${customerName},\n\nQuick update on "${jobTitle}": ${hoursWorked}h worked today. Everything is on track.\n\nSent via Vasco`;
}
