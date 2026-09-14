/**
 * @jest-environment node
 */
// The customer's in-app code entry must accept a REAL access code.
//
// Real codes are 32 lowercase hex characters (decisionTrackerService) and the
// portal RPC matches them exactly. The entry screen upper-cased the input and
// capped it at 8 characters, so a real code could neither be typed whole nor
// match — only the 6-character demo code "worked". This pins both halves.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const SRC = stripComments(fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'customer', 'index.tsx'), 'utf8'));
const GEN = fs.readFileSync(path.join(__dirname, '..', 'services', 'decisionTrackerService.ts'), 'utf8');

describe('customer access code entry', () => {
  it('generated codes are still 32 lowercase hex (the premise of this guard)', () => {
    expect(GEN).toMatch(/const HEX = '0123456789abcdef'/);
    expect(GEN).toMatch(/i < 32/);
  });

  it('does not change the case of what the customer enters', () => {
    expect(SRC).not.toMatch(/toUpperCase\(\)/);
    expect(SRC).not.toMatch(/autoCapitalize="characters"/);
  });

  it('lets a 32-character code be entered', () => {
    const m = SRC.match(/maxLength=\{(\d+)\}/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(32);
  });
});
