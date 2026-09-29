// Aannemer form walk (2026-09-29):
// - crew form hardcoded US placeholders ("mike@example.com", "+1 555 0123",
//   "HVAC / electrical / plumbing…") in every market, and picked the role
//   from a chip grid (CLAUDE.md: one-of-N is a menu);
// - the purchase-order message read "created for PO-2026-0043" with no
//   singular form.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { contactExamples } from '../utils/contactExamples';

const read = (f: string) => stripComments(fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8'));

it('crew placeholders come from the market, not a US literal', () => {
  const src = read('app/contractor/crew.tsx');
  expect(src).not.toMatch(/mike@example\.com|\+1 555 0123|HVAC \/ electrical/);
  expect(src).toMatch(/placeholder=\{ex\.email\}/);
  expect(src).toMatch(/placeholder=\{ex\.phone\}/);
  expect(contactExamples('NL').phone).toMatch(/^\+31/);
  expect(contactExamples('DE').email).toMatch(/\.de$/);
});

it('crew role is a DKMenu', () => {
  const src = read('app/contractor/crew.tsx');
  expect(src).toMatch(/<DKMenu\s+accessibilityLabel=\{t\('crew\.role'/);
  expect(src).not.toMatch(/styles\.roleChip/);
});

it.each(['en', 'nl', 'de', 'fr', 'es', 'it'])('%s PO message names the order, singular and plural', (l) => {
  const po = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${l}.json`), 'utf8')).purchaseOrders;
  expect(po.poCreatedDesc).toBeUndefined();
  for (const k of ['poCreatedDesc_one', 'poCreatedDesc_other']) {
    expect(po[k]).toMatch(/^\{\{title\}\}/);
    expect(po[k]).not.toMatch(/\bfor\b|\bvoor\b|\bfür\b|\bpour\b|\bpara\b|\bper\b/);
  }
});
