// Screen-reader labels are copy too. A French contractor's notifications were
// announced "…, unread", and five more labels were English sentences built in
// template literals ("3 pending actions", "photo from", "Vasco saved … this
// week") — walk, 2026-09-30. Literal words in an accessibilityLabel outside
// t() are flagged; names (VascoBuild, WhatsApp, SMS) are fine.
import fs from 'fs';
import path from 'path';
import manifest from '../config/dormant.files.json';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set((manifest as any).files as string[]);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx$/.test(e.name) ? [p] : [];
});

it('no live accessibilityLabel spells out words outside t()', () => {
  const hits: string[] = [];
  for (const f of ['app', 'src/components'].flatMap((d) => walk(path.join(ROOT, d)))) {
    const rel = path.relative(ROOT, f);
    if (dormant.has(rel) || rel.startsWith('app/hub/')) continue;
    stripComments(fs.readFileSync(f, 'utf8')).split('\n').forEach((l, i) => {
      const m = l.match(/accessibilityLabel=\{`([^`]*)`\}/);
      if (!m) return;
      // Translated parts are fine: remove t('…', …) calls (with their English
      // defaults). What remains may not carry words — neither as literal text
      // nor as a quoted string inside an interpolation (', unread' hid in a
      // ternary, and a first version of this guard missed it).
      const rest = m[1].replace(/\bt\('[^']*'(?:\s*,\s*(?:'[^']*'|\{[^}]*\}))?\)/g, ' ');
      const quoted = [...rest.matchAll(/'([^']*)'/g)].map((q) => q[1]);
      const literal = rest.replace(/\$\{[^}]*\}/g, ' ');
      if (/\b[a-z]{2,}\s+[a-z]{2,}\b/.test(literal) || /(^|[,\s])(unread|photo|photos|pending|saved|from)\b/.test(literal)
        || quoted.some((q) => /[a-z]{3,}/i.test(q) && !/^(string|number|object|boolean|undefined|function)$/.test(q))) {
        hits.push(`${rel}:${i + 1}  ${m[1].slice(0, 80)}`);
      }
    });
  }
  expect(hits).toEqual([]);
});
