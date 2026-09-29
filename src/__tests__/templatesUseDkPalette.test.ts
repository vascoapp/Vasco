/**
 * @jest-environment node
 */
// Berichtsjablonen speaks the DK palette: no hard-coded hex (a blue #3B82F6
// and a pink #EC4899 category colour) and no info-blue "Standaard" badge on
// the dark UI (emulator walk 2026-09-29, after "color is strange" on Garantie).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

it('no hex literals and no info-blue in the template screen', () => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/contractor/message-templates.tsx'), 'utf8'));
  expect(src.match(/'#[0-9A-Fa-f]{3,8}'/g) ?? []).toEqual([]);
  expect(src).not.toMatch(/feedbackInfo/);
});
