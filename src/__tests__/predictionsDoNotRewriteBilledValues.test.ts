/**
 * @jest-environment node
 */
// A prediction may fill a field named `suggested*`. It may not rewrite what is
// billed (learnings #207).
//
// The quote builder asked the duration predictor to "refine" each matched
// line's quantity and then wrote the returned HOURS into `quantity` whatever
// the line's unit was. A "Zählerschrank, 1 Stück, €450" line came back as
// 0,9 Stück — €405 — and 2 pieces became 1,7 (#339). Only an hourly line has a
// quantity measured in hours.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');

describe('the duration predictor only refines hourly lines', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'src/components/contractor/TieredQuoteBuilder.tsx'), 'utf8'));

  it('guards the override on the line being hourly', () => {
    const at = src.indexOf('prefillDurationForLine');
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, at + 900);
    expect(block).toMatch(/pricingType === 'hourly'/);
    expect(block).toMatch(/isHourly && hours > 0/);
  });

  it('never assigns the predicted hours unconditionally', () => {
    expect(src).not.toMatch(/return hours > 0 && hours < 24 \? \{ \.\.\.svc, quantity: hours \}/);
  });
});

describe('the purchase-order banner is translated and claims no AI', () => {
  // stripComments: the fix's own comment quotes the Dutch it removed.
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'app/contractor/purchase-orders.tsx'), 'utf8'));

  it('has no hardcoded Dutch and no AI claim for a rule-based comparison', () => {
    expect(src).not.toMatch(/AI Inkoopadvies/);
    expect(src).not.toMatch(/materialen geanalyseerd/);
    expect(src).toMatch(/purchaseOrders\.priceComparison/);
  });
});
