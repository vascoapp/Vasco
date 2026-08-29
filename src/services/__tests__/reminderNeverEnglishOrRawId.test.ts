// Everything a CUSTOMER receives must be in their contractor's language and
// must name the document by its own number.
//
// The bulk overdue-reminder path had a fallback that broke both at once:
//
//     : `Reminder for invoice ${inv.id}`
//
// It fires whenever `invoiceAutomationService` is not tracking that invoice —
// any invoice created outside that path — so a German customer chased for
// RE-2026-0087 received "Reminder for invoice inv-de-1". Same pair of defects
// as the Mahnung that named no invoice (learnings #230).
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

function read(rel: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
}

/** Strip // and /* *\/ comments so a fixed defect quoted in a comment does not
 *  re-trigger its own detector. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const SHARE_SCREENS = [
  'app/(contractor)/facturen.tsx',
  'app/invoices/[id].tsx',
  'app/quotes/[id].tsx',
];

describe('customer-facing messages are localized and name a document number', () => {
  it.each(SHARE_SCREENS)('%s builds no bare English reminder sentence', (rel) => {
    const src = stripComments(read(rel));
    expect(src).not.toBe('');
    // A template literal that reads like a sentence to the customer and is not
    // wrapped in t() or a render* template helper.
    expect(src).not.toMatch(/`Reminder for [^`]*`/i);
    expect(src).not.toMatch(/`Invoice reminder[^`]*`/i);
    expect(src).not.toMatch(/`Payment reminder[^`]*`/i);
  });

  it('the bulk reminder interpolates a reference, never a storage id', () => {
    const src = stripComments(read('app/(contractor)/facturen.tsx'));
    // `inv.id` may still appear as a KEY or a lookup argument; what must not
    // happen is it being dropped into the message text.
    expect(src).not.toMatch(/message:\s*`[^`]*\$\{inv\.id\}/);
    expect(src).not.toMatch(/`[^`]*invoice \$\{inv\.id\}/i);
    // ...and the fallback branch must go through the same localized template.
    expect(src).toMatch(/renderPaymentReminderForTag\(bulkLocale, autoInv/);
    expect(src).toMatch(/ref:\s*\(inv as any\)\.reference/);
  });
});
