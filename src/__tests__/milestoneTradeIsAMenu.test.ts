// "Which trade" on a milestone picks ONE of 14 trades — a menu, not a chip
// grid (CLAUDE.md). On the device the chips gave no sign a tap had landed
// (aannemer walk, 2026-09-29). "No particular trade" stays an explicit choice:
// a milestone without a trade is deliberately never a staffing gap.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/contractor/projects/[id].tsx'), 'utf8'));

it('picks the trade from a DKMenu', () => {
  expect(src).toMatch(/<DKMenu\s+accessibilityLabel=\{t\('project\.milestoneTrade'/);
  expect(src).toMatch(/label: t\('project\.noTrade'/);
});

it('has no toggle-chip trade grid left', () => {
  expect(src).not.toMatch(/setTrade\(trade === slug \? undefined : slug\)/);
  expect(src).not.toMatch(/styles\.tradeChip/);
});
