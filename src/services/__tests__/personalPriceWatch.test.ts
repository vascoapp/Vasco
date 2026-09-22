/**
 * The personal price watch compares a contractor with THEIR OWN history:
 * same supplier, same material, same unit, latest against an earlier day.
 */
import { computePriceRises, PRICE_RISE_THRESHOLD_PCT, type PriceRow } from '../personalPriceWatch';

const row = (over: Partial<PriceRow>): PriceRow => ({
  supplier_id: 'richter', supplier_name: 'Richter', material_name: 'Kupferrohr 15 mm',
  canonical_name: 'kupferrohr 15mm', unit: 'm', price_excl_vat: 12.5, observed_at: '2026-06-01T08:00:00Z', ...over,
});

describe('personal price watch', () => {
  it('reports a rise against the previous list, as a whole percent', () => {
    const w = computePriceRises([row({}), row({ price_excl_vat: 13.5, observed_at: '2026-09-01T08:00:00Z' })]);
    expect(w.tracked).toBe(1);
    expect(w.rises).toHaveLength(1);
    expect(w.rises[0]).toMatchObject({ previous: 12.5, latest: 13.5, pct: 8, supplierName: 'Richter', unit: 'm' });
  });

  it('two rows from the same day are one price list, not a change', () => {
    const w = computePriceRises([row({}), row({ price_excl_vat: 20, observed_at: '2026-06-01T15:00:00Z' })]);
    expect(w.tracked).toBe(0);
    expect(w.rises).toEqual([]);
  });

  it(`ignores rises below ${PRICE_RISE_THRESHOLD_PCT}% and every drop`, () => {
    const small = computePriceRises([row({}), row({ price_excl_vat: 13.0, observed_at: '2026-09-01T08:00:00Z' })]);
    expect(small.tracked).toBe(1);
    expect(small.rises).toEqual([]);
    const drop = computePriceRises([row({}), row({ price_excl_vat: 9, observed_at: '2026-09-01T08:00:00Z' })]);
    expect(drop.rises).toEqual([]);
  });

  it('never compares different units or different suppliers', () => {
    const w = computePriceRises([
      row({}),
      row({ unit: 'Rolle', price_excl_vat: 90, observed_at: '2026-09-01T08:00:00Z' }),
      row({ supplier_id: 'gc', supplier_name: 'GC', price_excl_vat: 30, observed_at: '2026-09-01T08:00:00Z' }),
    ]);
    expect(w.tracked).toBe(0);
    expect(w.rises).toEqual([]);
  });

  it('skips rows with no usable price', () => {
    const w = computePriceRises([row({ price_excl_vat: null }), row({ price_excl_vat: 0, observed_at: '2026-09-01T08:00:00Z' })]);
    expect(w).toEqual({ tracked: 0, rises: [] });
  });

  it('lists the biggest rises first, capped', () => {
    const rows: PriceRow[] = [];
    for (let i = 1; i <= 7; i++) {
      rows.push(row({ canonical_name: `m${i}`, material_name: `M${i}` }));
      rows.push(row({ canonical_name: `m${i}`, material_name: `M${i}`, price_excl_vat: 12.5 * (1 + i / 10), observed_at: '2026-09-01T08:00:00Z' }));
    }
    const w = computePriceRises(rows);
    expect(w.rises.map((r) => r.pct)).toEqual([70, 60, 50, 40, 30]);
    expect(w.tracked).toBe(7);
  });
});
