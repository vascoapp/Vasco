// The reduced-VAT control shipped NL-only, so all six translations of its title
// hardcoded the Dutch "9%". The moment FR/IT/ES qualified at 10%, a French
// artisan applying 10% would have read "TVA réduite 9 %" — a wrong tax rate,
// stated on the screen where he sets the price. The rate is interpolated now;
// this pins that every locale actually interpolates it.
import fs from 'fs';
import path from 'path';
import { getReducedVatRate } from '../../domain/business';

const LOCALES = ['en-US', 'nl', 'de', 'fr', 'es', 'it'];
const DIR = path.resolve(__dirname, '../locales');

function quotes(locale: string): Record<string, string> {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${locale}.json`), 'utf8')).quotes ?? {};
}

describe('reduced-VAT copy carries no hardcoded rate', () => {
  it.each(LOCALES)('%s interpolates the rate into the title', (locale) => {
    const title = quotes(locale).reducedVatTitle;
    expect(title).toBeTruthy();
    expect(title).toContain('{{rate}}');
    // The Dutch 9 must not survive anywhere in the string.
    expect(title.replace('{{rate}}', '')).not.toMatch(/\b9\b/);
  });

  it.each(LOCALES)('%s resolves a subtitle describing the qualifying work', (locale) => {
    // en-US is an OVERRIDE layer over en, not a full locale: it carries only
    // what genuinely differs in US English ("Sales tax" for VAT). The subtitle
    // has nothing US-specific in it, so it correctly lives in `en` alone and
    // en-US inherits it — asserting a key IN the file would push dead weight
    // back into the override layer that `currencySymbolInStrings` exists to
    // keep empty.
    const own = quotes(locale).reducedVatSubtitle;
    const resolved = own ?? (locale === 'en-US' ? quotes('en').reducedVatSubtitle : undefined);
    expect(resolved).toBeTruthy();
  });

  it('every country the toggle renders for has a rate to interpolate', () => {
    // The control renders exactly when getReducedVatRate is non-null. If a
    // country were added there without a rate the title would read "% ...".
    for (const c of ['NL', 'FR', 'IT', 'ES'] as const) {
      const rate = getReducedVatRate(c);
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThan(0);
    }
  });
});
