/**
 * @jest-environment node
 */
// A quote created offline is re-sent by `healOrphanLineItems` on the next
// load. The heal dropped every line's rate (its type had none), so an NL quote
// with 9 % labour was stored with vat_rate NULL and the customer's page, the
// XRechnung and the next reload all billed it at 21 % (review, 2026-09-30).
const upserted: any[] = [];
// Lines the "server" already holds per document — the heal must not double them.
const mockExisting: Record<string, number> = {};
const mockUpsertOpts: any[] = [];
jest.mock('../supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
    from: (table: string) => {
      if (table === 'documents') {
        // A quote and an invoice that share a number (#384 open item): the
        // heal must pick the one of the type the device holds.
        return { select: () => ({ in: async () => ({ data: [
          { id: 'doc-1', document_number: 'OF-2026-0001', doc_type: 'quote' },
          { id: 'doc-inv', document_number: 'OF-2026-0001', doc_type: 'invoice' },
        ], error: null }) }) };
      }
      return {
        select: () => ({ eq: (_c: string, id: string) => ({ limit: async () => ({ data: Array.from({ length: mockExisting[id] ?? 0 }, (_, i) => ({ id: `l${i}` })), error: null }) }) }),
        upsert: (rows: any[], opts?: any) => {
          mockUpsertOpts.push(opts);
          upserted.push(...rows);
          for (const r of rows) mockExisting[r.document_id] = (mockExisting[r.document_id] ?? 0) + 1;
          return { select: async () => ({ data: rows, error: null }) };
        },
      };
    },
  },
}));

import { healOrphanLineItems as heal } from '../dataProvider';

// The device holds OF-2026-0001 as a QUOTE unless a test says otherwise.
const QUOTE = { 'OF-2026-0001': 'quote' as const };
const healOrphanLineItems = (o: Parameters<typeof heal>[0], rate: number | null) => heal(o, rate, QUOTE);

beforeEach(() => { upserted.length = 0; for (const k of Object.keys(mockExisting)) delete mockExisting[k]; });

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
    expect(src).toMatch(/healOrphanLineItems\(orphans, storedLineVatRate\(bp\), docTypes\)/);
  });
});

// React may run the updater that triggers the heal twice, and two refreshes
// can overlap: upsertLineItems has no ids, so each extra run inserted a second
// set of lines (review, 2026-09-30).
it('two heals at once write the lines ONCE', async () => {
  const orphan = { 'OF-2026-0001': [{ description: 'Arbeid', quantity: 4, unitPrice: 55, vatRate: 9 }] };
  await Promise.all([healOrphanLineItems(orphan, 21), healOrphanLineItems(orphan, 21)]);
  expect(upserted).toHaveLength(1);
});

// Italy (2026-10-03): the NATURE of a 0 % line is the same class of fact as
// its rate — an offline reverse-charge line healed without it reaches the
// backend as a bare 0 %, and every other device then refuses the FatturaPA.
it('keeps a 0 % line\'s VAT nature, and never puts one on a rated line', async () => {
  upserted.length = 0;
  await healOrphanLineItems({
    'OF-2026-0001': [
      { description: 'Subappalto', quantity: 1, unitPrice: 900, vatRate: 0, vatNature: 'N6.3' },
      { description: 'Noleggio', quantity: 1, unitPrice: 120, vatRate: 22, vatNature: 'N6.3' },
      { description: 'Materiale', quantity: 1, unitPrice: 50 },
    ],
  }, 22);
  expect(upserted.map((r) => [r.vat_rate, r.vat_nature])).toEqual([[0, 'N6.3'], [22, null], [22, null]]);
});

it('a document that already has lines on the server is not written again', async () => {
  mockExisting['doc-1'] = 2;
  const n = await healOrphanLineItems({ 'OF-2026-0001': [{ description: 'Arbeid', quantity: 4, unitPrice: 55 }] }, 21);
  expect(n).toBe(0);
  expect(upserted).toHaveLength(0);
});

// The database's unique (document_id, position) index is the last word: the
// heal inserts with ON CONFLICT DO NOTHING (proven on prod 2026-10-01: two
// heals → one set; a plain duplicate insert → 23505).
it('the heal asks the database to ignore a line already at that position', async () => {
  mockUpsertOpts.length = 0;
  await healOrphanLineItems({ 'OF-2026-0001': [{ description: 'Arbeid', quantity: 4, unitPrice: 55 }] }, 21);
  expect(mockUpsertOpts[0]).toEqual({ onConflict: 'document_id,position', ignoreDuplicates: true });
});

describe('a quote and an invoice with the same number (learnings #384, open item)', () => {
  const orphan = { 'OF-2026-0001': [{ description: 'Arbeid', quantity: 4, unitPrice: 55, vatRate: 9 }] };

  it('the lines go onto the document of the type the device holds — the invoice here', async () => {
    const n = await heal(orphan, 21, { 'OF-2026-0001': 'invoice' });
    expect(n).toBe(1);
    expect(upserted.map((r) => r.document_id)).toEqual(['doc-inv']);
  });

  it('…and onto the quote when it is a quote, never both', async () => {
    await heal(orphan, 21, { 'OF-2026-0001': 'quote' });
    expect(upserted.map((r) => r.document_id)).toEqual(['doc-1']);
  });

  it('a number whose type the device does not know is not healed at all', async () => {
    const n = await heal(orphan, 21, {});
    expect(n).toBe(0);
    expect(upserted).toHaveLength(0);
  });
});
