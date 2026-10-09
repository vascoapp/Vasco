/**
 * The bank-transfer QR on a EUR invoice (EPC069-12 "GiroCode", user 2026-10-09:
 * "one payment method that works for all countries"). The code is proven by
 * SCANNING it: the SVG's own modules are drawn into pixels and read back by an
 * independent decoder (jsQR) — a code that renders but does not decode is the
 * failure this exists for. And it only appears where it is true.
 */
const mockPrinted: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: async ({ html }: { html: string }) => { mockPrinted.push(html); return { uri: 'file:///cache/x.pdf' }; },
}));
import jsQR from 'jsqr';
import { pdfInvoiceFromRecord } from '../services/invoicePdfSource';
import { renderInvoicePdfFile } from '../services/invoicePdfService';
import { epcPayload, epcQrSvg, epcQrApplies } from '../utils/epcQr';

const IBAN = 'DE89370400440532013000'; // the standard's well-known valid test IBAN

/** Rasterise the SVG's module rects (`M{x} {y}h1v1h-1z`) and decode. */
function scan(svg: string): string | null {
  const vb = /viewBox="0 0 (\d+) \1"/.exec(svg);
  if (!vb) throw new Error('no viewBox');
  const n = Number(vb[1]);
  const scale = 6;
  const size = n * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (const m of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const [x, y] = [Number(m[1]), Number(m[2])];
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = ((y * scale + dy) * size + (x * scale + dx)) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  return jsQR(px, size, size)?.data ?? null;
}

it('a German invoice’s code scans to the exact EPC transfer', () => {
  const p = epcPayload({ name: 'Müller Sanitär GmbH', iban: 'DE89 3704 0044 0532 0130 00', amount: 1234.5, reference: 'RE-2026-0042' })!;
  expect(p).toBe(['BCD', '002', '1', 'SCT', '', 'Müller Sanitär GmbH', IBAN, 'EUR1234.50', '', '', 'RE-2026-0042'].join('\n'));
  // jsQR decodes byte mode as UTF-8 — the umlauts survive the round trip.
  expect(scan(epcQrSvg(p))).toBe(p);
});

it('a long business name is cut to the 70 characters the standard allows, and still scans', () => {
  const p = epcPayload({ name: 'X'.repeat(90), iban: IBAN, amount: 10, reference: 'F1' })!;
  expect(p.split('\n')[5]).toHaveLength(70);
  expect(scan(epcQrSvg(p))).toBe(p);
});

it('no code where it would not be true', () => {
  // A wrong IBAN would send the customer's money nowhere.
  expect(epcPayload({ name: 'A', iban: 'DE89370400440532013001', amount: 10, reference: 'R' })).toBeNull();
  expect(epcPayload({ name: 'A', iban: '', amount: 10, reference: 'R' })).toBeNull();
  // Nothing to pay.
  expect(epcPayload({ name: 'A', iban: IBAN, amount: 0, reference: 'R' })).toBeNull();
  expect(epcPayload({ name: '', iban: IBAN, amount: 10, reference: 'R' })).toBeNull();
  // A SEPA transfer is in euro: the UK (pounds) and an unknown market get none.
  for (const c of ['NL', 'DE', 'FR', 'ES', 'IT']) expect(epcQrApplies(c)).toBe(true);
  for (const c of ['UK', 'US', '', undefined]) expect(epcQrApplies(c as any)).toBe(false);
});

it('a newline in the name or reference cannot shift the fields', () => {
  const p = epcPayload({ name: 'Bad\nName', iban: IBAN, amount: 5, reference: 'R\n1' })!;
  expect(p.split('\n')).toHaveLength(11);
  expect(p.split('\n')[5]).toBe('Bad Name');
});

describe('on the invoice PDF', () => {
  const de = { country: 'DE', businessName: 'Müller Sanitär GmbH', address: 'Hauptstr. 1', postcode: '50667', city: 'Köln', iban: IBAN, vatNumber: 'DE123456789', language: 'de' } as any;
  const render = async (profile: any, status: string, country: string) => {
    mockPrinted.length = 0;
    const auto = pdfInvoiceFromRecord({
      invoice: { id: 'RE-2026-0042', amount: 119, status, customerName: 'Frau Becker', createdAt: '2026-10-09' } as any,
      lines: [{ description: 'Wartung Gastherme', quantity: 1, unitPrice: 100, vatRate: 19 }],
      fallbackVatRatePercent: 19, fallbackDescription: 'x', country,
    });
    await renderInvoicePdfFile(auto, profile);
    return { html: mockPrinted[0], auto };
  };

  it('an unpaid German invoice carries a code that scans to its own total, IBAN and number', async () => {
    const { html, auto } = await render(de, 'sent', 'DE');
    const svg = /<svg[\s\S]*?<\/svg>/.exec(html.slice(html.indexOf('epc-qr')))?.[0];
    expect(svg).toBeTruthy();
    const decoded = scan(svg!)!.split('\n');
    expect(decoded[6]).toBe(IBAN);
    expect(decoded[7]).toBe(`EUR${auto.total.toFixed(2)}`);
    expect(decoded[10]).toBe('RE-2026-0042');
    expect(html).toContain('Banking-App');
  });

  it('no code on a paid invoice, on a UK invoice, or without an IBAN', async () => {
    expect((await render(de, 'paid', 'DE')).html).not.toContain('epc-qr');
    expect((await render({ ...de, country: 'UK' }, 'sent', 'UK')).html).not.toContain('epc-qr');
    expect((await render({ ...de, iban: '' }, 'sent', 'DE')).html).not.toContain('epc-qr');
  });
});

// The ZUGFeRD / Factur-X hybrid draws its own page (pdf-lib): the code is
// drawn there too, EUR only. Its effect is checked by `npm run check:pdfa3`
// (veraPDF + Mustang still accept it) and by decoding the rendered page.
it('the e-invoice hybrid carries the same code, for euro invoices only', () => {
  const src = require('fs').readFileSync(require('path').resolve(__dirname, '../integrations/pdfA3Invoice.ts'), 'utf8');
  expect(src).toMatch(/data\.currency === 'EUR' && data\.iban\s*\? epcPayload\(/);
  expect(src).toMatch(/epcQrMatrix\(epc\)/);
});
