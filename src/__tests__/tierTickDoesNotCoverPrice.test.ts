/**
 * @jest-environment node
 */
// The selected-package tick on the customer's quote view sits beside the
// package NAME, in the flow — never absolutely over the card's top-right,
// where the price (and the "Aanbevolen" ribbon) live. It read "€ 5.800,0✓"
// on the emulator walk (2026-09-28). Layout: re-check on a device after any
// change here; this pins the structure.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/contractor/customer-view.tsx'), 'utf8'));

it('renders the tick inside the name row', () => {
  const row = src.match(/<View style=\{s\.tierLabelRow\}>([\s\S]*?)<\/View>/);
  expect(row).not.toBeNull();
  expect(row![1]).toMatch(/testID="tier-selected-tick"/);
  expect(row![1]).toMatch(/tier\.label/);
});

it('has no absolutely positioned tick style', () => {
  const styles = src.slice(src.indexOf('StyleSheet.create'));
  const tick = styles.match(/\n\s*(selectedCheck|tierLabelRow):\s*\{([^}]*)\}/g) ?? [];
  expect(tick.length).toBeGreaterThan(0);
  for (const t of tick) expect(t).not.toMatch(/position:\s*'absolute'/);
  expect(src).not.toMatch(/s\.selectedCheck/);
});
