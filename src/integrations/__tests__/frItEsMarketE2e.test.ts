/**
 * FR / IT / ES — the three markets with the least evidence behind them.
 *
 * The contractor critical-path E2E (`contractorCriticalPathE2e`) mocks
 * `getCurrentCountry: () => 'NL'`, so every checkpoint it locks is locked for
 * the Netherlands only. These three markets had no equivalent, and until
 * 2026-08-29 they could not even be opened on a device (see the DEMO_ACCOUNTS
 * fix), so nothing about them had ever been checked by looking either.
 *
 * This asserts the OUTPUT, not that a function ran. "Renders without throwing"
 * is what let the XRechnung generator ship five hard BR-DE violations that the
 * project's own validator passed.
 */
import { toFatturaPA, toFacturae, type EInvoiceSource } from '../einvoiceMapping';
import { generateFatturaPAXml } from '../einvoice-it';
import { generateFacturaeXml } from '../einvoice-es';
import { getVATRate } from '../../constants/taxRates';
import { getReducedVatRate, getStandardVatRate, grossFromNet } from '../../domain/business';
import { getRequiredFields } from '../../utils/businessProfileValidation';

// A realistic Italian invoice, built the way the app builds one: the VAT number
// carries its country prefix, because `isValidVATNumber` requires `IT\d{11}`
// and the profile screen will not accept it any other way.
const IT_SRC: EInvoiceSource = {
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

const ES_SRC: EInvoiceSource = {
  seller: {
    name: 'Fontanería García SL', vatId: 'ESB12345678', address: 'Calle Mayor 1',
    city: 'Madrid', postcode: '28001', province: 'M', country: 'ES',
    personType: 'J', iban: 'ES9121000418450200051332',
  },
  buyer: {
    name: 'Panadería López', vatId: 'ESB87654321', address: 'Gran Vía 5',
    city: 'Madrid', postcode: '28013', province: 'M', country: 'ES',
  },
  invoiceNumber: 'F-2026-0008', invoiceDate: '2026-08-19', dueDate: '2026-09-18',
  currency: 'EUR',
  lines: [{ description: 'Reparación', quantity: 1, unitPrice: 200, lineTotal: 200, vatRate: 21 }],
  totalNet: 200, totalVat: 42, totalGross: 242,
};

describe('IT — FatturaPA is what SDI will actually accept', () => {
  const mapped = toFatturaPA(IT_SRC);
  if (!mapped.ok) throw new Error('IT fixture should map: ' + JSON.stringify(mapped.missing));
  const xml = generateFatturaPAXml(mapped.document);

  it('IdCodice is the bare fiscal code — IdPaese already carries the country', () => {
    // The app stores "IT12345678901"; FatturaPA splits it. Passing it through
    // whole emitted <IdPaese>IT</IdPaese><IdCodice>IT12345678901</IdCodice> for
    // the transmitter, the seller AND the buyer — not an 11-digit partita IVA,
    // so SDI rejects the file on formal validation.
    expect(xml).not.toMatch(/<IdCodice>[A-Z]{2}\d/);
    expect(xml).toContain('<IdCodice>12345678901</IdCodice>');
    expect(xml).toContain('<IdCodice>98765432109</IdCodice>');
  });

  it('carries every element SDI requires in the header', () => {
    for (const el of [
      'FormatoTrasmissione', 'ProgressivoInvio', 'CodiceDestinatario',
      'IdFiscaleIVA', 'Denominazione', 'RegimeFiscale',
      'Indirizzo', 'CAP', 'Comune', 'Provincia', 'Nazione',
    ]) expect(xml).toContain(`<${el}>`);
  });

  it('carries the body, the line detail and the VAT summary', () => {
    for (const el of ['TipoDocumento', 'Divisa', 'Data', 'Numero', 'NumeroLinea',
      'Descrizione', 'PrezzoUnitario', 'PrezzoTotale', 'AliquotaIVA',
      'ImponibileImporto', 'Imposta']) expect(xml).toContain(`<${el}>`);
  });

  it('ProgressivoInvio stays inside SDI\'s 10-character limit', () => {
    const m = xml.match(/<ProgressivoInvio>([^<]*)</);
    expect(m).not.toBeNull();
    expect(m![1].length).toBeGreaterThan(0);
    expect(m![1].length).toBeLessThanOrEqual(10);
  });

  it('the VAT summary reconciles with the lines', () => {
    const imponibile = Number(xml.match(/<ImponibileImporto>([^<]*)</)![1]);
    const imposta = Number(xml.match(/<Imposta>([^<]*)</)![1]);
    expect(imponibile).toBeCloseTo(200, 2);
    expect(imposta).toBeCloseTo(44, 2);       // 22% of 200
    expect(imponibile + imposta).toBeCloseTo(IT_SRC.totalGross, 2);
  });
});

describe('ES — Facturae', () => {
  const mapped = toFacturae(ES_SRC);
  if (!mapped.ok) throw new Error('ES fixture should map: ' + JSON.stringify(mapped.missing));
  const xml = generateFacturaeXml(mapped.document);

  it('carries the header, both parties and the invoice body', () => {
    for (const el of ['SchemaVersion', 'InvoiceIssuerType', 'Batch',
      'SellerParty', 'BuyerParty', 'TaxIdentificationNumber', 'PersonTypeCode',
      'ResidenceTypeCode', 'InvoiceNumber', 'IssueDate']) expect(xml).toContain(`<${el}>`);
  });

  it('totals reconcile', () => {
    const total = Number(xml.match(/<TotalAmount>([^<]*)</)![1]);
    expect(total).toBeCloseTo(ES_SRC.totalGross, 2);
  });
});

describe('the three markets\' VAT', () => {
  it('standard rates are the real ones', () => {
    expect(getVATRate('FR')).toBeCloseTo(0.20, 4);
    expect(getVATRate('IT')).toBeCloseTo(0.22, 4);
    expect(getVATRate('ES')).toBeCloseTo(0.21, 4);
    expect(getStandardVatRate('FR')).toBe(20);
    expect(getStandardVatRate('IT')).toBe(22);
    expect(getStandardVatRate('ES')).toBe(21);
  });

  it('each has the construction reduced bracket the quote builder needs', () => {
    // Null here means the opt-in toggle never renders — which is how a French
    // artisan ended up quoting renovation at 20% instead of 10%.
    expect(getReducedVatRate('FR')).toBe(10);
    expect(getReducedVatRate('IT')).toBe(10);
    expect(getReducedVatRate('ES')).toBe(10);
  });

  it('gross conversion uses the market rate, standard and reduced', () => {
    expect(grossFromNet(1000, getStandardVatRate('FR'))).toBeCloseTo(1200, 2);
    expect(grossFromNet(1000, getStandardVatRate('IT'))).toBeCloseTo(1220, 2);
    expect(grossFromNet(1000, getStandardVatRate('ES'))).toBeCloseTo(1210, 2);
    expect(grossFromNet(1000, getReducedVatRate('FR')!)).toBeCloseTo(1100, 2);
    expect(grossFromNet(1000, getReducedVatRate('IT')!)).toBeCloseTo(1100, 2);
  });
});

describe('the three markets\' invoice readiness gate', () => {
  const keysFor = (c: 'FR' | 'IT' | 'ES') => getRequiredFields(c).map((f) => f.key);

  it('FR asks for SIRET and a TVA number', () => {
    expect(keysFor('FR')).toEqual(expect.arrayContaining([
      'profile.businessName', 'profile.address',
      'profile.registrationSiret', 'profile.vatNumberTva',
    ]));
  });

  it('IT asks for the Partita IVA', () => {
    expect(keysFor('IT')).toEqual(expect.arrayContaining([
      'profile.businessName', 'profile.address', 'profile.vatNumberPiva',
    ]));
  });

  it('ES asks for the NIF/CIF', () => {
    expect(keysFor('ES')).toEqual(expect.arrayContaining([
      'profile.businessName', 'profile.address', 'profile.vatNumberNif',
    ]));
  });
});
