/**
 * Shared cohort data never gets a market it was not given (sweep D6).
 *
 * - An unknown country was stamped NL (and the currency EUR) on a material
 *   price, so a UK or German price landed in the Dutch benchmark.
 * - The procurement agent wrote every supplier option — mostly STATIC country
 *   baselines — into the contractor's QUOTE pricing (no quote id, NL, VAT 21):
 *   the cohort learned its own reference table.
 */
const mockInsert = jest.fn(async (_row: any) => ({ error: null }));
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({ insert: (row: any) => mockInsert({ table, ...row }) }),
    rpc: jest.fn(async () => ({ data: null, error: null })),
  },
}));
let mockCountry: string | undefined;
// A REAL-shaped signed-in user: with the placeholder id every cohort writer
// returns early, and a test of "nothing was written" would pass on that alone.
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getCurrentCountry: () => mockCountry,
  getCurrentUserId: () => 'aaaaaaaa-1111-4111-8111-000000000001',
  getAuthedUserId: () => 'aaaaaaaa-1111-4111-8111-000000000001',
}));

import { emitMaterialPurchased, recordJobDurationData } from '../dataCollector';

const USER = 'aaaaaaaa-1111-4111-8111-000000000001';
const purchase = (over: Record<string, unknown> = {}) => ({
  supplierId: 'wasco', supplierName: 'Wasco', materialName: 'Koperbuis 15mm',
  quantity: 10, unitPrice: 4.2, price: 4.2, unit: 'm', trade: 'plumbing', ...over,
}) as any;
const priceRows = () => mockInsert.mock.calls.map((c) => c[0]).filter((r) => r.table === 'material_price_history');

beforeEach(() => { mockInsert.mockClear(); mockCountry = undefined; });

it('no market → no price row, and the caller is told nothing landed', async () => {
  expect(await emitMaterialPurchased(USER, purchase())).toBe(false);
  expect(priceRows()).toHaveLength(0);
});

it('the market and its currency come from the contractor, not NL/EUR', async () => {
  mockCountry = 'UK';
  expect(await emitMaterialPurchased(USER, purchase())).toBe(true);
  expect(priceRows()[0]).toMatchObject({ country: 'UK', currency: 'GBP' });
});

it('a job duration with no market writes no cohort row', async () => {
  await recordJobDurationData(USER, { trade: 'plumbing', country: '', jobType: 'repair', estimatedHours: 4, actualHours: 5 });
  expect(mockInsert.mock.calls.filter((c) => c[0].table === 'job_duration_data')).toHaveLength(0);
  await recordJobDurationData(USER, { trade: 'plumbing', country: 'DE', jobType: 'repair', estimatedHours: 4, actualHours: 5 });
  expect(mockInsert.mock.calls.filter((c) => c[0].table === 'job_duration_data')).toHaveLength(1);
});

jest.mock('../../integrations/suppliers', () => ({
  ...jest.requireActual('../../integrations/suppliers'),
  searchCatalog: jest.fn(async () => [
    { supplierId: 'wasco', priceExclVat: 4.2, inStock: true, leadTimeDays: 1 },
    { supplierId: 'technische-unie', priceExclVat: 5.1, inStock: true, leadTimeDays: 2 },
  ]),
  comparePrices: jest.fn(async () => null),
}));

it('sourcing a material writes no quote pricing for the cohort', async () => {
  mockCountry = 'NL';
  const { sourceMaterial } = require('../../services/procurementAgentService');
  await sourceMaterial({ materialId: 'm1', name: 'Koperbuis 15mm', quantity: 10, unit: 'm', jobId: 'j1' }, 'plumbing');
  await new Promise((r) => setTimeout(r, 0));
  expect(mockInsert.mock.calls.filter((c) => /pricing/.test(c[0].table))).toEqual([]);
});

it('control: a real quote line DOES reach quote pricing (the test can see a write)', async () => {
  mockCountry = 'NL';
  const { recordPricingData } = require('../dataCollector');
  await recordPricingData('aaaaaaaa-1111-4111-8111-000000000001', { quoteId: 'Q-1', trade: 'plumbing', country: 'NL', lineDescription: 'x', quotedUnitPrice: 10, quotedQuantity: 1, vatRate: 21 });
  expect(mockInsert.mock.calls.filter((c) => /pricing/.test(c[0].table)).length).toBeGreaterThan(0);
});

