/**
 * @jest-environment node
 */
// `#1A1A1A` was the ink colour of the light "Wolt" theme that DraftKings Sunset
// Slate replaced in R175. Left on an icon, it draws near-black on the dark
// panels — the back chevron on Einkauf and Versicherungen and the close button
// of the insurance claim sheet were all but invisible on a German device
// (2026-09-14). ui-playbook §1: never a raw hex; use SemanticColors / DK.
// app/hub/** is excluded deliberately (portfolio roles are out of scope).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['app/contractor', 'app/(contractor)', 'app/(modals)', 'app/quotes', 'app/invoices', 'src/components/contractor', 'src/components/shared'];
const LIGHT_INK = /#1A1A1A\b/i;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('no light-theme ink on dark contractor screens', () => {
  const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));

  it('scans the screens it claims to', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.endsWith(path.join('contractor', 'inkoop.tsx')))).toBe(true);
  });

  it('finds no #1A1A1A', () => {
    const hits = files
      .filter((f) => LIGHT_INK.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});
