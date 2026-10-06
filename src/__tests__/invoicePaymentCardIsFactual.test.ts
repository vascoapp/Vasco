/**
 * The invoice's payment card says how THIS invoice gets paid, and Mollie is a
 * small link — not a list of unusable methods under a big orange button.
 * User, ES walk 2026-10-06: "why is the mollie button so big whilst
 * creditcard/paypal are all very small?" / "whats the point if its just
 * informational?"
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.join(__dirname, '../../app/invoices/[id].tsx'), 'utf8'));

it('the method list renders only when Mollie is connected', () => {
  expect(src).toMatch(/\{mollieConnected && \(\s*<View style=\{styles\.paymentMethodList\}>/);
});

it('without Mollie the card states the bank transfer (or asks for the IBAN)', () => {
  expect(src).toMatch(/!mollieConnected && \([\s\S]{0,400}invoices\.paidByTransferTo[\s\S]{0,200}invoices\.noIbanForTransfer/);
});

it('connecting Mollie is a small link, not the accent action row', () => {
  expect(src).not.toMatch(/label=\{t\('invoices\.connectMollie'[^}]*\}\)?\s*\}[\s\S]{0,120}accent/);
  expect(src).toMatch(/accessibilityRole="link"[\s\S]{0,700}invoices\.offerOnlinePaymentMollie/);
});
