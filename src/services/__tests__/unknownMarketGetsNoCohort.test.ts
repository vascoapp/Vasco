/**
 * A contractor whose market is unknown is never priced or benchmarked against
 * another market, and their events are not filed under one.
 *
 * `getCurrentCountry() || 'NL'` sent the photo quote's repricer, the budget
 * optimizer's benchmarks and the expense event to the DUTCH cohort for anyone
 * without a country — Dutch medians shown as "the market" to a German, and his
 * spend counted as Dutch (sweep D6 leftovers, 2026-10-05). The server's
 * import_catalog_prices now refuses a missing country too (migration
 * 20261005000001, live-checked by check:catalog-import).
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../../utils/stripComments';

const mockRpc = jest.fn(async () => ({ data: [{ token_key: 'koperen buis', contractor_count: 9, median_qty_delta_pct: 20, median_unit_price_delta_pct: 25 }], error: null }));
jest.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...a: unknown[]) => (mockRpc as any)(...a), from: () => { throw new Error('unused'); } } }));
jest.mock('../cohortBenchmarkService', () => ({ getContractorCalibration: jest.fn(async () => null) }));

import { applyCohortAdjustments } from '../pricingMoatService';

const line = { id: 'l1', description: 'Koperen buis', quantity: 10, unitPrice: 5 };

beforeEach(() => mockRpc.mockClear());

it('no market: no cohort request, every line unchanged', async () => {
  const { lines, summary } = await applyCohortAdjustments([line], { trade: 'plumbing', country: '' });
  expect(mockRpc).not.toHaveBeenCalled();
  expect(lines[0]).toMatchObject({ quantity: 10, unitPrice: 5, adjustmentApplied: false });
  expect(summary.linesAdjusted).toBe(0);
});

it('a known market asks its own cohort (control)', async () => {
  await applyCohortAdjustments([line], { trade: 'plumbing', country: 'DE' });
  expect(mockRpc).toHaveBeenCalledWith('get_line_adjustments_batch', expect.objectContaining({ p_country: 'DE' }));
});

it.each([
  'src/components/contractor/AIQuoteFromPhoto.tsx',
  'src/services/budgetOptimizerService.ts',
  'src/services/expenseService.ts',
])('%s does not default an unknown market to NL', (file) => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../../..', file), 'utf8'));
  expect(src).not.toMatch(/getCurrentCountry\(\)\s*(\|\||\?\?)\s*'NL'/);
});
