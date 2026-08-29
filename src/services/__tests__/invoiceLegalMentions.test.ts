// An invoice that omits a mention its country requires is not a cosmetic
// problem: France fines the omission under L441-16 and Germany under §26a
// UStG. The PDF footer carried the business name, address, registration number
// and VAT number, and nothing country-specific at all.
import fs from 'fs';
import path from 'path';
import { legalMentions } from '../invoicePdfService';

describe('France — mentions obligatoires (Code de commerce L441-9)', () => {
  const fr = legalMentions('FR' as any);

  it('states the late-payment penalty, the €40 indemnity and the discount terms', () => {
    expect(fr).toHaveLength(3);
    const all = fr.join(' ');
    expect(all).toMatch(/Pénalités de retard/);
    expect(all).toMatch(/40\s?€/);
    expect(all).toMatch(/Escompte/);
  });

  it('cites the articles it comes from', () => {
    const all = fr.join(' ');
    expect(all).toContain('L441-10');   // penalties + indemnity
    expect(all).toContain('D441-5');    // the €40 amount
  });

  it('states the penalty RATE as the rule, never as a frozen number', () => {
    // The statutory default is the ECB refinancing rate plus 10 points, and it
    // moves. A number printed on a document that outlives it is the same
    // mistake as a hardcoded VAT rate.
    const penalties = fr[0];
    expect(penalties).toMatch(/BCE/);
    expect(penalties).toMatch(/10 points/);
    expect(penalties).not.toMatch(/\d+([.,]\d+)?\s?%/);
  });

  it('is in French, whatever language the contractor runs the app in', () => {
    // A statutory formula belongs to its jurisdiction, not to the UI locale.
    expect(fr.join(' ')).not.toMatch(/late payment|penalty|discount/i);
  });
});

describe('Germany — §14 Abs. 4 Nr. 9 UStG retention notice', () => {
  const de = legalMentions('DE' as any);

  it('tells a private customer they must keep the invoice for two years', () => {
    expect(de).toHaveLength(1);
    expect(de[0]).toMatch(/zwei Jahre aufzubewahren/);
    expect(de[0]).toContain('§ 14b');
  });
});

describe('the markets that need nothing extra', () => {
  it.each(['NL', 'ES', 'IT', 'UK', 'US'])('%s adds no mention', (c) => {
    expect(legalMentions(c as any)).toEqual([]);
  });

  it('an unknown country adds none either', () => {
    expect(legalMentions(undefined)).toEqual([]);
  });
});

describe('the footer actually renders them', () => {
  it('interpolates legalMentions into the invoice HTML', () => {
    // A pure function nothing calls would pass every test above and print
    // nothing on the document.
    let src = '';
    try {
      src = fs.readFileSync(
        path.resolve(__dirname, '../invoicePdfService.ts'), 'utf8',
      );
    } catch { /* leave empty; the assertion below reports it */ }
    expect(src).not.toBe('');
    const footer = src.slice(src.indexOf('<!-- Footer -->'));
    expect(footer).toMatch(/legalMentions\(country\)/);
  });
});
