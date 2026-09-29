// A decision tracker stores `templateName` in the language of the day it was
// created. CLAUDE.md: catalogue copy resolves by STABLE id at render time.
//
// German emulator walk 2026-09-29: Klanten showed "Full Bathroom Renovation"
// to a German contractor because bedrijf.tsx rendered the stored name raw, and
// DecisionTracker put the raw name into the customer email's SUBJECT. Every
// read of a tracker's stored name that reaches a screen or a message must go
// through localizeTemplateName.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const root = path.resolve(__dirname, '../..');
const FILES = [
  'app/(contractor)/bedrijf.tsx',
  'app/(contractor)/decisions.tsx',
  'src/components/contractor/DecisionTracker.tsx',
];

it.each(FILES)('%s never shows a tracker name without resolving it', (f) => {
  const lines = stripComments(fs.readFileSync(path.join(root, f), 'utf8')).split('\n');
  const raw = lines.filter((l, i) =>
    /\b(?:tracker|current|raw)\??\.templateName\b/.test(l) &&
    // the resolver call may open on one of the two lines above
    !/localizeTemplateName\(/.test(lines.slice(Math.max(0, i - 2), i + 1).join(' ')) &&
    !/^\s*project:\s*raw\?\.templateName/.test(l) && // the adapter; rendered below
    !/^\s*templateName:/.test(l),                     // a write, not a read
  );
  expect(raw).toEqual([]);
});

it('Klanten renders the adapted tracker name through the resolver', () => {
  const src = stripComments(fs.readFileSync(path.join(root, 'app/(contractor)/bedrijf.tsx'), 'utf8'));
  expect(src).not.toMatch(/\{\s*(?:feature\.)?tracker\.project\s*\}/);
  expect(src).toMatch(/templateId:\s*typeof raw\?\.templateId/);
});
