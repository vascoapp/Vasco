/**
 * Does the XRechnung we GENERATE pass the validator we PUBLISH?
 *
 * These two have never met. `generateXRechnungXML` is called from
 * `app/invoices/[id].tsx` and had zero test coverage; the validator at
 * `admin/src/lib/einvoice-validator.ts` is a public tool on the marketing site
 * and was written separately. Both claim EN 16931.
 *
 * That matters more here than anywhere else in the codebase: memory's GTM note
 * says the German e-invoicing mandate IS the wedge — the whole beachhead is
 * "we handle XRechnung and the competition is selling to the 2027 deadline".
 * An XRechnung a German buyer's system rejects is not a rough edge, it is the
 * product not existing.
 *
 * The validator takes an injected parser precisely so a test and the browser
 * take the same path through it, so this runs the REAL rules rather than a
 * second rule set I would have to keep correct.
 *
 * ⚠️ Passing here is NOT conformance. The validator says so itself: it is a
 * partial, structural + arithmetic check, and the authoritative one is KoSIT's.
 * A failure here is decisive; a pass only means the cheap mistakes are gone.
 */
import { DOMParser } from '@xmldom/xmldom';
import { generateXRechnungXML, type EInvoiceData } from '../einvoice';
import { validateXmlString } from '../../../admin/src/lib/einvoice-validator';

const parse = (s: string) => new DOMParser().parseFromString(s, 'text/xml') as unknown as Document;

/** A plausible German B2B invoice — the beachhead's actual case. */
const B2B: EInvoiceData = {
  sellerName: 'Elektro Meyer GmbH',
  sellerAddress: 'Hauptstraße 14',
  sellerVatId: 'DE123456789',
  // A German profile that passes checkInvoiceReadiness. All four are now
  // required for DE precisely because XRechnung rejects without them.
  sellerCity: 'Berlin',
  sellerPostalCode: '10115',
  sellerContactName: 'Jörg Meyer',
  sellerPhone: '+49 30 1234567',
  sellerEmail: 'buchhaltung@elektro-meyer.de',
  buyerCity: 'Berlin',
  buyerPostalCode: '10178',
  buyerName: 'Bäckerei Schmidt',
  buyerAddress: 'Marktplatz 3',
  invoiceNumber: 'R-2026-0042',
  invoiceDate: '2026-08-19',
  dueDate: '2026-09-18',
  currency: 'EUR',
  lineItems: [
    { description: 'Schaltschrank prüfen', quantity: 1, unitCode: 'stuk', unitPrice: 480, vatRate: 19, lineTotal: 480 },
    { description: 'Kabel NYM-J 3x1,5', quantity: 20, unitCode: 'm', unitPrice: 1.2, vatRate: 19, lineTotal: 24 },
  ],
  totalNet: 504,
  totalVat: 95.76,
  totalGross: 599.76,
} as EInvoiceData;

/** The B2G case, where a Leitweg-ID exists. */
const B2G: EInvoiceData = { ...B2B, leitwegId: '04011000-1234512345-06' };

const report = (r: ReturnType<typeof validateXmlString>) =>
  r.findings.filter((f) => f.severity === 'error').map((f) => `${f.rule}: ${f.message}`);

