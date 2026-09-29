// "Bedrag € 443,63" sat under a quote whose total read € 536,79 incl. btw —
// Quote.amount is NET (#241) and the label did not say so (walk, 2026-09-29).
import fs from 'fs';
import path from 'path';

const NET = { en: /excl\. VAT/, nl: /excl\. btw/, de: /netto/, fr: /\bHT\b/, es: /sin IVA/, it: /IVA esclusa/ } as const;

it.each(Object.entries(NET))('%s labels the quote amount as net', (l, re) => {
  const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${l}.json`), 'utf8'));
  expect(j.quoteToInvoice.amount).toMatch(re);
});
