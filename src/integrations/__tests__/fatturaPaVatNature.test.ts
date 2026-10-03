/**
 * @jest-environment node
 */
// The VAT nature of a 0 % line, through the WHOLE Italian export path
// (2026-10-03): the invoice's lines → buildEInvoiceSource → toFatturaPA →
// generateFatturaPAXml → the SDI value rules. Until then every 0 % line was
// written N2.2 ("non soggette – altri casi"): right for a forfettario, wrong —
// and accepted by SDI — for an ordinary-regime building subcontract, which is
// reverse charge (N6.3, DPR 633/72 art. 17 c. 6 lett. a).
import { buildEInvoiceSource, invoiceLinesFor, type InvoiceDocInputs } from '../../domain/invoiceDocuments';
import { documentVatBreakdown } from '../../domain/business';
import { toFatturaPA, missingFieldLabel } from '../einvoiceMapping';
import { generateFatturaPAXml } from '../einvoice-it';
import { checkFatturaPA } from '../einvoiceValueRules';
import { parseXml, kids, at, textAt } from '../miniXml';
import type { VatNature } from '../../domain/vatNature';

const TODAY = '2026-10-02';
const SELLER = { businessName: 'Idraulica Bianchi S.r.l.', vatNumber: 'IT01234567897', address: 'Via Roma 10', city: 'Milano', postcode: '20121', province: 'MI', country: 'IT', fiscalRegime: 'RF01', iban: 'IT60X0542811101000000123456' };
const BUYER = { id: 'c1', name: 'Edilizia Bruno S.r.l.', vatId: 'IT09876543217', address: 'Corso Italia 5', city: 'Torino', postcode: '10121', province: 'TO', country: 'IT', einvoiceRouting: 'ABCDEF1' };
type L = { description: string; quantity: number; unitPrice: number; vatRate?: number; vatNature?: VatNature };
const inputs = (lines: L[], profile: Record<string, unknown> = {}, buyer: Record<string, unknown> = {}): InvoiceDocInputs => ({
  invoice: { id: 'FT-1', customerId: 'c1', customer: 'Edilizia Bruno S.r.l.', job: 'Cantiere', amount: 0, status: 'draft', dueInDays: 30, sentAt: '2026-10-01T09:00:00Z' } as any,
  lines, customers: [{ ...BUYER, ...buyer }] as any, businessProfile: { ...SELLER, ...profile } as any, country: 'IT', effectiveRate: 0.22,
});
const exportXml = (inp: InvoiceDocInputs) => {
  const r = toFatturaPA(buildEInvoiceSource(inp));
  if (!r.ok) throw new Error(JSON.stringify(r.missing));
  return generateFatturaPAXml(r.document);
};
const bodyOf = (xml: string) => {
  const root = parseXml(xml).children.find((c) => c.name === 'FatturaElettronica')!;
  return at(root, 'FatturaElettronicaBody/DatiBeniServizi')!;
};

describe('the nature the contractor stated reaches SDI', () => {
  const lines: L[] = [
    { description: 'Subappalto impianto', quantity: 1, unitPrice: 4250, vatRate: 0, vatNature: 'N6.3' },
    { description: 'Completamento bagni', quantity: 12.5, unitPrice: 38.4, vatRate: 0, vatNature: 'N6.7' },
    { description: 'Noleggio', quantity: 1, unitPrice: 120 }, // no own rate → the document's 22 %
  ];

  it('per line, with one DatiRiepilogo per (AliquotaIVA, Natura) and its RiferimentoNormativo', () => {
    const xml = exportXml(inputs(lines));
    const body = bodyOf(xml);
    expect(kids(body, 'DettaglioLinee').map((d) => textAt(d, 'Natura') ?? '-')).toEqual(['N6.3', 'N6.7', '-']);
    const r = kids(body, 'DatiRiepilogo');
    expect(r.map((x) => `${textAt(x, 'AliquotaIVA')}/${textAt(x, 'Natura') ?? '-'}/${textAt(x, 'ImponibileImporto')}/${textAt(x, 'Imposta')}`))
      .toEqual(['0.00/N6.3/4250.00/0.00', '0.00/N6.7/480.00/0.00', '22.00/-/120.00/26.40']);
    expect(textAt(r[0], 'RiferimentoNormativo')).toBe('Inversione contabile ex art. 17, c. 6, lett. a), DPR 633/72');
    expect(textAt(r[1], 'RiferimentoNormativo')).toBe('Inversione contabile ex art. 17, c. 6, lett. a-ter), DPR 633/72');
    expect(textAt(r[2], 'RiferimentoNormativo')).toBeUndefined();
    // XSD sequence: …Imposta, EsigibilitaIVA, RiferimentoNormativo (last).
    expect(r[0].children.map((c) => c.name).slice(-2)).toEqual(['EsigibilitaIVA', 'RiferimentoNormativo']);
  });

  it('SDI accepts it with no finding at all, and no marca da bollo on reverse charge', () => {
    const xml = exportXml(inputs(lines));
    expect(checkFatturaPA(xml, { today: TODAY })).toEqual([]);
    expect(xml).not.toContain('<DatiBollo>');
  });

  it('totals are unchanged: the XML states the gross the app computes (EN 16931)', () => {
    // Fuzz the classes production sends: unrated lines, sub-cent quantities,
    // natures mixed with rates (#380 — tidy inputs hid a cent).
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 400; n++) {
      const ls: L[] = Array.from({ length: 1 + Math.floor(rnd() * 5) }, (_, i) => {
        const kind = Math.floor(rnd() * 4);
        return {
          description: `Riga ${i}`,
          quantity: Math.round(rnd() * 3000) / 1000 + 0.001,
          unitPrice: Math.round(rnd() * 50000) / 100,
          ...(kind === 0 ? {} : kind === 1 ? { vatRate: 10 } : kind === 2 ? { vatRate: 0, vatNature: 'N6.3' as const } : { vatRate: 0, vatNature: 'N1' as const }),
        };
      });
      const xml = exportXml(inputs(ls));
      const net = ls.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const app = documentVatBreakdown(net, ls, 22).gross;
      expect([n, textAt(at(parseXml(xml).children.find((c) => c.name === 'FatturaElettronica')!, 'FatturaElettronicaBody/DatiGenerali/DatiGeneraliDocumento'), 'ImportoTotaleDocumento')])
        .toEqual([n, app.toFixed(2)]);
    }
  });
});