// Through the REAL callers — the first version guarded only the writer while
// every caller passed `getCurrentCountry() || 'NL'` (review 2026-10-05).
jest.mock('../../services/extractionVerification', () => ({
  verifyExtractedInvoice: () => ({ moatSafe: true }),
  summariseVerification: () => '',
}));

const scanned = () => ({
  id: 'scan-1', documentType: 'invoice', supplierName: 'Wasco', documentDate: '2026-10-01',
  subtotal: 42, vatAmount: 8.82, total: 50.82, confidence: 95, scannedAt: new Date().toISOString(),
  lineItems: [{ description: 'Koperbuis 15mm', quantity: 10, unit: 'm', unitPrice: 4.2, total: 42, confidence: 95, category: 'plumbing' }],
}) as any;

it('a scanned invoice with no market feeds no price rows; with one, it does', async () => {
  const { feedPricingMoat } = require('../../services/invoiceScanService');
  expect(await feedPricingMoat(scanned())).toBe(0);
  expect(priceRows()).toHaveLength(0);
  mockCountry = 'DE';
  expect(await feedPricingMoat(scanned())).toBeGreaterThan(0);
  expect(priceRows()[0]).toMatchObject({ country: 'DE', currency: 'EUR' });
});

it('a DATANORM import with no market writes nothing and says so', async () => {
  const rpc = require('../../lib/supabase').supabase.rpc as jest.Mock;
  rpc.mockClear();
  const { importDatanormToMoat } = require('../../integrations/datanorm');
  const res = await importDatanormToMoat([{ articleNumber: 'A1', shortText1: 'Koperbuis', price: 4.2, unit: 'm' }], 'wasco', { supplierName: 'Wasco', trade: 'plumbing' });
  expect(res).toMatchObject({ imported: 0, failed: 1 });
  expect(rpc).not.toHaveBeenCalled();
});

describe('no cohort writer is handed a defaulted market', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const { stripComments } = require('../../utils/stripComments');
  const ROOT = path.resolve(__dirname, '../../..');
  // The code that feeds SHARED cohort data — not the contractor's own records
  // or display formatting (those may keep a fallback).
  const slice = (f: string, from: string, len: number) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const at = src.indexOf(from);
    expect(at).toBeGreaterThan(-1);
    return src.slice(at, at + len);
  };
  const PATHS: Array<[string, string, number]> = [
    ['src/services/invoiceScanService.ts', 'export async function feedPricingMoat(', 2500],
    ['app/contractor/inkoop.tsx', 'const handleDatanormImport', 3000],
    ['src/integrations/datanorm.ts', 'export async function importDatanormToMoat(', 1500],
    ['src/intelligence/dataCollector.ts', 'export async function emitMaterialPurchased(', 6000],
    ['src/state/AppState.tsx', 'const profTrade = businessProfile.trade', 1500],
    ['src/state/AppState.tsx', "const trade = getCurrentTrade() || 'general';", 400],
    ['src/components/contractor/AIQuoteFromPhoto.tsx', 'if (!qtyMaterial && !priceMaterial) return;', 900],
  ];
  it.each(PATHS)('%s @ %s', (f, from, len) => {
    const code = slice(f, from, len);
    expect(code).not.toMatch(/getCurrentCountry\(\)\s*(\|\||\?\?)\s*'NL'/);
    expect(code).not.toMatch(/country\s*\?\?\s*'NL'/);
  });
});

it('the DATANORM import asks for the country BEFORE the file picker', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const { stripComments } = require('../../utils/stripComments');
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../../app/contractor/inkoop.tsx'), 'utf8'));
  const fn = src.slice(src.indexOf('const handleDatanormImport'));
  const ask = fn.indexOf('if (!businessProfile?.country)');
  expect(ask).toBeGreaterThan(-1);
  expect(ask).toBeLessThan(fn.indexOf('DocumentPicker.getDocumentAsync'));
  expect(fn.slice(ask, fn.indexOf('DocumentPicker.getDocumentAsync'))).toMatch(/inkoop\.countryFirstTitle[\s\S]*return;/);
});

it('the DATANORM handler sees the CURRENT profile (country set via its own prompt)', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const { stripComments } = require('../../utils/stripComments');
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../../app/contractor/inkoop.tsx'), 'utf8'));
  const fn = src.slice(src.indexOf('const handleDatanormImport'));
  const deps = fn.slice(fn.indexOf('}, ['), fn.indexOf(']);') + 1);
  expect(deps).toMatch(/businessProfile/);
  expect(deps).toMatch(/router/);
});
