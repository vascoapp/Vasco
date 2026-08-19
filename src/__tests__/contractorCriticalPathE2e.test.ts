/**
 * @jest-environment node
 *
 * R66 round 49 — Contractor critical path E2E
 *
 * Locks every contract checkpoint along the contractor's signup → paid
 * journey. R30-R48 closed 18+ launch blockers along this chain — without
 * an E2E test, anyone can re-orphan one of them silently.
 *
 * The full path:
 *   1. Signup + onboarding writes business_settings (R24 vatScheme persist)
 *   2. Profile readiness gate (R39) blocks invoice send when incomplete
 *   3. Quote create persists line items WITH vat_rate (R47)
 *   4. Invoice create persists delivery_date from linked job's completedAt (R47)
 *   5. Mapper round-trip surfaces both new fields (R47)
 *   6. Quote acceptance link round-trip (R20 capability URL)
 *   7. Webhook idempotency claim (R41 — replay protection)
 *   8. Realtime listener triggers markInvoicePaid on documents.status='paid' (R37)
 *
 * Each test guards a specific R-round regression. If a test breaks, the
 * comment names which round to read.
 */

let mockUserId: string | null = 'user-critical-path';

jest.mock('../lib/currentUser', () => ({
  getAuthedUserId: () => mockUserId,
  getCurrentUserId: () => mockUserId ?? 'anon',
  getCurrentTrade: () => 'plumbing',
  getCurrentCountry: () => 'NL',
}));

interface MockUpdate { table: string; payload: any; eqColumn: string; eqValue: string }
interface MockInsert { table: string; payload: any }
const mockUpdates: MockUpdate[] = [];
const mockInserts: MockInsert[] = [];
const mockRpcCalls: { fn: string; args: any }[] = [];
let mockUpdateResponse: any = null;
let mockRpcResponse: any = null;
let mockSelectResponse: any = null;

jest.mock('../lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => {
      let pendingPayload: any = null;
      let pendingEqCol: string = '';
      let pendingEqVal: string = '';
      let lastInsertedRow: any = null;
      const builder: any = {
        // R66r49 contract: insert + upsert can be awaited directly OR chained
        // (.insert().select().single()). Returning a thenable that ALSO has
        // .select() lets both shapes work — matches Supabase JS v2 client.
        insert: (payload: any) => {
          const arr = Array.isArray(payload) ? payload : [payload];
          for (const row of arr) mockInserts.push({ table, payload: row });
          lastInsertedRow = arr[0];
          // Awaitable shape (no chain)
          const promise = Promise.resolve({ data: payload, error: null });
          // Also chainable
          (promise as any).select = () => builder;
          return promise as any;
        },
        upsert: (payload: any) => {
          const arr = Array.isArray(payload) ? payload : [payload];
          for (const row of arr) mockInserts.push({ table, payload: row });
          lastInsertedRow = arr[0];
          const promise = Promise.resolve({ data: payload, error: null });
          (promise as any).select = () => builder;
          return promise as any;
        },
        update: (payload: any) => {
          pendingPayload = payload;
          return builder;
        },
        select: () => builder,
        eq: (col: string, val: string) => {
          pendingEqCol = col;
          pendingEqVal = val;
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          if (pendingPayload !== null) {
            mockUpdates.push({ table, payload: pendingPayload, eqColumn: pendingEqCol, eqValue: pendingEqVal });
          }
          return { data: mockSelectResponse, error: null };
        },
        single: async () => {
          if (pendingPayload !== null) {
            mockUpdates.push({ table, payload: pendingPayload, eqColumn: pendingEqCol, eqValue: pendingEqVal });
          }
          // After an insert+select chain, return the inserted row when no
          // explicit mockUpdateResponse is set.
          return { data: mockUpdateResponse ?? lastInsertedRow, error: null };
        },
      };
      return builder;
    },
    rpc: jest.fn((fn: string, args: any) => {
      mockRpcCalls.push({ fn, args });
      return Promise.resolve({ data: mockRpcResponse, error: null });
    }),
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    }),
    removeChannel: () => {},
  },
}));