describe('generated XRechnung against our own published validator', () => {
  it('is well-formed UBL the validator recognises', () => {
    expect(validateXmlString(generateXRechnungXML(B2B), parse).format).toBe('UBL Invoice');
  });

  it('a B2G invoice (with Leitweg-ID) raises no errors', () => {
    expect(report(validateXmlString(generateXRechnungXML(B2G), parse))).toEqual([]);
  });

  it('a B2B invoice raises no errors', () => {
    // The beachhead is B2B: a Handwerker invoicing a bakery, with no
    // Leitweg-ID. If this differs from the B2G case, the difference IS the bug.
    expect(report(validateXmlString(generateXRechnungXML(B2B), parse))).toEqual([]);
  });

  // ── The five rules the old generator broke, pinned individually ────────
  // Named one by one rather than left to the aggregate: each is a distinct
  // rejection at a German buyer's gateway, and a future edit that drops one
  // should say which.

  it('BT-27/BT-44 — carries the LEGAL name, not just the trading name', () => {
    const xml = generateXRechnungXML(B2B);
    expect(xml).toContain('<cac:PartyLegalEntity><cbc:RegistrationName>Elektro Meyer GmbH');
    expect(xml).toContain('<cac:PartyLegalEntity><cbc:RegistrationName>Bäckerei Schmidt');
  });

  it('BG-23 — breaks VAT down per rate, not just a bare total', () => {
    const mixed: EInvoiceData = {
      ...B2B,
      lineItems: [
        { description: 'Arbeit', quantity: 1, unitCode: 'stuk', unitPrice: 100, vatRate: 19, lineTotal: 100 },
        { description: 'Ermäßigt', quantity: 1, unitCode: 'stuk', unitPrice: 100, vatRate: 7, lineTotal: 100 },
      ],
      totalNet: 200, totalVat: 26, totalGross: 226,
    } as EInvoiceData;
    const xml = generateXRechnungXML(mixed);
    // One subtotal per rate — an invoice mixing 19% and 7% is ordinary work.
    expect(xml.match(/<cac:TaxSubtotal>/g) ?? []).toHaveLength(2);
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">7.00</cbc:TaxAmount>');
    expect(report(validateXmlString(xml, parse))).toEqual([]);
  });

  it('BR-DE-15 — a B2B invoice still carries a buyer reference', () => {
    // The old generator emitted BT-10 only when a Leitweg-ID existed, so every
    // B2B invoice — the whole beachhead — was rejected.
    expect(generateXRechnungXML(B2B)).toContain('<cbc:BuyerReference>R-2026-0042</cbc:BuyerReference>');
    expect(generateXRechnungXML(B2G)).toContain('<cbc:BuyerReference>04011000-1234512345-06</cbc:BuyerReference>');
  });

  it('BR-DE-5/6/7 — seller contact name, phone and email', () => {
    const withContact: EInvoiceData = {
      ...B2B, sellerContactName: 'Jörg Meyer', sellerPhone: '+49 30 1234567', sellerEmail: 'buchhaltung@elektro-meyer.de',
    } as EInvoiceData;
    const xml = generateXRechnungXML(withContact);
    expect(xml).toContain('<cbc:Telephone>+49 30 1234567</cbc:Telephone>');
    expect(xml).toContain('<cbc:ElectronicMail>buchhaltung@elektro-meyer.de</cbc:ElectronicMail>');
    expect(report(validateXmlString(xml, parse))).toEqual([]);
  });

  it('reports the missing fields when the profile is incomplete', () => {
    // The other half of the gate: a contractor who has not filled in phone and
    // email must NOT get a silently-invalid invoice. Our own validator now
    // names the rule, which is what the contractor would otherwise learn days
    // later from a rejection they cannot read.
    const bare = { ...B2B, sellerPhone: undefined, sellerEmail: undefined } as EInvoiceData;
    const errs = report(validateXmlString(generateXRechnungXML(bare), parse));
    expect(errs).toEqual([
      'BR-DE-6: Missing: Seller contact telephone (BT-42).',
      'BR-DE-7: Missing: Seller contact email (BT-43).',
    ]);
  });

  it('does not declare a Dutch seller German', () => {
    // The country code was hardcoded 'DE' for both parties.
    const nl = generateXRechnungXML({ ...B2B, sellerCountry: 'NL', buyerCountry: 'DE' } as EInvoiceData);
    expect(nl).toContain('<cbc:IdentificationCode>NL</cbc:IdentificationCode>');
    expect(nl).toContain('<cbc:IdentificationCode>DE</cbc:IdentificationCode>');
  });
});
