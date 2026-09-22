/**
 * An empty-state title on a main tab is centred as TEXT, not only as a box.
 *
 * Every empty panel on these tabs is `alignItems: 'center'`, which centres a
 * one-line title. It does nothing for a title that WRAPS: a wrapped Text takes
 * the full width and its lines fall back to the left. Dutch and German wrap
 * where English fits — "NOG GEEN OFFERTES OF FACTUREN" sat flush against the
 * left padding under a centred icon, description and button (TestFlight,
 * 2026-09-22). The description beside it always had `textAlign: 'center'`;
 * the title never did, on any of the four tabs.
 *
 * `npm run walk` cannot see this — react-test-renderer does not lay out.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { stripComments } from '../utils/stripComments';

const TABS = ['geld', 'werk', 'bedrijf', 'ai'];

function titleStyles(tab: string): { key: string; body: string }[] {
  const src = stripComments(readFileSync(join(__dirname, '../../app/(contractor)', `${tab}.tsx`), 'utf8'));
  const out: { key: string; body: string }[] = [];
  const re = /^\s+((?:full)?[eE]mptyTitle)\s*:\s*\{([^}]*)\}/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ key: m[1], body: m[2] });
  return out;
}

describe('empty-state titles on the main tabs are centred text', () => {
  it('finds the title styles at all', () => {
    // Without this every assertion below is vacuously true.
    const n = TABS.reduce((s, t) => s + titleStyles(t).length, 0);
    expect(n).toBeGreaterThanOrEqual(6);
  });

  for (const tab of TABS) {
    it(`${tab}: every empty title sets textAlign: 'center'`, () => {
      for (const { key, body } of titleStyles(tab)) {
        expect({ tab, key, centred: /textAlign:\s*'center'/.test(body) })
          .toEqual({ tab, key, centred: true });
      }
    });
  }
});
