/**
 * The customer's sign-off under an invoice: their NAME, in the invoice's
 * language, with the words they actually signed (sweep 2026-09-23, E1).
 *
 * Every caller omitted the language, so a German invoice closed on an English
 * sentence; the role printed as the raw enum "customer"; three screens put the
 * customer ID in the signer's name slot; and the text claimed "including all
 * documentation and keys" when the customer signed "the work is completed".
 */
jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {} }));

import { signOffBlock } from '../invoicePdfService';
import { customerSignOffFor } from '../../domain/signOff';

const CUSTOMERS = [{ id: 'c-1787349342347', name: 'Familie Becker' }];
const JOB = { signatureSvg: '<svg/>', customerSignoffAt: '2026-09-20T10:00:00Z', customerId: 'c-1787349342347' };

describe('sign-off on the invoice PDF', () => {
  it('names the customer, never their id', () => {
    const sig = customerSignOffFor(JOB, CUSTOMERS, { customerId: 'c-1787349342347' })!;
    expect(sig.signerName).toBe('Familie Becker');
  });

  it('falls back to the document customer, and to blank rather than an id', () => {
    expect(customerSignOffFor({ ...JOB, customerId: null }, CUSTOMERS, { customer: 'Familie Becker' })!.signerName).toBe('Familie Becker');
    expect(customerSignOffFor({ ...JOB, customerId: 'c-unknown' }, CUSTOMERS, {})!.signerName).toBe('');
    // Customer row deleted, name still on the document: keep the name…
    expect(customerSignOffFor({ ...JOB, customerId: 'c-gone' }, CUSTOMERS, { customer: 'Herr Weber' })!.signerName).toBe('Herr Weber');
    // …but an id in that slot is never printed as a name.
    expect(customerSignOffFor({ ...JOB, customerId: 'c-gone' }, CUSTOMERS, { customer: 'c-1790000000000' })!.signerName).toBe('');
    expect(customerSignOffFor({ ...JOB, customerId: 'c-gone' }, CUSTOMERS, { customer: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f' })!.signerName).toBe('');
  });

  it('no signature → no block', () => {
    expect(customerSignOffFor({ ...JOB, signatureSvg: null }, CUSTOMERS)).toBeUndefined();
  });

  it('a German invoice gets German legal text and role', async () => {
    const html = await signOffBlock(customerSignOffFor(JOB, CUSTOMERS)!, 'de');
    expect(html).toContain('Ich bestätige, dass die Arbeiten abgeschlossen wurden.');
    expect(html).toContain('Kunde');
    expect(html).toContain('Familie Becker');
    expect(html).not.toMatch(/\bcustomer\b|I confirm/);
  });

  it('claims only what the customer was asked: the work is completed', async () => {
    // Not "documentation and keys" (handover) and not "satisfactorily"
    // (job_closeout) — in DE/NL law the latter reads as acceptance without
    // reservation (review 2026-09-24).
    for (const lang of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
      const html = await signOffBlock(customerSignOffFor(JOB, CUSTOMERS)!, lang);
      expect(html).not.toMatch(/keys|sleutels|Schlüssel|clés|llaves|chiavi/);
      expect(html).not.toMatch(/satisfactor|tevredenheid|zufriedenstellend|satisfaisante|satisfactoriamente|soddisfacente/);
    }
  });
});
