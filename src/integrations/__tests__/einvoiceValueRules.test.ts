/**
 * @jest-environment node
 */
// The VALUE rules SDI (Italy) and FACe (Spain) apply after the schema
// (src/integrations/einvoiceValueRules.ts), and the generator/mapper defects
// they found on their first run (2026-10-01):
//   · Quantita / Quantity printed with 2 decimals → SDI 00423 / HAP II.6a;
//   · `toFixed` on a raw line total (73.315 → 73.31) beside round2 sums
//     (73.32) → HAP II.6b, and a summary that disagreed with its lines;
//   · the Italian profile's REA number written as <CodiceFiscale> (00200);
//   · an ES-prefixed DNI and every NIE filed as a COMPANY;
//   · a file name SDI discards on sight (00001).
// Each rule family is proved twice: our generated invoices pass it, and a
// document mutated to break it is caught with the official code.
import fs from 'fs';
import path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { checkFatturaPA, checkFacturae, fatturaPaFileName, isValidFatturaPaFileName, blockingFindingLines, RULE_KEYS, type RuleFinding } from '../einvoiceValueRules';
import { isValidPartitaIva, isValidCodiceFiscale, checkSpanishTaxId, spanishPersonType, isSpanishPublicBodyNif } from '../fiscalIds';
import { parseXml, type XmlNode } from '../miniXml';
import { decimalText, moneyText, latin1Text } from '../einvoiceText';
import { toFatturaPA, toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import { generateFatturaPAXml, fatturaTransmitterId } from '../einvoice-it';
import { generateFacturaeXml } from '../einvoice-es';
import { stripComments } from '../../utils/stripComments';

const TODAY = '2026-10-01';
const codes = (fs_: RuleFinding[], sev: RuleFinding['severity'] = 'error') => [...new Set(fs_.filter((f) => f.severity === sev).map((f) => f.code))].sort();

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------
const line = (description: string, quantity: number, unitPrice: number, vatRate: number) =>
  ({ description, quantity, unitPrice, lineTotal: quantity * unitPrice, vatRate });

const itSrc = (over: Partial<EInvoiceSource> = {}): EInvoiceSource => ({
  seller: { name: 'Idraulica Bianchi S.r.l.', vatId: 'IT01234567897', taxId: 'REA MI-1234567', address: 'Via Roma 10', city: 'Milano', postcode: '20121', province: 'MI', country: 'IT', fiscalRegime: 'RF01', iban: 'IT60X0542811101000000123456' },
  buyer: { name: 'Panificio Bruno S.r.l.', vatId: 'IT09876543217', address: 'Corso Italia 5', city: 'Torino', postcode: '10121', province: 'TO', country: 'IT', einvoiceRouting: 'ABCDEF1' },
  invoiceNumber: 'FT-2026-0101', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
  lines: [line('Manodopera', 1.333, 55, 22), line('Tubo rame', 2.5, 12.99, 22), line('Bagno', 1.125, 199.99, 10)],
  totalNet: 0, totalVat: 0, totalGross: 0,
  ...over,
} as EInvoiceSource);

const esSrc = (over: Partial<EInvoiceSource> = {}): EInvoiceSource => ({
  seller: { name: 'Fontanería Ruiz S.L.', taxId: 'B12345674', address: 'Calle Mayor 1', city: 'Madrid', postcode: '28013', province: 'Madrid', country: 'ES', personType: 'J', iban: 'ES9121000418450200051332' },
  buyer: { name: 'Panadería Navarro S.L.', vatId: 'ESB87654323', address: 'Calle Sol 3', city: 'Sevilla', postcode: '41001', province: 'Sevilla', country: 'ES' },
  invoiceNumber: 'FA-2026-0101', invoiceDate: '2026-09-30', dueDate: '2026-10-30', currency: 'EUR',
  lines: [line('Mano de obra', 1.333, 55, 21), line('Reforma', 1.125, 199.99, 10)],
  totalNet: 0, totalVat: 0, totalGross: 0,
  ...over,
} as EInvoiceSource);

const itXml = (over: Partial<EInvoiceSource> = {}) => {
  const r = toFatturaPA(itSrc(over));
  if (!r.ok) throw new Error(JSON.stringify(r.missing));
  return { xml: generateFatturaPAXml(r.document), doc: r.document };
};
const esXml = (over: Partial<EInvoiceSource> = {}) => {
  const r = toFacturae(esSrc(over));
  if (!r.ok) throw new Error(JSON.stringify(r.missing));
  return { xml: generateFacturaeXml(r.document), doc: r.document };
};
/** Replace the first (or every) match — and fail loudly if the mutation did not apply. */
const mutate = (xml: string, from: string | RegExp, to: string): string => {
  const out = xml.replace(from, to);
  if (out === xml) throw new Error(`mutation did not apply: ${from}`);
  return out;
};

// ---------------------------------------------------------------------------
// Check digits
// ---------------------------------------------------------------------------
describe('fiscal identifiers (00301/00302/00305/00306, HAP II.5b)', () => {
  it('partita IVA: Luhn-style check digit', () => {
    expect(isValidPartitaIva('01234567897')).toBe(true);
    expect(isValidPartitaIva('09876543217')).toBe(true);
    expect(isValidPartitaIva('09876543210')).toBe(false);
    expect(isValidPartitaIva('00000000000')).toBe(false);
    expect(isValidPartitaIva('1234567890')).toBe(false);
  });
  it('codice fiscale: 16-character check letter (and 11-digit entity codes)', () => {
    expect(isValidCodiceFiscale('RSSMRA80A01H501U')).toBe(true);
    expect(isValidCodiceFiscale('RSSMRA80A01F205X')).toBe(true);
    expect(isValidCodiceFiscale('rssmra80a01h501u')).toBe(true);
    expect(isValidCodiceFiscale('RSSMRA80A01H501A')).toBe(false);
    expect(isValidCodiceFiscale('REA MI-1234567')).toBe(false);
    expect(isValidCodiceFiscale('01234567897')).toBe(true);
  });
  it('Spanish NIF: DNI, NIE, K/L/M and entity (CIF) control characters', () => {
    expect(checkSpanishTaxId('12345678Z')).toMatchObject({ valid: true, kind: 'DNI' });
    expect(checkSpanishTaxId('12345678A').valid).toBe(false);
    expect(checkSpanishTaxId('X1234567L')).toMatchObject({ valid: true, kind: 'NIE' });
    expect(checkSpanishTaxId('X1234567A').valid).toBe(false);
    expect(checkSpanishTaxId('B12345674')).toMatchObject({ valid: true, kind: 'ENTITY' });
    expect(checkSpanishTaxId('B87654321').valid).toBe(false);
    expect(checkSpanishTaxId('ESB87654323')).toMatchObject({ valid: true, bare: 'B87654323' });
    // P/Q/S/N/W entities carry a LETTER control; A/B/E/H a digit.
    expect(checkSpanishTaxId('P2807900B').valid).toBe(true);
    expect(checkSpanishTaxId('P28079002').valid).toBe(false);
    expect(checkSpanishTaxId('B1234567D').valid).toBe(false);
    // Review 2026-10-01 — never refuse a valid id:
    // a DNI typed without its leading zero is that DNI, written padded;
    expect(checkSpanishTaxId('1234567L')).toMatchObject({ valid: true, kind: 'DNI', bare: '01234567L' });
    // R/N/W may carry a digit OR a letter (only P/Q/S are letter-only).
    expect(checkSpanishTaxId('R1234567D').valid).toBe(true);
    expect(checkSpanishTaxId('R12345674').valid).toBe(true);
    expect(checkSpanishTaxId('N12345674').valid).toBe(true);
    expect(checkSpanishTaxId('Q12345674').valid).toBe(false);
    expect(spanishPersonType('ES12345678Z')).toBe('F');
    expect(spanishPersonType('X1234567L')).toBe('F');
    expect(spanishPersonType('B12345674')).toBe('J');
    expect(isSpanishPublicBodyNif('P2807900B')).toBe(true);
    expect(isSpanishPublicBodyNif('B12345674')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The reader the device uses, against xmldom
// ---------------------------------------------------------------------------
describe('miniXml', () => {
  const canonical = (n: XmlNode): string => `${n.name}(${n.text.trim()})[${n.children.map(canonical).join(',')}]`;
  const canonicalDom = (e: any): string => {
    const kids: any[] = [];
    let text = '';
    for (let c = e.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) kids.push(c);
      if (c.nodeType === 3 || c.nodeType === 4) text += c.nodeValue;
    }
    return `${e.localName}(${text.trim()})[${kids.map(canonicalDom).join(',')}]`;
  };
  it('reads every generated document exactly as xmldom does', () => {
    for (const xml of [itXml().xml, itXml({ lines: [line('Sostituzione dell’impianto & “altro”', 3, 12.345, 10)] }).xml, esXml().xml]) {
      const mine = parseXml(xml).children[0];
      const dom = new DOMParser().parseFromString(xml, 'text/xml').documentElement;
      expect(canonical(mine)).toBe(canonicalDom(dom));
    }
  });
  it('refuses malformed input instead of guessing', () => {
    expect(() => parseXml('<a><b></a>')).toThrow();
    expect(() => parseXml('<a>')).toThrow();
    expect(checkFatturaPA('<a><b></a>', { today: TODAY }).map((f) => f.code)).toEqual(['00200']);
  });
});

// ---------------------------------------------------------------------------
// Writing numbers and text
// ---------------------------------------------------------------------------
describe('einvoiceText', () => {
  it('prints what was entered (2–8 decimals) and money through round2', () => {
    expect(decimalText(1.333)).toBe('1.333');
    expect(decimalText(3)).toBe('3.00');
    expect(decimalText(1000 / 1.21)).toBe('826.44628099');
    expect(decimalText(-0)).toBe('0.00');
    expect(moneyText(1.333 * 55)).toBe('73.32'); // (1.333*55).toFixed(2) is "73.31"
    expect(moneyText(-0.285)).toBe('-0.29');
  });
  it('respells typographic characters into Latin-1, leaves the rest for the rules to refuse', () => {
    expect(latin1Text('dell’impianto – “bagno”… 5€')).toBe('dell\'impianto - "bagno"... 5EUR');
    expect(latin1Text('Lavori 👍')).toBe('Lavori 👍');
  });
});

// ---------------------------------------------------------------------------
// ITALY
// ---------------------------------------------------------------------------
describe('FatturaPA — our invoices pass SDI', () => {
  it('mixed rates, sub-cent quantities: no errors, no warnings', () => {
    const f = checkFatturaPA(itXml().xml, { today: TODAY });
    expect(f).toEqual([]);
  });
  it('00423: Quantita and PrezzoUnitario are printed with the precision the line was computed with', () => {
    const { xml } = itXml();
    expect(xml).toMatch(/<Quantita>1\.333<\/Quantita>\s*<PrezzoUnitario>55\.00<\/PrezzoUnitario>\s*<PrezzoTotale>73\.32<\/PrezzoTotale>/);
    expect(xml).toMatch(/<Quantita>1\.125<\/Quantita>\s*<PrezzoUnitario>199\.99<\/PrezzoUnitario>\s*<PrezzoTotale>224\.99<\/PrezzoTotale>/);
  });
  it('a credit line −1 × 20 is written 1 × −20 (Quantita is unsigned)', () => {
    const { xml } = itXml({ lines: [line('Lavori', 1, 100, 22), line('Storno', -1, 20, 22)] });
    expect(xml).toMatch(/<Quantita>1\.00<\/Quantita>\s*<PrezzoUnitario>-20\.00<\/PrezzoUnitario>\s*<PrezzoTotale>-20\.00<\/PrezzoTotale>/);
    expect(codes(checkFatturaPA(xml, { today: TODAY }))).toEqual([]);
  });
  it('the REA from the profile is never written as the CodiceFiscale; a real codice fiscale is, and transmits', () => {
    const rea = itXml();
    expect(rea.xml).not.toMatch(/REA MI/);
    expect(rea.xml).not.toMatch(/<CedentePrestatore>[\s\S]*<CodiceFiscale>[\s\S]*<\/CedentePrestatore>/);
    const soleTrader = itXml({ seller: { ...itSrc().seller, taxId: 'rssmra80a01h501u' } });
    expect(soleTrader.xml).toMatch(/<IdTrasmittente>\s*<IdPaese>IT<\/IdPaese>\s*<IdCodice>RSSMRA80A01H501U<\/IdCodice>/);
    expect(fatturaTransmitterId(soleTrader.doc)).toBe('RSSMRA80A01H501U');
    expect(codes(checkFatturaPA(soleTrader.xml, { today: TODAY }))).toEqual([]);
  });
  it('a lower-case SDI code is the same code (XSD [A-Z0-9])', () => {
    const { xml } = itXml({ buyer: { ...itSrc().buyer, einvoiceRouting: ' abcdef1 ' } });
    expect(xml).toMatch(/<CodiceDestinatario>ABCDEF1<\/CodiceDestinatario>/);
  });
  it('iPhone typography in a description is respelled; an emoji is refused (00200)', () => {
    const ok = itXml({ lines: [line('Sostituzione dell’impianto – “bagno”', 1, 50, 22)] });
    expect(codes(checkFatturaPA(ok.xml, { today: TODAY }))).toEqual([]);
    const bad = itXml({ lines: [line('Lavori 👍', 1, 50, 22)] });
    const f = checkFatturaPA(bad.xml, { today: TODAY });
    expect(codes(f)).toEqual(['00200']);
    expect(f[0]).toMatchObject({ key: 'characters', params: { field: 'Descrizione', value: '👍' } });
  });
  it('forfettario: N2.2 and the bollo above € 77,47, none at exactly € 77,47', () => {
    const over = itXml({ seller: { ...itSrc().seller, fiscalRegime: 'RF19' }, lines: [line('Caldaia', 1, 77.48, 0)] });
    expect(over.xml).toMatch(/<DatiBollo>/);
    expect(checkFatturaPA(over.xml, { today: TODAY })).toEqual([]);
    const at = itXml({ seller: { ...itSrc().seller, fiscalRegime: 'RF19' }, lines: [line('Caldaia', 1, 77.47, 0)] });
    expect(at.xml).not.toMatch(/<DatiBollo>/);
    expect(checkFatturaPA(at.xml, { today: TODAY })).toEqual([]);
  });
  it('N2.2 under an ordinary regime is a WARNING (accepted by SDI, maybe fiscally wrong), not a refusal', () => {
    const f = checkFatturaPA(itXml({ lines: [line('Lavori', 1, 100, 22), line('Spese', 1, 15.5, 0)] }).xml, { today: TODAY });
    expect(codes(f)).toEqual([]);
    expect(codes(f, 'warning')).toEqual(['NATURA-REGIME']);
  });
  it('the file name follows SdI §2.2 and changes every second (00001/00002)', () => {
    const a = fatturaPaFileName('IT', '01234567897', new Date('2026-10-01T10:00:00Z'));
    const b = fatturaPaFileName('IT', '01234567897', new Date('2026-10-01T10:00:01Z'));
    expect(a).toMatch(/^IT01234567897_[0-9A-Z]{5}\.xml$/);
    expect(a).not.toBe(b);
    expect(isValidFatturaPaFileName(a)).toBe(true);
    expect(isValidFatturaPaFileName('FT-2026-0101-fatturapa.xml')).toBe(false);
    expect(isValidFatturaPaFileName(fatturaPaFileName('IT', 'RSSMRA80A01H501U'))).toBe(true);
  });
});

describe('FatturaPA — each SDI rule catches its defect', () => {
  const base = () => itXml().xml;
  const zeroRated = () => itXml({ seller: { ...itSrc().seller, fiscalRegime: 'RF19' }, lines: [line('Caldaia', 1, 50, 0)] }).xml;
  const cases: Array<[string, () => string]> = [
    ['00400', () => mutate(zeroRated(), /\s*<Natura>N2\.2<\/Natura>(?=\s*<\/DettaglioLinee>)/, '')],
    ['00401', () => mutate(base(), '<AliquotaIVA>22.00</AliquotaIVA>', '<AliquotaIVA>22.00</AliquotaIVA><Natura>N2.2</Natura>')],
    ['00403', () => mutate(base(), '<Data>2026-09-30</Data>', '<Data>2026-10-02</Data>')],
    ['00423', () => mutate(base(), '<Quantita>1.333</Quantita>', '<Quantita>1.33</Quantita>')],
    ['00421', () => mutate(base(), /<Imposta>([\d.]+)<\/Imposta>/, '<Imposta>1.00</Imposta>')],
    ['00422', () => mutate(base(), /<ImponibileImporto>[\d.]+<\/ImponibileImporto>\s*<Imposta>[\d.]+<\/Imposta>/, '<ImponibileImporto>500.00</ImponibileImporto><Imposta>110.00</Imposta>')],
    ['00424', () => mutate(mutate(base(), /<AliquotaIVA>22\.00<\/AliquotaIVA>/g, '<AliquotaIVA>0.22</AliquotaIVA>'), /<Imposta>[\d.]+<\/Imposta>/, '<Imposta>0.23</Imposta>')],
    ['00425', () => mutate(base(), '<Numero>FT-2026-0101</Numero>', '<Numero>FT-ABC</Numero>')],
    ['00427', () => mutate(base(), '<CodiceDestinatario>ABCDEF1</CodiceDestinatario>', '<CodiceDestinatario>UFABCD</CodiceDestinatario>')],
    ['00428', () => mutate(base(), 'versione="FPR12"', 'versione="FPA12"')],
    ['00429', () => mutate(zeroRated(), /(<DatiRiepilogo>\s*<AliquotaIVA>0\.00<\/AliquotaIVA>)\s*<Natura>N2\.2<\/Natura>/, '$1')],
    ['00419', () => mutate(base(), /<DatiRiepilogo>\s*<AliquotaIVA>10\.00[\s\S]*?<\/DatiRiepilogo>/, '')],
    ['00445', () => mutate(zeroRated(), /<Natura>N2\.2<\/Natura>/g, '<Natura>N2</Natura>')],
    ['00301', () => mutate(base(), /<IdCodice>01234567897<\/IdCodice>(?=\s*<\/IdFiscaleIVA>)/, '<IdCodice>01234567890</IdCodice>')],
    ['00305', () => mutate(base(), '<IdCodice>09876543217</IdCodice>', '<IdCodice>09876543210</IdCodice>')],
    ['00306', () => itXml({ buyer: { ...itSrc().buyer, vatId: undefined, taxId: 'RSSMRA80A01H501A', einvoiceRouting: '0000000' } }).xml],
    ['00300', () => mutate(base(), /(<IdTrasmittente>\s*<IdPaese>IT<\/IdPaese>\s*)<IdCodice>[^<]+<\/IdCodice>/, '$1<IdCodice>REAMI1234567</IdCodice>')],
    ['00417', () => mutate(base(), /<CessionarioCommittente>\s*<DatiAnagrafici>\s*<IdFiscaleIVA>[\s\S]*?<\/IdFiscaleIVA>/, '<CessionarioCommittente><DatiAnagrafici>')],
    ['00313', () => mutate(base(), '<CodiceDestinatario>ABCDEF1</CodiceDestinatario>', '<CodiceDestinatario>XXXXXXX</CodiceDestinatario>')],
    ['00330', () => itXml({ buyer: { ...itSrc().buyer, einvoiceRouting: undefined, einvoiceEmail: 'sdi01@pec.fatturapa.it' } }).xml],
    ['00476', () => mutate(mutate(base(), /<IdPaese>IT<\/IdPaese>(\s*<IdCodice>01234567897)/g, '<IdPaese>DE</IdPaese>$1'), /<IdPaese>IT<\/IdPaese>(\s*<IdCodice>09876543217)/, '<IdPaese>FR</IdPaese>$1')],
    ['00200', () => itXml({ buyer: { ...itSrc().buyer, postcode: '1012 AB' } }).xml],
    ['SDI-2.1', () => mutate(mutate(mutate(base(), 'versione="FPR12"', 'versione="FPA12"'), '<FormatoTrasmissione>FPR12', '<FormatoTrasmissione>FPA12'), 'ABCDEF1', 'UFABCD')],
  ];
  it.each(cases)('%s', (code, make) => {
    expect(codes(checkFatturaPA(make(), { today: TODAY }))).toContain(code);
  });
  it('a province written out ("Milano") is caught before SDI sees it', () => {
    const f = checkFatturaPA(itXml({ seller: { ...itSrc().seller, province: 'Milano' } }).xml, { today: TODAY });
    expect(f.filter((x) => x.severity === 'error').map((x) => [x.code, x.key])).toEqual([['00200', 'provinceSeller']]);
  });
});

// ---------------------------------------------------------------------------
// SPAIN
// ---------------------------------------------------------------------------
describe('Facturae — our invoices pass FACe / HAP/1650/2015 Anexo II', () => {
  it('mixed rates, sub-cent quantities: no errors; unsigned is stated (info), not refused', () => {
    const f = checkFacturae(esXml().xml, { today: TODAY });
    expect(codes(f)).toEqual([]);
    expect(codes(f, 'warning')).toEqual([]);
    expect(codes(f, 'info')).toEqual(['UNSIGNED']);
  });
  it('6a/6b: Quantity at full precision, every amount through round2, totals from one source', () => {
    const { xml } = esXml();
    expect(xml).toMatch(/<Quantity>1\.333<\/Quantity>\s*<UnitPriceWithoutTax>55\.00<\/UnitPriceWithoutTax>\s*<TotalCost>73\.32<\/TotalCost>\s*<GrossAmount>73\.32<\/GrossAmount>/);
    const total = /<InvoiceTotal>([\d.]+)</.exec(xml)![1];
    expect(xml).toContain(`<TotalInvoicesAmount><TotalAmount>${total}</TotalAmount>`);
    expect(xml).toContain(`<InstallmentAmount>${total}</InstallmentAmount>`);
  });
  it('a synthesised unit price (gross ÷ 1,21) keeps 8 decimals and still adds up exactly', () => {
    const { xml } = esXml({ lines: [line('Trabajos', 1, 1000 / 1.21, 21)] });
    expect(xml).toMatch(/<UnitPriceWithoutTax>826\.44628099<\/UnitPriceWithoutTax>\s*<TotalCost>826\.45<\/TotalCost>/);
    expect(codes(checkFacturae(xml, { today: TODAY }))).toEqual([]);
  });
  it('domestic NIFs lose the ES prefix; an ES-prefixed DNI and a NIE are PERSONS', () => {
    const company = esXml();
    expect(company.doc.buyerNif).toBe('B87654323');
    expect(company.doc.buyerPersonType).toBe('J');
    const dni = esXml({ buyer: { ...esSrc().buyer, name: 'Javier Ruiz Pérez', vatId: 'ES12345678Z' } });
    expect(dni.doc.buyerNif).toBe('12345678Z');
    expect(dni.doc.buyerPersonType).toBe('F');
    expect(dni.xml).toMatch(/<Name>Javier<\/Name>\s*<FirstSurname>Ruiz<\/FirstSurname>/);
    const nie = esXml({ buyer: { ...esSrc().buyer, name: 'Anna Müller Schmidt', vatId: undefined, taxId: 'X1234567L' } });
    expect(nie.doc.buyerPersonType).toBe('F');
    expect(codes(checkFacturae(nie.xml, { today: TODAY }))).toEqual([]);
    expect(codes(checkFacturae(dni.xml, { today: TODAY }), 'warning')).toEqual([]);
  });
  it('a one-word NIE holder is asked for a surname, not filed as a company', () => {
    const r = toFacturae(esSrc({ buyer: { ...esSrc().buyer, name: 'Anna', vatId: undefined, taxId: 'X1234567L' } }));
    expect(r.ok).toBe(false);
    expect((r as any).missing).toContainEqual({ key: 'customer.nameWithSurname', where: 'customer' });
  });
});

describe('Facturae — each Anexo II rule catches its defect', () => {
  const base = () => esXml().xml;
  const cases: Array<[string, () => string]> = [
    ['HAP1650-II.3a', () => mutate(base(), '<InvoiceNumber>FA-2026-0101</InvoiceNumber>', '<InvoiceNumber></InvoiceNumber>')],
    ['HAP1650-II.5b', () => esXml({ buyer: { ...esSrc().buyer, vatId: 'ESB87654321' } }).xml],
    ['HAP1650-II.5d', () => mutate(esXml({ seller: { ...esSrc().seller, name: 'Lucía Navarro Gómez', taxId: '12345678Z', personType: 'F' } }).xml, /<FirstSurname>Navarro<\/FirstSurname>/, '<FirstSurname></FirstSurname>')],
    ['HAP1650-II.5e', () => mutate(base(), '<CorporateName>Panadería Navarro S.L.</CorporateName>', '<CorporateName></CorporateName>')],
    ['HAP1650-II.5f', () => esXml({ buyer: { ...esSrc().buyer, vatId: 'B12345674' } }).xml],
    ['HAP1650-II.6a', () => mutate(base(), '<Quantity>1.333</Quantity>', '<Quantity>1.33</Quantity>')],
    ['HAP1650-II.6b', () => mutate(base(), /<TotalGrossAmount>([\d.]+)<\/TotalGrossAmount>/, '<TotalGrossAmount>1.00</TotalGrossAmount>')],
    ['HAP1650-II.6e', () => mutate(base(), /<TotalGrossAmountBeforeTaxes>[\d.]+</, '<TotalGrossAmountBeforeTaxes>1.00<')],
    ['HAP1650-II.6f', () => mutate(base(), /<InvoiceTotal>[\d.]+</, '<InvoiceTotal>1.00<')],
    ['HAP1650-II.7a', () => mutate(base(), '<IssueDate>2026-09-30</IssueDate>', '<IssueDate>2026-10-02</IssueDate>')],
    ['HAP1650-II.9b', () => mutate(base(), '<ItemDescription>Mano de obra</ItemDescription>', '<ItemDescription></ItemDescription>')],
    ['FACTURAE-BATCH', () => mutate(base(), /<TotalInvoicesAmount><TotalAmount>[\d.]+</, '<TotalInvoicesAmount><TotalAmount>1.00<')],
    ['FACTURAE-3.1.5.7', () => mutate(base(), /<TotalTaxOutputs>[\d.]+</, '<TotalTaxOutputs>1.00<')],
    ['XSD', () => esXml({ buyer: { ...esSrc().buyer, postcode: '4100' } }).xml],
    ['HAP1650-II.2/II.8', () => esXml({ buyer: { ...esSrc().buyer, name: 'Ayuntamiento de Madrid', vatId: undefined, taxId: 'P2807900B' } }).xml],
  ];
  it.each(cases)('%s', (code, make) => {
    expect(codes(checkFacturae(make(), { today: TODAY }))).toContain(code);
  });
});

describe('Facturae — a Q buyer is not assumed to be a FACe administration (review 2026-10-01)', () => {
  it('Q (public-law body, e.g. a chamber of commerce): warned, not refused; P and S: refused', () => {
    const q = checkFacturae(esXml({ buyer: { ...esSrc().buyer, name: 'Cámara de Comercio', vatId: undefined, taxId: 'Q2826000H' } }).xml, { today: TODAY });
    expect(codes(q)).toEqual([]);
    expect(codes(q, 'warning')).toContain('HAP1650-II.2/II.8');
    const s = checkFacturae(esXml({ buyer: { ...esSrc().buyer, name: 'Ministerio', vatId: undefined, taxId: 'S2811001C' } }).xml, { today: TODAY });
    expect(codes(s)).toContain('HAP1650-II.2/II.8');
  });
});

// ---------------------------------------------------------------------------
// What the contractor reads, and where the gate is wired
// ---------------------------------------------------------------------------
const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'];
const locale = (l: string) => JSON.parse(fs.readFileSync(path.join(__dirname, `../../i18n/locales/${l}.json`), 'utf8'));

it('every rule key the validator can emit is translated in all six locales', () => {
  // RuleFinding.key is typed RuleKey, so tsc refuses a key missing from RULE_KEYS;
  // this closes the other half — RULE_KEYS against the locale files.
  expect(RULE_KEYS.length).toBeGreaterThan(20);
  for (const l of LOCALES) {
    const d = locale(l);
    for (const k of [...RULE_KEYS, 'title', 'body']) expect([l, k, typeof d.einvoiceRules?.[k]]).toEqual([l, k, 'string']);
    expect(typeof d.recordsArchive?.xmlRejected).toBe('string');
  }
});

it('blocking findings read as the contractor\'s sentence plus the official code', () => {
  const xml = itXml({ buyer: { ...itSrc().buyer, vatId: 'IT09876543210' } }).xml;
  const en = locale('en');
  const t = (k: string, o: Record<string, any> = {}) => {
    const s = k.split('.').reduce((a: any, p) => a?.[p], en) as string | undefined;
    return (s ?? o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_: string, v: string) => String(o[v] ?? ''));
  };
  expect(blockingFindingLines(checkFatturaPA(xml, { today: TODAY }), t)).toEqual([
    "The customer's tax number 09876543210 is not valid (the check digit does not match). (00305)",
  ]);
});

it('the invoice screen checks the rules before sharing an IT/ES file, and names the IT file per SdI', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../../../app/invoices/[id].tsx'), 'utf8'));
  const body = (name: string) => {
    const start = src.indexOf(`const ${name} = async () => {`);
    expect(start).toBeGreaterThan(-1);
    return src.slice(start, src.indexOf('\n  };', start));
  };
  for (const [handler, check] of [['handleExportFatturaPA', 'checkFatturaPA'], ['handleExportFacturae', 'checkFacturae']] as const) {
    const b = body(handler);
    const checked = b.indexOf(`${check}(xml)`);
    const refused = b.indexOf('if (refuseOnRuleErrors(');
    const shared = b.indexOf('await shareEInvoiceThenConfirm(');
    expect([handler, checked > -1, refused > checked, shared > refused]).toEqual([handler, true, true, true]);
  }
  expect(body('handleExportFatturaPA')).toMatch(/const filename = fatturaPaFileName\('IT', fatturaTransmitterId\(data\)\)/);
});
