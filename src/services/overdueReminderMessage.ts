// =============================================================================
// OVERDUE REMINDER — the text a contractor shares with a late-paying CUSTOMER
// =============================================================================
// One builder for the two "remind" buttons that share plain text (Geld's
// overdue list, Facturen's no-automation fallback).
//
// 2026-09-14, German device: Geld's ERINNERN opened the share sheet with
//   "Hallo Bäckerei Lindner GmbH, eine freundliche Erinnerung: Ihre Rechnung
//    über € 5.200,00 ist seit 15 Tagen überfällig. …Vielen Dank!"
// — no invoice number (a customer with two open invoices cannot tell which,
// the #230 shape again) and no sender, in a message that may arrive by SMS
// from a number the customer has not saved. NL/ES/IT addressed the customer
// informally (je / tú / tu); customer copy is u / usted / Lei.
// =============================================================================

import type { TFunction } from 'i18next';

export interface OverdueReminderInput {
  customer: string;
  /** The invoice's document number — `documentNumber(invoice)`, never a row id. */
  number: string;
  /** Already formatted in the CONTRACTOR's currency. */
  amount: string;
  days: number;
  /** Business name from the profile; may be empty. */
  business: string;
}

export function overdueReminderMessage(t: TFunction, input: OverdueReminderInput): string {
  const days = Number.isFinite(input.days) ? Math.max(0, Math.round(input.days)) : 0;
  const text = t('money.reminderMessage', {
    defaultValue:
      'Hello {{customer}},\n\nA friendly reminder that invoice {{number}} for {{amount}} is now {{count}} days overdue. Could you arrange payment?\n\nThank you,\n{{business}}',
    customer: input.customer,
    number: input.number,
    amount: input.amount,
    count: days,
    business: input.business,
  }) as string;
  // An empty business name leaves the sign-off line dangling.
  return text.replace(/[ \t]+$/gm, '').trimEnd();
}
