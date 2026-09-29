// A quote line's quantity was a plain number with − / + steppers: 45 m² took
// 44 taps and 12,5 m was impossible (contractor quote walk, 2026-09-29). It is
// a DecimalInput now, committed on blur — never per keystroke, because
// clearing the field passes through 0, which REMOVES the line — and "Bekijk
// offerte" (outside the ScrollView, so no blur) applies whatever is pending.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../components/contractor/TieredQuoteBuilder.tsx'), 'utf8'));

it('quantity is a typed field, stored per keystroke only as pending', () => {
  expect(src).toMatch(/<DecimalInput\s+style=\{s\.qtyInput\}\s+value=\{sv\.quantity\}/);
  expect(src).toMatch(/onChangeValue=\{\(n\) => \{ typedQtyRef\.current\.set\(sv\.item\.id, n\); \}\}/);
  expect(src).not.toMatch(/<Text style=\{s\.qtyText\}>\{sv\.quantity\}<\/Text>/);
});

it('a typed 0 never removes the line; review applies pending quantities', () => {
  expect(src).toMatch(/if \(n !== undefined && n > 0\) updateQuantity\(itemId, n\)/);
  expect(src).toMatch(/onPress=\{\(\) => \{ commitAllTypedQuantities\(\); hapticSuccess\(\); setStep\('preview'\); \}\}/);
});

// Same review screen: "45.5 × € 9,75" (English point) and a "Vasco advies"
// card with a title and nothing under it.
it('the review prints the quantity in the market format', () => {
  expect(src).toMatch(/\{formatNumber\(sv\.quantity, country as Country\)\} × \{fmt\(/);
  expect(src).not.toMatch(/\{sv\.quantity\} × \{fmt\(/);
});

it('the advice card renders only when a row will', () => {
  expect(src).toMatch(/\{hasVascoAdvice && \(\s*<View style=\{s\.vascoCard\}>/);
});
