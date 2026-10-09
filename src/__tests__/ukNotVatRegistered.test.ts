/**
 * @jest-environment node
 *
 * A UK trader who is NOT registered for VAT can invoice: no VAT number asked,
 * no VAT charged, the invoice says so; the customer portal follows the same
 * list (user decision 2026-10-09).
 */
const mockPrinted: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: async ({ html }: { html: string }) => { mockPrinted.push(html); return { uri: 'file:///cache/x.pdf' }; },
}));
import { checkInvoiceReadiness } from '../utils/businessProfileValidation';
import { getEffectiveVatRate, isSmallBusinessExempt } from '../domain/business';
import { isExemptVatScheme } from '../../supabase/functions/_shared/vatSchemes';
import { pdfInvoiceFromRecord } from '../services/invoicePdfSource';
import { renderInvoicePdfFile } from '../services/invoicePdfService';

const uk = {
  country: 'UK', businessName: 'Hughes Plumbing', address: '14 Brick Lane', postcode: 'E1 6AN', city: 'London',
  businessType: 'soleTrader', vatScheme: 'small_business_UK_unregistered',
} as any;

it('no VAT number is asked of a trader who is not VAT-registered', () => {
  expect(checkInvoiceReadiness(uk).ready).toBe(true);
  // …but a VAT-registered one still needs it.
  expect(checkInvoiceReadiness({ ...uk, vatScheme: 'standard' }).missing).toContain('profile.vatNumberOrUnregistered');
});

it('no VAT is charged, and the app and the portal agree on the list', () => {
  expect(getEffectiveVatRate(uk)).toBe(0);
  expect(isSmallBusinessExempt(uk)).toBe(true);
  expect(isExemptVatScheme('small_business_UK_unregistered')).toBe(true);
  expect(isExemptVatScheme('standard')).toBe(false);
});

it('the invoice states it carries no VAT because the trader is not registered', async () => {
  mockPrinted.length = 0;
  const auto = pdfInvoiceFromRecord({
    invoice: { id: 'INV0001', amount: 96.4, status: 'sent', customerName: 'Sarah Jones', createdAt: '2026-10-09' } as any,
    lines: [{ description: 'Fix leaking radiator valve', quantity: 1, unitPrice: 96.4 }],
    fallbackVatRatePercent: 0, fallbackDescription: 'x', country: 'UK',
  });
  await renderInvoicePdfFile(auto, uk);
  expect(auto.total).toBe(96.4);
  expect(mockPrinted[0]).toContain('Not registered for VAT');
});
