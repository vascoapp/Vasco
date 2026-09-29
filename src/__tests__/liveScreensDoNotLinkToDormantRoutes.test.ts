// A live screen that links to a DORMANT route shows a button that bounces the
// contractor home: the root layout redirects every dormant route. The six
// "Werfacties" tiles on an aannemer's project did exactly that — wired before
// `sitelead` was gated, never noticed after (aannemer walk, 2026-09-29).
// A link is allowed only under a visible gate a few lines above it
// (DORMANT_CONTROLS.x or a feature flag like `officeBotEnabled &&`).
import fs from 'fs';
import path from 'path';
import manifest from '../config/dormant.files.json';
import { DORMANT_ROUTES } from '../config/dormant';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);
const PREFIXES = Object.keys(DORMANT_ROUTES);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx?$/.test(e.name) ? [p] : [];
});
const GATE = /DORMANT_CONTROLS\.\w+|\b\w+Enabled\s*&&/;

const files = ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)))
  .map((f) => path.relative(ROOT, f))
  .filter((f) => !dormant.has(f) && !f.startsWith('app/hub/'));

it('knows the dormant prefixes', () => { expect(PREFIXES).toContain('sitelead'); });

it('no live screen links to a dormant route without a gate', () => {
  const hits: string[] = [];
  for (const f of files) {
    const lines = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n');
    lines.forEach((l, i) => {
      for (const m of l.matchAll(/[`'"]\/((?:\([a-z]+\)\/)?[a-z-]+(?:\/[a-z-]+)?)/g)) {
        const r = m[1];
        if (!PREFIXES.some((p) => r === p || r.startsWith(`${p}/`))) continue;
        if (GATE.test(lines.slice(Math.max(0, i - 25), i + 1).join('\n'))) continue;
        hits.push(`${f}:${i + 1} → /${r}`);
      }
    });
  }
  expect(hits).toEqual([]);
});