describe('the mapper refuses rather than invents', () => {
  it('RF01, 0 % lines without a nature: every one named, with its line number, in one list', () => {
    const r = toFatturaPA(buildEInvoiceSource(inputs([
      { description: 'Lavori', quantity: 1, unitPrice: 100 },
      { description: 'Subappalto', quantity: 1, unitPrice: 900, vatRate: 0 },
      { description: 'Spese', quantity: 1, unitPrice: 15, vatRate: 0 },
    ], {}, { address: undefined })));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const lines = r.missing.filter((m) => m.where === 'invoice');
    expect(lines.map((m) => [m.key, m.params?.line, m.params?.description])).toEqual([
      ['invoices.vatNatureMissing', '2', 'Subappalto'],
      ['invoices.vatNatureMissing', '3', 'Spese'],
    ]);
    // …beside the customer's own gap: one list, not one gap per retry.
    expect(r.missing.some((m) => m.key === 'customer.address')).toBe(true);
    const t = (k: string, o?: Record<string, unknown>) => `${k}|${o?.line}|${o?.description}`;
    expect(missingFieldLabel(lines[0], t)).toBe('invoices.vatNatureMissing|2|Subappalto');
  });

  it('a forfettario cannot state reverse charge; a minimo neither', () => {
    for (const regime of ['RF19', 'RF02']) {
      const r = toFatturaPA(buildEInvoiceSource(inputs([{ description: 'Subappalto', quantity: 1, unitPrice: 900, vatRate: 0, vatNature: 'N6.3' }], { fiscalRegime: regime })));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.missing).toEqual([{ key: 'invoices.vatNatureNotForRegime', where: 'invoice', params: { line: '1', description: 'Subappalto', nature: 'N6.3', regime } }]);
    }
  });

  it('a forfettario line without a nature is the franchise, with ITS norm', () => {
    const xml = exportXml(inputs([{ description: 'Caldaia', quantity: 1, unitPrice: 60, vatRate: 0 }], { fiscalRegime: 'RF19' }));
    const r = kids(bodyOf(xml), 'DatiRiepilogo');
    expect(textAt(r[0], 'Natura')).toBe('N2.2');
    expect(textAt(r[0], 'RiferimentoNormativo')).toContain('L. 190/2014');
  });

  it('a nature left on a RATED line is not written (SDI 00401)', () => {
    const xml = exportXml(inputs([{ description: 'Lavori', quantity: 1, unitPrice: 100, vatRate: 22, vatNature: 'N6.3' }]));
    expect(xml).not.toContain('<Natura>');
    expect(checkFatturaPA(xml, { today: TODAY })).toEqual([]);
  });

  it('the stored lines keep their nature on the way in (records archive path)', () => {
    const stored = [{ id: 'l1', description: 'Subappalto', quantity: 1, unitPrice: 900, vatRate: 0, vatNature: 'N6.3' as const }];
    expect(invoiceLinesFor({ id: 'FT-1', amount: 900 } as any, stored, 0.22, 'x')[0].vatNature).toBe('N6.3');
  });
});

describe('the value rules around a nature', () => {
  const rc = () => exportXml(inputs([{ description: 'Subappalto', quantity: 1, unitPrice: 900, vatRate: 0, vatNature: 'N6.3' }]));

  it('reverse charge to a buyer without a partita IVA: warned, the customer to fix', () => {
    const xml = rc().replace(/<IdFiscaleIVA>\s*<IdPaese>IT<\/IdPaese>\s*<IdCodice>09876543217<\/IdCodice>\s*<\/IdFiscaleIVA>/, '<CodiceFiscale>RSSMRA80A01H501U</CodiceFiscale>');
    expect(xml).not.toContain('09876543217');
    const f = checkFatturaPA(xml, { today: TODAY });
    expect(f.filter((x) => x.severity === 'error')).toEqual([]);
    expect(f.find((x) => x.code === 'N6-BUYER')).toMatchObject({ severity: 'warning', where: 'customer', key: 'reverseChargeBuyer' });
  });

  it('reverse charge under a forfettario regime: warned, the invoice to fix', () => {
    const xml = rc().replace('<RegimeFiscale>RF01</RegimeFiscale>', '<RegimeFiscale>RF19</RegimeFiscale>');
    const f = checkFatturaPA(xml, { today: TODAY });
    expect(f.find((x) => x.key === 'reverseChargeRegime')).toMatchObject({ code: 'NATURA-REGIME', severity: 'warning', where: 'invoice' });
  });

  it('a Natura without its RiferimentoNormativo: reported as Vasco\'s, not put to the contractor', () => {
    const xml = rc().replace(/\s*<RiferimentoNormativo>[^<]*<\/RiferimentoNormativo>/, '');
    const f = checkFatturaPA(xml, { today: TODAY });
    expect(f.find((x) => x.code === 'A-2.2.2.8')).toMatchObject({ severity: 'warning', where: 'vasco' });
  });
});
