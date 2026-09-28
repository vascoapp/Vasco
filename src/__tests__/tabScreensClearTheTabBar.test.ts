/**
 * @jest-environment node
 */
// Every scrolling screen in the contractor tab group clears the tab bar.
//
// The bar in app/(contractor)/_layout.tsx is `position: 'absolute'`, so content
// scrolls UNDER it. A screen whose scroll content pads less than the bar can
// never lift its last element into view: Certificaten's last portal (Inspectie
// SZW) sat under the bar at full scroll and could not be tapped (emulator walk
// 2026-09-28); AI, Klanten, Besparen, Facturen and Beslissingen had the same
// shape. The clearance is TAB_BAR_CLEARANCE (src/theme/tabStyles.ts), or an
// explicit number at least that large.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { TAB_BAR_CLEARANCE } from '../theme/tabStyles';

const DIR = path.resolve(__dirname, '../../app/(contractor)');
// Not a scrolling content screen under the bar.
const EXEMPT: Record<string, string> = {
  '_layout.tsx': 'the tab navigator itself',
  'error.tsx': 'a centred error message, never longer than the screen',
};

/** The style expression of the first VERTICAL ScrollView/FlatList in `src`. */
function firstVerticalContentStyle(src: string): string | null {
  // (?<![\w.]) skips TypeScript generics — `useRef<ScrollView>(null)` is not JSX.
  for (const m of src.matchAll(/(?<![\w.])<(ScrollView|FlatList|Animated\.ScrollView)\b([\s\S]*?)>/g)) {
    const props = m[2];
    if (/\bhorizontal\b(?!\s*=\s*\{\s*false)/.test(props)) continue;
    const c = props.match(/contentContainerStyle=\{([\s\S]*?)\}\s*(?:\n|\s[a-zA-Z]|\/?$)/);
    return c ? c[1] : '';
  }
  return null;
}

function clears(src: string, expr: string): boolean {
  const ok = (body: string) => {
    if (/paddingBottom:\s*TAB_BAR_CLEARANCE\b/.test(body)) return true;
    const n = body.match(/paddingBottom:\s*(\d+)/);
    return !!n && Number(n[1]) >= TAB_BAR_CLEARANCE;
  };
  if (ok(expr)) return true;
  const ref = expr.match(/\b(?:s|styles)\.(\w+)/);
  if (!ref) return false;
  const def = src.match(new RegExp(`\\n\\s*${ref[1]}:\\s*\\{([^}]*)\\}`));
  return !!def && ok(def[1]);
}

describe('contractor tab screens clear the absolute tab bar', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.tsx') && !EXEMPT[f]);

  it('scans the screens it claims to', () => {
    expect(files).toEqual(expect.arrayContaining(['certificaten.tsx', 'geld.tsx', 'werk.tsx', 'ai.tsx', 'decisions.tsx']));
  });

  it('pads every screen\'s scroll content by at least the bar', () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = stripComments(fs.readFileSync(path.join(DIR, f), 'utf8'));
      const expr = firstVerticalContentStyle(src);
      if (expr === null) continue; // no scroller on this screen
      if (!clears(src, expr)) bad.push(`${f}: contentContainerStyle={${expr.trim().slice(0, 60)}}`);
    }
    expect(bad).toEqual([]);
  });
});
