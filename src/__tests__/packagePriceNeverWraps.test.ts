/**
 * A package price is one line that shrinks to fit — never a number broken
 * across lines. FR walk, 2026-10-06: "€ 1 488,6" / "0" in each of the three
 * package cards (reads as 1 488,6). react-test-renderer does not lay out, so
 * this guards the props that prevent the wrap; the device walk saw the effect.
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

it('the tier price Text is single-line and fits its card', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../components/contractor/TieredQuoteBuilder.tsx'), 'utf8'));
  expect(src).toMatch(/<Text style=\{s\.tierPrice\} numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.6\}>\{fmt\(tier\.total\)\}<\/Text>/);
});
