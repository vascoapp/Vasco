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

describe('calibration adjusts the line it came from', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'src/components/contractor/TieredQuoteBuilder.tsx'), 'utf8'));

  it('matches by description, never by position', () => {
    // `useQuoteCalibration` skips lines with no matching job type and lines
    // under a 5% delta, so its array is COMPACTED — `calibrations[idx]` is a
    // different line than `selectedServices[idx]`, and Apply adjusted the
    // wrong one (#339).
    expect(src).toMatch(/calibrationByDescription = useMemo/);
    const apply = src.slice(src.indexOf('s.vascoApply'), src.indexOf('s.vascoSkip'));
    expect(apply).toMatch(/calibrationByDescription\.get\(sv\.item\.name\)/);
    expect(apply).not.toMatch(/calibrations\[idx\]/);
  });

  it('only touches a line whose quantity is hours, and keeps the halves', () => {
    const apply = src.slice(src.indexOf('s.vascoApply'), src.indexOf('s.vascoSkip'));
    expect(apply).toMatch(/pricingType === 'hourly'/);
    expect(apply).not.toMatch(/Math\.ceil/);
    expect(apply).toMatch(/Math\.round\(sv\.quantity \* cal\.combinedMultiplier \* 100\) \/ 100/);
  });

  it('is not offered when it would change nothing', () => {
    expect(src).toMatch(/\{calibratableServices\.length > 0 && !calibrationApplied &&/);
  });

  it('the banner quotes the adjustment of the lines Apply changes, not of every calibration', () => {
    const banner = src.slice(src.indexOf('quotes.calibrationLine'), src.indexOf('s.vascoApply'));
    expect(banner).toMatch(/calibratableServices\.map/);
    expect(banner).not.toMatch(/calibrations\[0\]|calibrations\.map|calibrations\.some/);
  });
});
