/**
 * Forms, pop-ups and menus use readable text — the user's call, 2026-09-22:
 * "the grey is hard to decipher … make the letter font white" (forms, pop-ups
 * and menus only; the rest of the app keeps its secondary grey).
 *
 * - Every placeholder uses the `placeholder` token (#B6BCC6): readable, yet
 *   still visibly NOT an entered value. 167 of them were on four different
 *   greys, the darkest #4B5563 on a #1C2128 panel.
 * - The shared menu (DKMenu) and select (DKSelect) render no muted grey text.
 */
import { readFileSync } from 'fs';
import { join, relative } from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = join(__dirname, '../..');
const glob = require('glob') as { sync: (p: string, o?: any) => string[] };

const files = [
  ...glob.sync('app/**/*.tsx', { cwd: ROOT }),
  ...glob.sync('src/components/**/*.tsx', { cwd: ROOT }),
].filter((f) => !f.startsWith('app/hub/') && !f.includes('__tests__'));

describe('forms, pop-ups and menus are readable', () => {
  it('scans the app at all', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no placeholder uses a muted grey', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = stripComments(readFileSync(join(ROOT, f), 'utf8'));
      const re = /placeholderTextColor=\{([^}]+)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        if (/textTertiary|textSecondary|textDisabled|textMuted/.test(m[1])) offenders.push(`${relative(ROOT, join(ROOT, f))}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(['src/components/shared/DKMenu.tsx', 'src/components/shared/DKSelect.tsx', 'src/components/shared/AddCustomerSheet.tsx'])(
    '%s renders no muted grey',
    (rel) => {
      const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
      expect(src).not.toMatch(/textMuted|textTertiary|textSecondary/);
    },
  );
});
