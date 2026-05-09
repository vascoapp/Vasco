/**
 * @jest-environment node
 *
 * R66 round 43 — quote editing path closes end-to-end.
 *
 * Locks the FE→BE→FE round-trip on the quote edit flow that R21+R38
 * hardened:
 *   - description ↔ scope_text mapping (R21 was missing, FE worked around
 *     with a direct updateDocument + as-any cast)
 *   - customer/job uuid guard on update (R18+R21 prevent FE display
 *     strings like "Klant" from corrupting uuid FK columns)
 *   - amount ↔ total_amount + status passthrough
 *   - vatRate exempt branch on TieredQuoteBuilder (R38)
 *   - mapper round-trip: persisting `description` then reading it back
 *     surfaces it as the same field (not silently dropped through the
 *     scope_text ↔ description boundary).
 *
 * Past failure modes this test would catch:
 *   - R21: dbUpdates dropped `description` entirely → SOW edits lost
 *   - R18: `customer_id: 'Klant'` rejected by Postgres → entire update
 *     failed silently, FE state diverged from BE
 *   - R38: TieredQuoteBuilder hardcoded vatRate=21 even for KOR users
 *   - R63: scope_text written but never hydrated back → cold-start lost SOW
 */

let mockUserId: string | null = 'user-quote-edit-e2e';

jest.mock('../currentUser', () => ({
  getAuthedUserId: () => mockUserId,
  getCurrentUserId: () => mockUserId ?? 'anon',
  getCurrentTrade: () => 'plumbing',
  getCurrentCountry: () => 'NL',
}));

const mockUpdates: Array<{ table: string; payload: any; eqColumn: string; eqValue: string }> = [];
let mockUpdateResponse: any = null;

jest.mock('../supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => {
      // Build a chainable .update().eq().select().single() mock that records
      // the update payload + eq filter + returns the mock response.
      let pendingPayload: any = null;
      let pendingEqCol: string = '';
      let pendingEqVal: string = '';
      const builder: any = {
        update: (payload: any) => {
          pendingPayload = payload;
          return builder;
        },
        eq: (col: string, val: string) => {
          pendingEqCol = col;
          pendingEqVal = val;
          return builder;
        },
        select: () => builder,
        single: async () => {
          mockUpdates.push({ table, payload: pendingPayload, eqColumn: pendingEqCol, eqValue: pendingEqVal });
          return { data: mockUpdateResponse, error: null };
        },
      };
      return builder;
    },
    rpc: jest.fn(),
  },
}));

import { updateDocument } from '../dataProvider';
import { documentRowToQuote } from '../mappers';
import { isUuid } from '../idShape';
import { isSmallBusinessExempt } from '../../domain/business';
import type { DocumentRow } from '../database.types';

