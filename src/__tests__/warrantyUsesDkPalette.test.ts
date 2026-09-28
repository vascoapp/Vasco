/**
 * @jest-environment node
 */
// Garantiebeheer speaks the DK Sunset Slate palette (CLAUDE.md design system).
// It still used the retired LIGHT palette — Palette.green500 / blue500 /
// yellow600 and pastel backgrounds orange50 / orange100 / gray100 on a dark
// screen, a blue tile, green "expires in 550 days" — and read as wrong
// (user, emulator walk 2026-09-28: "color is strange").
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../components/contractor/WarrantyManager.tsx'), 'utf8'));

it('uses no light-palette colour and no raw rgba', () => {
  expect(src.match(/Palette\.(green|blue|yellow|orange|red|gray|purple)\d+/g) ?? []).toEqual([]);
  expect(src.match(/rgba\(/g) ?? []).toEqual([]);
});

it('a far-off expiry is neutral, not green', () => {
  const fn = src.slice(src.indexOf('daysUntilExpiry < 0'), src.indexOf('daysUntilExpiry < 0') + 250);
  expect(fn).toMatch(/return DK\.colors\.textMuted;/);
  expect(fn).not.toMatch(/success/);
});
