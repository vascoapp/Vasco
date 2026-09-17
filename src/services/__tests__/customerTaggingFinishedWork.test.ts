// The customer tag (which picks a reminder's tone) counted only jobs in
// `completed` — invoiced and paid work vanished from it — and matched invoices
// on `invoice.customer === id`, missing every invoice that carries its customer
// only as `customerId` (#214, #334).
import { scoreCustomer } from '../customerTaggingService';

const customer = { id: 'cust-1', name: 'Bäckerei Lindner GmbH' } as any;

describe('scoreCustomer counts finished work and FK-linked invoices', () => {
  it('counts invoiced and paid jobs as completed', () => {
    const p = scoreCustomer({
      customer,
      jobs: [
        { id: 'a', customerId: 'cust-1', status: 'invoiced' },
        { id: 'b', customerId: 'cust-1', status: 'paid' },
        { id: 'c', customerId: 'cust-1', status: 'scheduled' },
      ] as any,
      invoices: [],
    });
    expect(p.jobsCompleted).toBe(2);
  });

  it('reads lifetime value from an invoice linked only by customerId', () => {
    const p = scoreCustomer({
      customer,
      jobs: [],
      invoices: [{ id: 'RE-1', customer: '', customerId: 'cust-1', amount: 5200, status: 'paid', dueInDays: 0 }] as any,
    });
    expect(p.lifetimeValue).toBe(5200);
  });
});

// A customer added a minute ago was badged "Inactive — no activity for 333
// months": with no jobs and no invoices there is no ACTIVITY, and the fallback
// was a hardcoded 9999 days (#339). They are new, not dormant.
describe('a customer with no work yet is new, not inactive', () => {
  const now = new Date('2026-09-17T10:00:00.000Z');

  it('a customer created today is tagged new', () => {
    const p = scoreCustomer({
      customer: { id: 'c-new', name: 'Fam. Bakker', createdAt: '2026-09-17T09:00:00.000Z' } as any,
      jobs: [], invoices: [], now,
    });
    expect(p.tag).toBe('new');
    expect(p.lastActivityDays).toBe(0);
  });

  it('still calls a genuinely dormant customer inactive', () => {
    const p = scoreCustomer({
      customer: { id: 'c-old', name: 'Oude Klant', createdAt: '2022-01-01T00:00:00.000Z' } as any,
      jobs: [{ id: 'j', customerId: 'c-old', status: 'completed', updatedAt: '2023-01-01T00:00:00.000Z' }] as any,
      invoices: [], now,
    });
    expect(p.tag).toBe('inactive');
  });

  it('a customer with no createdAt is not assumed dormant either', () => {
    // Seeded and imported rows can lack it; guessing "333 months" there is the
    // same wrong answer with less excuse.
    const p = scoreCustomer({ customer: { id: 'c-x', name: 'Zonder datum' } as any, jobs: [], invoices: [], now });
    expect(p.tag).toBe('new');
  });

  it('an old customer with no work at all reads as inactive from their own age', () => {
    const p = scoreCustomer({
      customer: { id: 'c-stale', name: 'Lang geleden', createdAt: '2020-01-01T00:00:00.000Z' } as any,
      jobs: [], invoices: [], now,
    });
    expect(p.tag).toBe('inactive');
  });
});

// The tagger's floor is worthless if a REAL customer never carries createdAt:
// the domain type had no such field and the row mapper dropped the column, so
// only these fixtures (cast `as any`) ever had one.
describe('createdAt reaches a real customer', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.resolve(__dirname, '../../..');
  it('the row mapper reads customers.created_at', () => {
    const { customerRowToCustomer } = require('../../lib/mappers');
    const c = customerRowToCustomer({ id: 'x', user_id: 'u', name: 'N', email: null, phone: null, address: null,
      city: null, postcode: null, country: null, province: null, vat_id: null, tax_id: null,
      einvoice_routing: null, einvoice_email: null, created_at: '2025-01-02T00:00:00Z', updated_at: '2025-01-02T00:00:00Z' });
    expect(c.createdAt).toBe('2025-01-02T00:00:00Z');
  });
  it('a customer added in the app is stamped at creation', () => {
    const src = fs.readFileSync(path.join(root, 'src/state/AppState.tsx'), 'utf8');
    expect(src).toMatch(/const newCustomer: Customer = \{[^}]*createdAt: new Date\(\)\.toISOString\(\)/);
  });
});