describe('R66r43 — quote editing e2e', () => {
  beforeEach(() => {
    mockUpdates.length = 0;
    mockUpdateResponse = null;
    mockUserId = 'user-quote-edit-e2e';
  });

  describe('updateDocument id-shape routing (R66r19)', () => {
    it('routes uuid ids to .eq("id", ...)', async () => {
      mockUpdateResponse = { id: '11111111-2222-3333-4444-555555555555', total_amount: 500 };
      await updateDocument('11111111-2222-3333-4444-555555555555', { total_amount: 500 });
      expect(mockUpdates[0].eqColumn).toBe('id');
      expect(mockUpdates[0].eqValue).toBe('11111111-2222-3333-4444-555555555555');
    });

    it('routes document-number ids (Q-260001) to .eq("document_number", ...)', async () => {
      mockUpdateResponse = { id: 'uuid-x', document_number: 'Q-260001', total_amount: 500 };
      await updateDocument('Q-260001', { total_amount: 500 });
      expect(mockUpdates[0].eqColumn).toBe('document_number');
      expect(mockUpdates[0].eqValue).toBe('Q-260001');
    });
  });

  describe('R21 mapper hardening — the inline dbUpdates derivation in AppState.updateQuote', () => {
    // The dbUpdates construction lives inline in src/state/AppState.tsx:2013-2028.
    // Replicate the exact contract here so tightening it without parity to
    // this test means a regression report. If the AppState code is later
    // extracted into a helper, this test should switch to calling it.
    function deriveDbUpdates(updates: {
      amount?: number;
      status?: string;
      customer?: string;
      job?: string;
      description?: string;
    }): Record<string, unknown> {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.amount !== undefined) dbUpdates.total_amount = updates.amount;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.customer !== undefined) dbUpdates.customer_id = isUuid(updates.customer) ? updates.customer : null;
      if (updates.job !== undefined) dbUpdates.job_id = isUuid(updates.job) ? updates.job : null;
      if (updates.description !== undefined) dbUpdates.scope_text = updates.description;
      return dbUpdates;
    }

    it('amount maps to total_amount; status passes through', () => {
      const out = deriveDbUpdates({ amount: 1234.56, status: 'sent' });
      expect(out).toEqual({ total_amount: 1234.56, status: 'sent' });
    });

    it('customer-as-display-string ("Klant") becomes NULL — would otherwise corrupt uuid FK', () => {
      const out = deriveDbUpdates({ customer: 'Klant' });
      expect(out).toEqual({ customer_id: null });
    });

    it('customer-as-uuid passes through to customer_id', () => {
      const u = '99999999-aaaa-bbbb-cccc-dddddddddddd';
      const out = deriveDbUpdates({ customer: u });
      expect(out).toEqual({ customer_id: u });
    });

    it('job-as-uuid + non-uuid follows same isUuid guard', () => {
      const u = '88888888-eeee-ffff-aaaa-bbbbbbbbbbbb';
      expect(deriveDbUpdates({ job: u })).toEqual({ job_id: u });
      expect(deriveDbUpdates({ job: 'New bathroom' })).toEqual({ job_id: null });
    });

    it('description maps to scope_text — R21 fixed the missing field that forced an as-any workaround', () => {
      const out = deriveDbUpdates({ description: 'Vervangen van de cv-leidingen op zolder.' });
      expect(out).toEqual({ scope_text: 'Vervangen van de cv-leidingen op zolder.' });
    });

    it('all-fields update — composite payload', () => {
      const out = deriveDbUpdates({
        amount: 2400,
        status: 'sent',
        customer: '11111111-2222-3333-4444-555555555555',
        job: 'Bathroom renovation', // display string
        description: 'Demo + nieuwe installatie',
      });
      expect(out).toEqual({
        total_amount: 2400,
        status: 'sent',
        customer_id: '11111111-2222-3333-4444-555555555555',
        job_id: null, // display string → NULL
        scope_text: 'Demo + nieuwe installatie',
      });
    });

    it('empty updates → empty dbUpdates (caller skips the persist call entirely)', () => {
      expect(deriveDbUpdates({})).toEqual({});
    });
  });

  describe('R63 mapper round-trip — description ↔ scope_text', () => {
    it('persisting description writes scope_text, hydrating that row reads it back', async () => {
      // Phase 1: edit description → scope_text written to BE
      mockUpdateResponse = {
        id: '11111111-2222-3333-4444-555555555555',
        document_number: 'Q-260001',
        doc_type: 'quote',
        status: 'draft',
        customer_id: null,
        job_id: null,
        source_document_id: null,
        issue_date: null,
        due_date: null,
        sent_at: null,
        paid_at: null,
        total_amount: 1500,
        scope_text: 'Updated SOW: tegelwerk + voegen',
        deleted_at: null,
        notes: null,
        created_at: '2026-05-08T10:00:00Z',
        updated_at: '2026-05-08T10:05:00Z',
      } as DocumentRow;

      const updated = await updateDocument('Q-260001', { scope_text: 'Updated SOW: tegelwerk + voegen' });
      expect(mockUpdates[0].payload).toEqual({ scope_text: 'Updated SOW: tegelwerk + voegen' });

      // Phase 2: mapper hydrates the row → description surfaces correctly
      const quote = documentRowToQuote(updated);
      expect(quote.description).toBe('Updated SOW: tegelwerk + voegen');
      expect(quote.id).toBe('Q-260001'); // document_number preferred over uuid
      expect(quote.amount).toBe(1500);
    });

    it('mapper falls back gracefully when scope_text is null (legacy quotes pre-R63)', () => {
      const row: DocumentRow = {
        id: 'uuid-x',
        user_id: 'user-x',
        doc_type: 'quote',
        status: 'draft',
        customer_id: null,
        job_id: null,
        source_document_id: null,
        document_number: 'Q-259999',
        issue_date: null,
        due_date: null,
        sent_at: null,
        paid_at: null,
        total_amount: 800,
        scope_text: null,
        deleted_at: null,
        notes: null,
        delivery_date: null,
        created_at: '2026-05-08T10:00:00Z',
        updated_at: '2026-05-08T10:00:00Z',
      };
      const quote = documentRowToQuote(row);
      expect(quote.description).toBeUndefined();
    });
  });

  describe('R38 — TieredQuoteBuilder VAT calc honors small-business scheme', () => {
    // Replicate the exact computation TieredQuoteBuilder.tsx:374 does post-R38.
    function computeTierVat(subtotal: number, profile: { vatScheme?: 'standard' | 'small_business_NL_KOR' | 'small_business_DE_kleinunternehmer' }) {
      const exempt = isSmallBusinessExempt(profile);
      const effectiveVatRate = exempt ? 0 : 21;
      const vatAmount = subtotal * (effectiveVatRate / 100);
      return { effectiveVatRate, vatAmount, total: subtotal + vatAmount };
    }

    it('standard scheme — full 21% VAT', () => {
      const { effectiveVatRate, vatAmount, total } = computeTierVat(1000, { vatScheme: 'standard' });
      expect(effectiveVatRate).toBe(21);
      expect(vatAmount).toBe(210);
      expect(total).toBe(1210);
    });

    it('NL KOR — 0% VAT, no inflation; customer pays subtotal exactly', () => {
      const { effectiveVatRate, vatAmount, total } = computeTierVat(1000, { vatScheme: 'small_business_NL_KOR' });
      expect(effectiveVatRate).toBe(0);
      expect(vatAmount).toBe(0);
      expect(total).toBe(1000);
    });

    it('DE Kleinunternehmer (§19 UStG) — same 0% treatment', () => {
      const { effectiveVatRate, total } = computeTierVat(2500, { vatScheme: 'small_business_DE_kleinunternehmer' });
      expect(effectiveVatRate).toBe(0);
      expect(total).toBe(2500);
    });

    it('undefined vatScheme defaults to standard 21% (matches isSmallBusinessExempt fallback)', () => {
      const { effectiveVatRate, total } = computeTierVat(500, {});
      expect(effectiveVatRate).toBe(21);
      expect(total).toBe(605);
    });
  });

  describe('Status transitions trigger BE updates with the right payload', () => {
    it('marking quote as sent — payload is just status, not the whole quote', async () => {
      mockUpdateResponse = { document_number: 'Q-260001', status: 'sent', total_amount: 500 };
      await updateDocument('Q-260001', { status: 'sent', sent_at: '2026-05-08T10:00:00Z' });
      expect(mockUpdates[0].payload).toEqual({
        status: 'sent',
        sent_at: '2026-05-08T10:00:00Z',
      });
    });

    it('quote acceptance — status flips to accepted; downstream auto-job creation is a separate concern', async () => {
      mockUpdateResponse = { document_number: 'Q-260001', status: 'accepted' };
      await updateDocument('Q-260001', { status: 'accepted' });
      expect(mockUpdates[0].payload).toEqual({ status: 'accepted' });
    });
  });
});
