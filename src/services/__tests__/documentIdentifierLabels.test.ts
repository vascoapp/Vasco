// A contractor's quote and invoice must name the same identifier the same way,
// and must not name it as something it is not.
//
// Italy had both wrong: `registrationLabel` and `vatLabel` BOTH returned
// "P.IVA", so the REA number (Repertorio Economico Amministrativo, e.g.
// "MI-1234567") was printed under the name of the VAT identifier — on the
// header and the footer of every Italian quote and invoice.
//
// The two files each carry their own copy of the table, with a comment on the
// quote side asking that it "must match invoicePdfService". A comment is not an
// invariant; this is.
import fs from 'fs';
import path from 'path';

function read(rel: string): string {
  try {
    return fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
  } catch {
    return '';
  }
}

/** Pull `case 'XX': return 'Label';` pairs out of one named function body. */
function tableOf(src: string, fnName: string): Record<string, string> {
  const start = src.indexOf(`function ${fnName}(`);
  if (start === -1) return {};
  const body = src.slice(start, src.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const [, cc, label] of body.matchAll(/case '([A-Z]{2})': return '([^']+)';/g)) {
    out[cc] = label;
  }
  return out;
}

const invoiceSrc = read('invoicePdfService.ts');
const quoteSrc = read('quotePdfService.ts');

describe('registration vs VAT identifier labels', () => {
  it('both files were read', () => {
    expect(invoiceSrc).not.toBe('');
    expect(quoteSrc).not.toBe('');
  });

  it('Italy labels the REA as REA and the Partita IVA as P.IVA', () => {
    expect(tableOf(invoiceSrc, 'registrationLabel').IT).toBe('REA');
    expect(tableOf(invoiceSrc, 'vatLabel').IT).toBe('P.IVA');
    expect(tableOf(quoteSrc, 'registrationLabel').IT).toBe('REA');
    expect(tableOf(quoteSrc, 'vatLabelFor').IT).toBe('P.IVA');
  });

  it('no country calls its registration number and its VAT number the same thing', () => {
    // That is what made the Italian mislabel invisible: two different numbers
    // printed one above the other under one name.
    const reg = tableOf(invoiceSrc, 'registrationLabel');
    const vat = tableOf(invoiceSrc, 'vatLabel');
    for (const cc of Object.keys(reg)) {
      if (vat[cc]) expect(`${cc}:${reg[cc]}`).not.toBe(`${cc}:${vat[cc]}`);
    }
  });

  it('the quote and the invoice agree on every country they both know', () => {
    const a = tableOf(invoiceSrc, 'registrationLabel');
    const b = tableOf(quoteSrc, 'registrationLabel');
    for (const cc of Object.keys(b)) expect(b[cc]).toBe(a[cc]);
  });

  it('the six EU markets each have a registration label', () => {
    const reg = tableOf(invoiceSrc, 'registrationLabel');
    for (const cc of ['NL', 'DE', 'FR', 'ES', 'IT', 'UK']) {
      expect(typeof reg[cc] === 'string' || cc === 'NL').toBe(true); // NL is the default arm
    }
    expect(reg.FR).toBe('SIRET');
    expect(reg.DE).toBe('HRB');
    expect(reg.ES).toBe('NIF');
  });
});
