/**
 * @jest-environment node
 */
// A quote created offline is re-sent by `healOrphanLineItems` on the next
// load. The heal dropped every line's rate (its type had none), so an NL quote
// with 9 % labour was stored with vat_rate NULL and the customer's page, the
// XRechnung and the next reload all billed it at 21 % (review, 2026-09-30).
const upserted: any[] = [];
jest.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: (table: string) => {
      if (table === 'documents') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'doc-1', document_number: 'OF-2026-0001' }], error: null }) }) };
      }
      return {
        upsert: (rows: any[]) => { upserted.push(...rows); return { select: async () => ({ data: rows, error: null }) }; },
      };
    },
  },
}));

import { healOrphanLineItems } from '../dataProvider';

it('keeps each line\'s own rate, and stamps the effective rate where a line has none', async () => {
  const healed = await healOrphanLineItems({
    'OF-2026-0001': [
      { description: 'Arbeid', quantity: 4, unitPrice: 55, vatRate: 9 },
      { description: 'Materiaal', quantity: 1, unitPrice: 120 },
    ],
  }, 21);
  expect(healed).toBe(1);
  expect(upserted.map((r) => r.vat_rate)).toEqual([9, 21]);
  expect(upserted.every((r) => r.document_id === 'doc-1')).toBe(true);
});

it('a line with no rate stays NULL while the country is unknown — never a frozen 0 %', async () => {
  upserted.length = 0;
  await healOrphanLineItems({ 'OF-2026-0001': [{ description: 'Materiaal', quantity: 1, unitPrice: 120 }] }, null);
  expect(upserted.map((r) => r.vat_rate)).toEqual([null]);
});

describe('what the refresh passes as the fallback (review 2026-09-30)', () => {
  const { storedLineVatRate } = require('../../domain/business');

  it('0 only for a real exemption, the country rate when known, else null', () => {
    expect(storedLineVatRate({ country: 'DE', vatScheme: 'small_business_DE_kleinunternehmer' })).toBe(0);
    expect(storedLineVatRate({ country: 'NL', vatScheme: 'small_business_NL_KOR' })).toBe(0);
    expect(storedLineVatRate({ country: 'NL' })).toBe(21);
    expect(storedLineVatRate({ country: 'DE' })).toBe(19);
    expect(storedLineVatRate({})).toBeNull();
    expect(storedLineVatRate(undefined)).toBeNull();
  });

  it('AppState heals with storedLineVatRate(bp), not getEffectiveVatRate', () => {
    const fs = require('fs');
    const path = require('path');
    const { stripComments } = require('../../utils/stripComments');
    const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../state/AppState.tsx'), 'utf8'));
    expect(src).toMatch(/healOrphanLineItems\(orphans, storedLineVatRate\(bp\)\)/);
  });
});
