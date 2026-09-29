// Invoice screen on a device (walk, 2026-09-29): the title "FACTUUR
// AANNEMERSBEDRIJF HOEKSTRA BV" broke mid-word ("AANN / EMERSBEDRIJF"), and
// the quantity column header "AANTAL" broke into "AANTA / L" at 40 pt.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/invoices/[id].tsx'), 'utf8'));

it('the title shrinks to fit two lines instead of breaking a word', () => {
  expect(src).toMatch(/<Text style=\{styles\.headerTitle\} numberOfLines=\{2\} adjustsFontSizeToFit minimumFontScale=\{0\.55\}>\s*\{t\('invoices\.invoice'/);
});

it('the quantity header and field share a 56 pt column that fits the word', () => {
  expect(src).toMatch(/width: 56, textAlign: 'center' \}\]\} numberOfLines=\{1\} adjustsFontSizeToFit[^>]*>\{t\('invoices\.qty'/);
  expect(src).toMatch(/style=\{\[styles\.lineInput, \{ width: 56, textAlign: 'center' \}\]\}\s*value=\{item\.quantity\}/);
});

it('the edit header labels only columns the row has (no "Total" over the delete button)', () => {
  const header = src.slice(src.indexOf('<View style={styles.lineHeaderRow}>'), src.indexOf('</View>', src.indexOf('<View style={styles.lineHeaderRow}>')));
  expect(header).not.toMatch(/invoices\.total/);
  expect(header).toMatch(/<View style=\{\{ width: 24 \}\} \/>/);
});
