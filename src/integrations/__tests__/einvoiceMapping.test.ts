/**
 * The ES and IT mappers, and the two things they must never do.
 *
 * Before this file existed, both export buttons crashed: the screen built
 * `const data: any = {…}` and handed it to a generator expecting a completely
 * different shape. The `any` is why tsc never said so.
 *
 * The mappers now return the format's own type, so the compiler carries most of
 * it. What the compiler cannot carry is the part that costs money:
 *   · never invent a fiscal value (RF01 on a forfettario is a WRONG invoice
 *     that SDI ACCEPTS — worse than a rejection, because nobody finds out);
 *   · never emit a Natura/AliquotaIVA pair SDI rejects (00400 / 00401).
 */
import { toFatturaPA, toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import { generateFatturaPAXml } from '../einvoice-it';
import { generateFacturaeXml } from '../einvoice-es';

const IT: EInvoiceSource = {
  seller: {
    name: 'Idraulico Rossi SRL', vatId: 'IT12345678901', address: 'Via Roma 1',
    city: 'Milano', postcode: '20100', province: 'MI', country: 'IT',
    fiscalRegime: 'RF01', iban: 'IT60X0542811101000000123456',
  },
  buyer: {
    name: 'Panificio Bianchi', vatId: 'IT98765432109', address: 'Via Verdi 2',
    city: 'Milano', postcode: '20121', province: 'MI', country: 'IT',
    einvoiceRouting: 'ABC1234',
  },
  invoiceNumber: 'F-2026-0007', invoiceDate: '2026-08-19', dueDate: '2026-09-18',
  currency: 'EUR',
  lines: [{ description: 'Riparazione caldaia', quantity: 1, unitPrice: 200, lineTotal: 200, vatRate: 22, unit: 'pz' }],
  totalNet: 200, totalVat: 44, totalGross: 244,
};

const ES: EInvoiceSource = {
  seller: {
    name: 'Fontanería García SL', vatId: 'B12345678', address: 'Calle Mayor 1',
    city: 'Madrid', postcode: '28001', province: 'M', country: 'ES',
    personType: 'J', iban: 'ES9121000418450200051332',
  },
  buyer: {
    name: 'Panadería López', vatId: 'B87654321', address: 'Gran Vía 5',
    city: 'Madrid', postcode: '28013', province: 'M', country: 'ES',
  },
  invoiceNumber: 'F-2026-0007', invoiceDate: '2026-08-19', dueDate: '2026-09-18',
  currency: 'EUR',
  lines: [{ description: 'Reparación', quantity: 1, unitPrice: 200, lineTotal: 200, vatRate: 21 }],
  totalNet: 200, totalVat: 42, totalGross: 242,
};

describe('FatturaPA mapping', () => {
  it('produces a document the generator renders without throwing', () => {
    const r = toFatturaPA(IT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const xml = generateFatturaPAXml(r.document);
    expect(xml).toContain('<Denominazione>Idraulico Rossi SRL</Denominazione>');
    expect(xml).toContain('<CodiceDestinatario>ABC1234</CodiceDestinatario>');
    expect(xml).toContain('<RegimeFiscale>RF01</RegimeFiscale>');
    expect(xml).toContain('<Numero>F-2026-0007</Numero>');
  });

  it('SDI 00401 — no Natura on a standard-rated line', () => {
    const r = toFatturaPA(IT);
    if (!r.ok) throw new Error('expected ok');
    expect(r.document.dettaglioLinee[0].aliquotaIva).toBe(22);
    expect(r.document.dettaglioLinee[0].natura).toBeUndefined();
    expect(generateFatturaPAXml(r.document)).not.toContain('<Natura>');
  });

  it('SDI 00400 — a zero-rated line carries a Natura', () => {
    const zero = { ...IT, lines: [{ ...IT.lines[0], vatRate: 0 }], totalVat: 0, totalGross: 200 };
    const r = toFatturaPA(zero);
    if (!r.ok) throw new Error('expected ok');
    expect(r.document.dettaglioLinee[0].natura).toBe('N2.2');
    expect(generateFatturaPAXml(r.document)).toContain('<Natura>N2.2</Natura>');
  });

  it('refuses, naming the field, rather than defaulting the fiscal regime', () => {
    // The single most important line in this file. RF01 is the common case and
    // guessing it would make every test here pass — while quietly mis-declaring
    // every forfettario contractor on an invoice SDI accepts.
    const r = toFatturaPA({ ...IT, seller: { ...IT.seller, fiscalRegime: undefined } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing).toContainEqual({ key: 'profile.fiscalRegime', where: 'profile' });
  });

  it('refuses without a routing address — SDI cannot deliver it', () => {
    const r = toFatturaPA({ ...IT, buyer: { ...IT.buyer, einvoiceRouting: undefined, einvoiceEmail: undefined } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing).toContainEqual({ key: 'customer.einvoiceRouting', where: 'customer' });
  });

  it('accepts a PEC address instead of a Codice Destinatario', () => {
    // The two are alternatives, not both required.
    const r = toFatturaPA({
      ...IT,
      buyer: { ...IT.buyer, einvoiceRouting: undefined, einvoiceEmail: 'pec@panificio.it' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.document.codiceDestinatario).toBe('0000000');
  });

  it('names every missing field at once, not the first', () => {
    // A contractor should fill in one form, not discover the next gap on each
    // retry.
    const r = toFatturaPA({ ...IT, seller: { name: 'X' }, buyer: { name: 'Y' } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing.length).toBeGreaterThan(6);
    expect(r.missing.some((m) => m.where === 'profile')).toBe(true);
    expect(r.missing.some((m) => m.where === 'customer')).toBe(true);
  });
});

describe('Facturae mapping', () => {
  it('produces a document the generator renders without throwing', () => {
    const r = toFacturae(ES);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const xml = generateFacturaeXml(r.document);
    expect(xml).toContain('Fontanería García SL');
    expect(xml).toContain('B12345678');
  });

  it('reads person type from the NIF rather than assuming', () => {
    // A Spanish NIF starting with a letter is a legal entity; a natural
    // person's starts with a digit. That is the rule, not a guess.
    const company = toFacturae(ES);
    if (!company.ok) throw new Error('expected ok');
    expect(company.document.buyerPersonType).toBe('J');

    const person = toFacturae({ ...ES, buyer: { ...ES.buyer, vatId: '12345678Z' } });
    if (!person.ok) throw new Error('expected ok');
    expect(person.document.buyerPersonType).toBe('F');
  });

  it('does not invent an IRPF withholding', () => {
    // Whether IRPF applies is a fact about the engagement the app does not
    // hold. A wrong 15% would understate what the customer pays.
    const r = toFacturae(ES);
    if (!r.ok) throw new Error('expected ok');
    expect(r.document.totalIrpf).toBe(0);
  });

  it('refuses without the seller person type', () => {
    const r = toFacturae({ ...ES, seller: { ...ES.seller, personType: undefined } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.missing).toContainEqual({ key: 'profile.personType', where: 'profile' });
  });

  it('computes line VAT from the line, not the invoice total', () => {
    // Splitting a stated total proportionally drifts by a cent on mixed rates,
    // and that cent is exactly what Facturae's arithmetic checks compare.
    const mixed = toFacturae({
      ...ES,
      lines: [
        { description: 'a', quantity: 1, unitPrice: 100, lineTotal: 100, vatRate: 21 },
        { description: 'b', quantity: 1, unitPrice: 100, lineTotal: 100, vatRate: 10 },
      ],
      totalNet: 200, totalVat: 31, totalGross: 231,
    });
    if (!mixed.ok) throw new Error('expected ok');
    expect(mixed.document.lineItems.map((l) => l.ivaAmount)).toEqual([21, 10]);
  });
});