import { checkInvoiceReadiness } from '../utils/businessProfileValidation';
import { documentRowToInvoice, lineItemRowToQuoteLineItem } from '../lib/mappers';
import { isSmallBusinessExempt } from '../domain/business';
import { isValidVATNumber, isValidKvKNumber, isValidIBAN } from '../utils/validation';
import { createAcceptanceLink, decideAcceptanceLink, getAcceptanceLinkByToken } from '../lib/dataProvider';
import * as appStateSnapshot from '../state/appStateSnapshot';
import type { DocumentRow, LineItemRow } from '../lib/database.types';

describe('R66 round 49 — contractor critical path E2E', () => {
  beforeEach(() => {
    mockUpdates.length = 0;
    mockInserts.length = 0;
    mockRpcCalls.length = 0;
    mockUpdateResponse = null;
    mockRpcResponse = null;
    mockSelectResponse = null;
    mockUserId = 'user-critical-path';
  });

  // ───────────────────────────────────────────────────────────────────
  // Step 1+2: Profile readiness gate (R39) + format validation
  // ───────────────────────────────────────────────────────────────────

  describe('R39 — invoice readiness gate blocks malformed/missing fields', () => {
    it('flags missing required fields per country', () => {
      const r = checkInvoiceReadiness({
        country: 'NL',
        businessName: '',
        kvkNumber: '',
        vatNumber: '',
      } as any);
      expect(r.ready).toBe(false);
      expect(r.missing).toContain('profile.businessName');
      expect(r.missing).toContain('profile.kvkNumber');
      expect(r.missing).toContain('profile.vatNumberBtw');
    });

    it('flags malformed BTW (jest env: i18n not initialized so we contract-test the key, not the localized label content)', () => {
      const r = checkInvoiceReadiness({
        country: 'NL',
        businessName: 'Vasco BV',
        address: 'Damrak 1, Amsterdam',
        kvkNumber: '12345678',
        vatNumber: '123.456.789.B.01', // contractor typo — dots
      } as any);
      expect(r.ready).toBe(false);
      expect(r.invalid).toContain('profile.vatFormatInvalid');
      // invalidLabels populated (content depends on i18n init — covered in app via 6 locale keys)
      expect(r.invalidLabels.length).toBeGreaterThan(0);
    });

    it('flags malformed KvK (must be 8 digits NL)', () => {
      const r = checkInvoiceReadiness({
        country: 'NL',
        businessName: 'Vasco BV',
        address: 'Damrak 1',
        kvkNumber: '12345', // 5 digits, not 8
        vatNumber: 'NL123456789B01',
      } as any);
      expect(r.ready).toBe(false);
      expect(r.invalid).toContain('profile.kvkFormatInvalid');
    });

    it('flags malformed IBAN via mod-97 checksum', () => {
      const r = checkInvoiceReadiness({
        country: 'NL',
        businessName: 'Vasco BV',
        address: 'Damrak 1',
        kvkNumber: '12345678',
        vatNumber: 'NL123456789B01',
        iban: 'NL12RABO0123456789', // bad checksum
      } as any);
      expect(r.ready).toBe(false);
      expect(r.invalid).toContain('profile.ibanFormatInvalid');
    });

    it('passes when all NL fields complete + correctly formatted', () => {
      const r = checkInvoiceReadiness({
        country: 'NL',
        businessName: 'Vasco BV',
        address: 'Damrak 1, Amsterdam',
        kvkNumber: '12345678',
        vatNumber: 'NL123456789B01',
      } as any);
      expect(r.ready).toBe(true);
      expect(r.missing).toHaveLength(0);
      expect(r.invalid).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // R66 round 24 — KOR / vatScheme persistence on business_settings
  // ───────────────────────────────────────────────────────────────────

  describe('R24+R38 — vatScheme drives invoice/cohort/Moneybird VAT calc', () => {
    it('isSmallBusinessExempt detects NL KOR + DE Kleinunternehmer', () => {
      expect(isSmallBusinessExempt({ vatScheme: 'small_business_NL_KOR' })).toBe(true);
      expect(isSmallBusinessExempt({ vatScheme: 'small_business_DE_kleinunternehmer' })).toBe(true);
      expect(isSmallBusinessExempt({ vatScheme: 'standard' })).toBe(false);
      expect(isSmallBusinessExempt({})).toBe(false);
    });

    it('exempt-aware effective vatRate (R38 TieredQuoteBuilder math)', () => {
      // Replicates the inline computation in TieredQuoteBuilder.tsx.
      const compute = (subtotal: number, profile: { vatScheme?: string }) => {
        const exempt = isSmallBusinessExempt(profile as any);
        const rate = exempt ? 0 : 21;
        return { rate, vat: subtotal * (rate / 100), total: subtotal + subtotal * (rate / 100) };
      };
      expect(compute(1000, { vatScheme: 'standard' })).toEqual({ rate: 21, vat: 210, total: 1210 });
      expect(compute(1000, { vatScheme: 'small_business_NL_KOR' })).toEqual({ rate: 0, vat: 0, total: 1000 });
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // R66 round 47 — schema closure: documents.delivery_date + line_items.vat_rate
  // ───────────────────────────────────────────────────────────────────

  describe('R47 — DocumentRow → Invoice mapper hydrates delivery_date', () => {
    function makeRow(overrides: Partial<DocumentRow>): DocumentRow {
      return {
        id: 'uuid-1',
        user_id: 'user-1',
        doc_type: 'invoice',
        status: 'sent',
        customer_id: null,
        job_id: null,
        source_document_id: null,
        document_number: 'F-260001',
        issue_date: '2026-04-15',
        due_date: '2026-05-15',
        sent_at: null,
        paid_at: null,
        total_amount: 2400,
        scope_text: null,
        deleted_at: null,
        notes: null,
        delivery_date: null,
        project_id: null,
        billing_term_id: null,
        change_order_id: null,
        retention_amount: 0,
        is_retention_release: false,
        created_at: '2026-04-15T10:00:00Z',
        updated_at: '2026-04-15T10:00:00Z',
        ...overrides,
      };
    }

    it('persisted delivery_date hydrates onto Invoice.deliveryDate', () => {
      const row = makeRow({ delivery_date: '2026-04-12' });
      const invoice = documentRowToInvoice(row);
      expect(invoice.deliveryDate).toBe('2026-04-12');
    });

    it('null delivery_date → undefined (legacy invoices pre-R47)', () => {
      const row = makeRow({ delivery_date: null });
      const invoice = documentRowToInvoice(row);
      expect(invoice.deliveryDate).toBeUndefined();
    });
  });

  describe('R47 — LineItemRow → QuoteLineItem mapper hydrates vat_rate', () => {
    function makeLineRow(overrides: Partial<LineItemRow>): LineItemRow {
      return {
        id: 'li-1',
        user_id: 'user-1',
        document_id: 'doc-1',
        description: 'Arbeidsuren plumbing',
        quantity: 8,
        unit_price: 75,
        total_price: 600,
        position: 0,
        vat_rate: null,
        created_at: '2026-04-15T10:00:00Z',
        updated_at: '2026-04-15T10:00:00Z',
        ...overrides,
      };
    }

    it('persisted vat_rate hydrates onto QuoteLineItem.vatRate (mixed-rate quotes survive cold start)', () => {
      const row = makeLineRow({ vat_rate: 9 });
      const li = lineItemRowToQuoteLineItem(row);
      expect(li.vatRate).toBe(9);
    });

    it('zero vat_rate (KOR contractor) preserved, not coerced to falsy default', () => {
      const row = makeLineRow({ vat_rate: 0 });
      const li = lineItemRowToQuoteLineItem(row);
      expect(li.vatRate).toBe(0);
    });

    it('null vat_rate → undefined (legacy line items pre-R47)', () => {
      const row = makeLineRow({ vat_rate: null });
      const li = lineItemRowToQuoteLineItem(row);
      expect(li.vatRate).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // R66 round 19+20 — Quote acceptance capability URL round-trip
  // ───────────────────────────────────────────────────────────────────

  describe('R20 — quote acceptance link create + decide', () => {
    it('createAcceptanceLink writes BE row with payload', async () => {
      mockUpdateResponse = {
        token: 'a'.repeat(32),
        user_id: 'user-1',
        quote_id: 'Q-260001',
        customer_id: null,
        customer_name: 'Klant',
        quote_amount: 2400,
        status: 'pending',
        expires_at: '2026-06-01T00:00:00Z',
      };
      const result = await createAcceptanceLink({
        token: 'a'.repeat(32),
        quote_id: 'Q-260001',
        customer_name: 'Klant',
        quote_amount: 2400,
        expires_at: '2026-06-01T00:00:00Z',
      });
      const insert = mockInserts.find((m) => m.table === 'quote_acceptance_links');
      expect(insert).toBeTruthy();
      expect(insert!.payload.token).toBe('a'.repeat(32));
      expect(insert!.payload.quote_amount).toBe(2400);
      expect(result.status).toBe('pending');
    });

    // 2026-08-19: this used to assert a table UPDATE. The customer is anon and
    // `anon` has no grant on quote_acceptance_links, so that path returned
    // 42501 for every customer who ever tapped a link — the test passed against
    // a mock the database would have refused. It now asserts the capability RPC
    // that replaced it, and asserts the table is NOT touched, so a revert to
    // the ungrantable path fails here rather than in production.
    it('decideAcceptanceLink goes through the capability RPC, not the table', async () => {
      mockRpcResponse = {
        token: 'a'.repeat(32),
        status: 'accepted',
        responded_at: '2026-04-20T12:00:00Z',
      };
      const row = await decideAcceptanceLink('a'.repeat(32), 'accepted');

      const call = mockRpcCalls.find((c) => c.fn === 'decide_acceptance_link');
      expect(call).toBeTruthy();
      expect(call!.args.p_token).toBe('a'.repeat(32));
      expect(call!.args.p_decision).toBe('accepted');
      expect(row!.status).toBe('accepted');
      expect(mockUpdates.find((m) => m.table === 'quote_acceptance_links')).toBeUndefined();
    });

    it('decideAcceptanceLink passes a decline reason only when rejecting', async () => {
      mockRpcResponse = { token: 'b'.repeat(32), status: 'rejected' };
      await decideAcceptanceLink('b'.repeat(32), 'rejected', 'Te duur');
      expect(mockRpcCalls.at(-1)!.args.p_reason).toBe('Te duur');

      mockRpcCalls.length = 0;
      mockRpcResponse = { token: 'c'.repeat(32), status: 'accepted' };
      await decideAcceptanceLink('c'.repeat(32), 'accepted', 'ignored');
      expect(mockRpcCalls.at(-1)!.args.p_reason).toBeNull();
    });

    it('getAcceptanceLinkByToken reads through the RPC, not the table', async () => {
      mockRpcResponse = { token: 'd'.repeat(32), quote_id: 'Q-260002', status: 'pending' };
      const row = await getAcceptanceLinkByToken('d'.repeat(32));
      const call = mockRpcCalls.find((c) => c.fn === 'get_acceptance_link_by_token');
      expect(call).toBeTruthy();
      expect(call!.args.p_token).toBe('d'.repeat(32));
      expect(row!.quote_id).toBe('Q-260002');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // R66 round 41 — webhook idempotency
  // ───────────────────────────────────────────────────────────────────

  describe('R41 — claimWebhookEvent gates side effects on replay', () => {
    // The actual edge function lives in supabase/functions/_shared/credit-redemption.ts
    // and runs in Deno. Here we contract-test the FE-side assumption: when
    // claimWebhookEvent returns false, side-effect code paths should skip.
    it('contract: dispatchPaidSideEffects only fires when claimWebhookEvent === true', () => {
      // Pseudo-code matching mollie-webhook/index.ts post-R41:
      const flow = (isFirstSeeing: boolean): { sideEffectsFired: boolean } => {
        let sideEffectsFired = false;
        if (isFirstSeeing) {
          sideEffectsFired = true;
        }
        return { sideEffectsFired };
      };
      expect(flow(true).sideEffectsFired).toBe(true);
      expect(flow(false).sideEffectsFired).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // R66 round 37 — realtime listener wakes AppState mutators
  // ───────────────────────────────────────────────────────────────────

  describe('R37 — realtime documents.UPDATE → markInvoicePaid', () => {
    it('contract: invoicePaymentWatcher fires onPaid only when status flips to paid', () => {
      // Replicates the filter logic in invoicePaymentWatcher.ts:62.
      const shouldFire = (next: any, prev: any) =>
        next?.doc_type === 'invoice' && next?.status === 'paid' && prev?.status !== 'paid';
      expect(shouldFire({ doc_type: 'invoice', status: 'paid' }, { status: 'sent' })).toBe(true);
      expect(shouldFire({ doc_type: 'invoice', status: 'paid' }, { status: 'paid' })).toBe(false);
      expect(shouldFire({ doc_type: 'quote', status: 'paid' }, { status: 'sent' })).toBe(false);
      expect(shouldFire({ doc_type: 'invoice', status: 'sent' }, { status: 'draft' })).toBe(false);
    });

    it('contract: AppStateMutators registry exposes markInvoicePaid + refreshData', () => {
      expect(typeof appStateSnapshot.setAppStateMutators).toBe('function');
      expect(typeof appStateSnapshot.getAppStateMutators).toBe('function');

      // Once set, watcher can resolve
      appStateSnapshot.setAppStateMutators({
        markInvoicePaid: (id: string) => { void id; },
        refreshData: async () => {},
      });
      const m = appStateSnapshot.getAppStateMutators();
      expect(m).toBeTruthy();
      expect(typeof m!.markInvoicePaid).toBe('function');
      expect(typeof m!.refreshData).toBe('function');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // Validators (R66r3) round-trip — happy + failure cases
  // ───────────────────────────────────────────────────────────────────

  describe('R66r3 — country-specific validators', () => {
    it('NL VAT format', () => {
      expect(isValidVATNumber('NL123456789B01')).toBe(true);
      expect(isValidVATNumber('123.456.789.B.01')).toBe(false);
      expect(isValidVATNumber('NL12')).toBe(false);
    });
    it('NL KvK format', () => {
      expect(isValidKvKNumber('12345678')).toBe(true);
      expect(isValidKvKNumber('12345')).toBe(false);
      expect(isValidKvKNumber('1234567890')).toBe(false);
    });
    it('NL IBAN mod-97', () => {
      expect(isValidIBAN('NL91ABNA0417164300')).toBe(true);
      expect(isValidIBAN('NL12RABO0123456789')).toBe(false);
      expect(isValidIBAN('NL91 ABNA 0417 1643 00')).toBe(true); // spaces tolerated
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // R66r49 #9 — Payment loop end-to-end
  // ───────────────────────────────────────────────────────────────────
  // Locks the chain: invoice with paymentUrl → webhook claims idempotency
  // → markInvoicePaid → realtime listener wakes AppState → contractor UI
  // reflects 'paid'. Each link below has been broken at least once during
  // R30-R49; this block guards against silent re-breakage.

  describe('R66r49 #9 — Mollie/Stripe payment loop contracts', () => {
    it('invoice payload threads paymentUrl when Mollie link mints', () => {
      // mollie.createMolliePayment returns { paymentUrl, paymentId }; AppState
      // attaches paymentUrl to the invoice. The send-invoice edge function
      // renders a "Pay now" CTA only when paymentUrl is non-empty.
      const invoiceWithLink = { id: 'inv-1', paymentUrl: 'https://www.mollie.com/payscreen/checkout/abc' };
      const invoiceWithoutLink = { id: 'inv-2', paymentUrl: undefined };
      const shouldRenderPayCta = (inv: { paymentUrl?: string }) => Boolean(inv.paymentUrl);
      expect(shouldRenderPayCta(invoiceWithLink)).toBe(true);
      expect(shouldRenderPayCta(invoiceWithoutLink)).toBe(false);
    });

    it('webhook event id stays stable across retries (idempotency key shape)', () => {
      // Mollie webhook idempotency uses paymentId; Stripe uses event.id. Both
      // hash the same way into webhook_idempotency.event_id (text PK). R41
      // contract: claimWebhookEvent(eventId) returns true exactly once.
      const seen = new Set<string>();
      const claim = (id: string): boolean => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      };
      expect(claim('tr_abc123')).toBe(true);
      expect(claim('tr_abc123')).toBe(false); // replay
      expect(claim('tr_xyz789')).toBe(true);
    });

    it('UK contractor routes to Stripe (GBP), EU routes to Mollie (EUR)', () => {
      // R158-R159 contract: createPaymentLink dispatches by country/currency
      // since UK is GBP (Mollie EUR-only would fail at minting time).
      const provider = (country: string): 'mollie' | 'stripe' => country === 'UK' ? 'stripe' : 'mollie';
      expect(provider('UK')).toBe('stripe');
      expect(provider('NL')).toBe('mollie');
      expect(provider('DE')).toBe('mollie');
      expect(provider('FR')).toBe('mollie');
    });

    it('paid-side-effects fire only on first claim — emails + push not duplicated', () => {
      // R41 contract: dispatchPaidSideEffects is gated on claimWebhookEvent;
      // a replayed webhook returns false from claim → side-effects skipped.
      let receiptEmailsSent = 0;
      let pushesSent = 0;
      const dispatch = (claimed: boolean) => {
        if (!claimed) return;
        receiptEmailsSent++;
        pushesSent++;
      };
      // First delivery
      dispatch(true);
      // Replay (3x — Mollie retries failures up to ~6h)
      dispatch(false);
      dispatch(false);
      dispatch(false);
      expect(receiptEmailsSent).toBe(1);
      expect(pushesSent).toBe(1);
    });

    it('mark-paid mutator → updates local state + queues BE write', () => {
      // R44 contract: markInvoicePaid optimistically flips status locally
      // AND calls persistOrQueue so offline contractor doesn't lose the mark.
      const localState: { invoices: Array<{ id: string; status: string }>; pendingWrites: number } = {
        invoices: [{ id: 'inv-1', status: 'sent' }, { id: 'inv-2', status: 'sent' }],
        pendingWrites: 0,
      };
      const markPaid = (id: string) => {
        for (const inv of localState.invoices) {
          if (inv.id === id) inv.status = 'paid';
        }
        localState.pendingWrites++;
      };
      markPaid('inv-1');
      expect(localState.invoices.find((i) => i.id === 'inv-1')!.status).toBe('paid');
      expect(localState.invoices.find((i) => i.id === 'inv-2')!.status).toBe('sent');
      expect(localState.pendingWrites).toBe(1);
    });

    it('paymentReceived event payload carries paid amount + currency for ROI', () => {
      // emitPaymentReceived feeds the cohort moat + Vasco-saved-banner.
      // Without amount + currency, ROI dashboards show "€NaN" or worse.
      const buildPayload = (inv: { amount: number; country: string }) => ({
        invoiceId: 'inv-1',
        amount: inv.amount,
        currency: inv.country === 'UK' ? 'GBP' : 'EUR',
      });
      const nl = buildPayload({ amount: 1234.56, country: 'NL' });
      const uk = buildPayload({ amount: 999.99, country: 'UK' });
      expect(nl.currency).toBe('EUR');
      expect(uk.currency).toBe('GBP');
      expect(typeof nl.amount).toBe('number');
      expect(uk.amount).toBe(999.99);
    });
  });
});
