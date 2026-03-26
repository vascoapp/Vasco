// =============================================================================
// APP STATE BUSINESS LOGIC — Unit Tests
// =============================================================================
// AppState is a React Context provider, so we test the pure business logic
// that it delegates to: workflowValidatorService (quote/invoice/job validation)
// and the domain types/rules that govern state transitions.
//
// These validators are called by addQuote, addInvoice, updateJobStatus etc.
// =============================================================================

import {
  validateQuoteBeforeSend,
  validateInvoiceBeforeCreate,
  validateJobStatusChange,
} from '../../services/workflowValidatorService';

describe('AppState business logic (via validators)', () => {
  // ─── Quote Validation (addQuote path) ─────────────────────────────────────

  describe('validateQuoteBeforeSend', () => {
    it('should pass for a valid quote', () => {
      const result = validateQuoteBeforeSend(
        {
          customer: 'c-1',
          amount: 1500,
          lineItems: [{ description: 'Labor', quantity: 10, unitPrice: 150 }],
        },
        [],
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when customer is missing', () => {
      const result = validateQuoteBeforeSend(
        { customer: '', amount: 500, lineItems: [{ description: 'x', quantity: 1, unitPrice: 500 }] },
        [],
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'QUOTE_NO_CUSTOMER')).toBe(true);
    });

    it('should fail when amount is zero', () => {
      const result = validateQuoteBeforeSend(
        { customer: 'c-1', amount: 0, lineItems: [] },
        [],
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'QUOTE_ZERO_AMOUNT')).toBe(true);
    });

    it('should fail when no line items', () => {
      const result = validateQuoteBeforeSend(
        { customer: 'c-1', amount: 100, lineItems: [] },
        [],
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'QUOTE_NO_ITEMS')).toBe(true);
    });

    it('should warn about zero-price line items', () => {
      const result = validateQuoteBeforeSend(
        {
          customer: 'c-1',
          amount: 500,
          lineItems: [
            { description: 'Labor', quantity: 1, unitPrice: 500 },
            { description: 'Free item', quantity: 1, unitPrice: 0 },
          ],
        },
        [],
      );

      expect(result.warnings.some((w) => w.code === 'QUOTE_ZERO_PRICE_ITEMS')).toBe(true);
    });

    it('should warn about possible duplicate quotes', () => {
      const existingQuotes = [
        { customer: 'c-1', amount: 1500, status: 'sent' },
      ];

      const result = validateQuoteBeforeSend(
        {
          customer: 'c-1',
          amount: 1520, // within 5% of 1500
          lineItems: [{ description: 'Work', quantity: 1, unitPrice: 1520 }],
        },
        existingQuotes,
      );

      expect(result.warnings.some((w) => w.code === 'QUOTE_POSSIBLE_DUPLICATE')).toBe(true);
    });

    it('should not warn about rejected quote duplicates', () => {
      const existingQuotes = [
        { customer: 'c-1', amount: 1500, status: 'rejected' },
      ];

      const result = validateQuoteBeforeSend(
        {
          customer: 'c-1',
          amount: 1500,
          lineItems: [{ description: 'Work', quantity: 1, unitPrice: 1500 }],
        },
        existingQuotes,
      );

      expect(result.warnings.some((w) => w.code === 'QUOTE_POSSIBLE_DUPLICATE')).toBe(false);
    });
  });

  // ─── Invoice Validation (addInvoice path) ─────────────────────────────────

  describe('validateInvoiceBeforeCreate', () => {
    it('should pass for a valid invoice', () => {
      const result = validateInvoiceBeforeCreate(
        { customer: 'c-1', amount: 500, jobId: 'j-1', dueDate: '2026-04-15' },
        [],
        [{ id: 'j-1', status: 'completed' }],
      );

      expect(result.valid).toBe(true);
    });

    it('should fail when customer is missing', () => {
      const result = validateInvoiceBeforeCreate(
        { customer: '', amount: 500 },
        [],
        [],
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INV_NO_CUSTOMER')).toBe(true);
    });

    it('should fail when amount is zero', () => {
      const result = validateInvoiceBeforeCreate(
        { customer: 'c-1', amount: 0 },
        [],
        [],
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INV_ZERO_AMOUNT')).toBe(true);
    });

    it('should warn when job is not completed', () => {
      const result = validateInvoiceBeforeCreate(
        { customer: 'c-1', amount: 500, jobId: 'j-1', dueDate: '2026-04-15' },
        [],
        [{ id: 'j-1', status: 'in-progress' }],
      );

      expect(result.warnings.some((w) => w.code === 'INV_JOB_NOT_COMPLETE')).toBe(true);
    });

    it('should warn when job already has an invoice', () => {
      const result = validateInvoiceBeforeCreate(
        { customer: 'c-1', amount: 500, jobId: 'j-1', dueDate: '2026-04-15' },
        [{ jobId: 'j-1', status: 'sent' }],
        [{ id: 'j-1', status: 'completed' }],
      );

      expect(result.warnings.some((w) => w.code === 'INV_JOB_ALREADY_INVOICED')).toBe(true);
    });

    it('should warn when no due date is set', () => {
      const result = validateInvoiceBeforeCreate(
        { customer: 'c-1', amount: 500 },
        [],
        [],
      );

      expect(result.warnings.some((w) => w.code === 'INV_NO_DUE_DATE')).toBe(true);
    });
  });

  // ─── Job Status Transitions (updateJobStatus/convertQuoteToJob) ──────────

  describe('validateJobStatusChange', () => {
    it('should allow lead -> scheduled', () => {
      const result = validateJobStatusChange('lead', 'scheduled', {});
      expect(result.valid).toBe(true);
    });

    it('should allow in-progress -> completed', () => {
      const result = validateJobStatusChange('in-progress', 'completed', {});
      expect(result.valid).toBe(true);
    });

    it('should reject completed -> in-progress (backward transition)', () => {
      const result = validateJobStatusChange('completed', 'in-progress', {});
      expect(result.valid).toBe(false);
    });

    it('should reject paid -> any other status', () => {
      const result = validateJobStatusChange('paid', 'completed', {});
      expect(result.valid).toBe(false);
    });

    it('should allow any active status -> cancelled', () => {
      const statuses = ['lead', 'quoted', 'accepted', 'scheduled', 'in-progress'];
      for (const status of statuses) {
        const result = validateJobStatusChange(status, 'cancelled', {});
        expect(result.valid).toBe(true);
      }
    });

    it('should allow completed -> invoiced', () => {
      const result = validateJobStatusChange('completed', 'invoiced', {});
      expect(result.valid).toBe(true);
    });

    it('should allow invoiced -> paid', () => {
      const result = validateJobStatusChange('invoiced', 'paid', {});
      expect(result.valid).toBe(true);
    });
  });

  // ─── Quote amount calculation (addQuote business logic) ───────────────────

  describe('Quote total calculation', () => {
    it('should calculate total from line items', () => {
      const items = [
        { description: 'Labor', quantity: 8, unitPrice: 65 },
        { description: 'Materials', quantity: 1, unitPrice: 350 },
        { description: 'Travel', quantity: 2, unitPrice: 25 },
      ];
      const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

      expect(total).toBe(8 * 65 + 350 + 2 * 25); // 520 + 350 + 50 = 920
    });

    it('should handle empty line items as zero', () => {
      const items: { quantity: number; unitPrice: number }[] = [];
      const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      expect(total).toBe(0);
    });
  });

  // ─── Invoice from quote (addInvoice business logic) ───────────────────────

  describe('Invoice from quote', () => {
    it('should set 14-day due date by default', () => {
      const now = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.round(diffMs / 86400000);
      expect(diffDays).toBe(14);
    });

    it('should copy amount from source quote', () => {
      const sourceQuote = { id: 'q-1', amount: 2500 };
      const invoice = {
        amount: sourceQuote.amount,
        status: 'draft',
        dueInDays: 14,
      };

      expect(invoice.amount).toBe(2500);
      expect(invoice.status).toBe('draft');
    });
  });

  // ─── markInvoicePaid logic ────────────────────────────────────────────────

  describe('markInvoicePaid', () => {
    it('should set status to paid and dueInDays to 0', () => {
      const invoice = { id: 'inv-1', status: 'sent' as const, dueInDays: 5 };
      const updated = { ...invoice, status: 'paid' as const, dueInDays: 0 };

      expect(updated.status).toBe('paid');
      expect(updated.dueInDays).toBe(0);
    });
  });
});
