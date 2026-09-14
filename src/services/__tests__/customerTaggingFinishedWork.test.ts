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
