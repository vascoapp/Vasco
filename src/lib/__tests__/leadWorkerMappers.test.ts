// R96 — lock the lead + worker row↔domain mappers so the cold-start
// hydration that landed in R96 stays correct. Without round-trip tests,
// a column rename in the DB type would silently drop data on every
// hydrate (the silent-data-loss class of bug that rule #8 exists to
// prevent).

import { leadRowToLead, workerRowToWorker } from '../mappers';
import type { LeadRow, WorkerRow } from '../database.types';

describe('leadRowToLead', () => {
  const baseRow: LeadRow = {
    id: 'lead-uuid-1',
    user_id: 'user-uuid-1',
    status: 'new',
    source: 'manual',
    customer_name: 'Alice',
    customer_phone: null,
    customer_email: null,
    customer_id: null,
    job_description: null,
    estimated_value: null,
    notes: null,
    source_quote_id: null,
    created_at: '2026-05-23T00:00:00Z',
    updated_at: '2026-05-23T00:00:00Z',
    contacted_at: null,
    converted_at: null,
  };

  it('maps required fields 1:1', () => {
    const lead = leadRowToLead(baseRow);
    expect(lead.id).toBe('lead-uuid-1');
    expect(lead.status).toBe('new');
    expect(lead.source).toBe('manual');
    expect(lead.customerName).toBe('Alice');
    expect(lead.createdAt).toBe('2026-05-23T00:00:00Z');
  });

  it('coerces nulls to undefined on optional fields', () => {
    const lead = leadRowToLead(baseRow);
    expect(lead.customerPhone).toBeUndefined();
    expect(lead.customerEmail).toBeUndefined();
    expect(lead.customerId).toBeUndefined();
    expect(lead.jobDescription).toBeUndefined();
    expect(lead.estimatedValue).toBeUndefined();
    expect(lead.notes).toBeUndefined();
    expect(lead.sourceQuoteId).toBeUndefined();
    expect(lead.contactedAt).toBeUndefined();
    expect(lead.convertedAt).toBeUndefined();
  });

  it('preserves all optional fields when present', () => {
    const full: LeadRow = {
      ...baseRow,
      customer_phone: '+1-555-0100',
      customer_email: 'alice@example.com',
      customer_id: 'cust-uuid-1',
      job_description: 'Replace water heater',
      estimated_value: 1280.50,
      notes: 'Called from Angi',
      source_quote_id: 'doc-uuid-1',
      contacted_at: '2026-05-23T01:00:00Z',
      converted_at: '2026-05-23T02:00:00Z',
      status: 'won',
      source: 'angi',
    };
    const lead = leadRowToLead(full);
    expect(lead.customerPhone).toBe('+1-555-0100');
    expect(lead.customerEmail).toBe('alice@example.com');
    expect(lead.customerId).toBe('cust-uuid-1');
    expect(lead.jobDescription).toBe('Replace water heater');
    expect(lead.estimatedValue).toBe(1280.50);
    expect(lead.notes).toBe('Called from Angi');
    expect(lead.sourceQuoteId).toBe('doc-uuid-1');
    expect(lead.contactedAt).toBe('2026-05-23T01:00:00Z');
    expect(lead.convertedAt).toBe('2026-05-23T02:00:00Z');
    expect(lead.status).toBe('won');
    expect(lead.source).toBe('angi');
  });

  it('handles the rejected_estimate source from R81 auto-create path', () => {
    const lead = leadRowToLead({ ...baseRow, source: 'rejected_estimate', status: 'lost' });
    expect(lead.source).toBe('rejected_estimate');
    expect(lead.status).toBe('lost');
  });
});

describe('workerRowToWorker', () => {
  const baseRow: WorkerRow = {
    id: 'worker-uuid-1',
    user_id: 'user-uuid-1',
    name: 'Bob',
    role: 'tech',
    email: null,
    phone: null,
    trade: null,
    hourly_cost: null,
    is_active: true,
    color: null,
    created_at: '2026-05-23T00:00:00Z',
    updated_at: '2026-05-23T00:00:00Z',
  };

  it('maps required fields 1:1', () => {
    const w = workerRowToWorker(baseRow);
    expect(w.id).toBe('worker-uuid-1');
    expect(w.name).toBe('Bob');
    expect(w.role).toBe('tech');
    expect(w.isActive).toBe(true);
    expect(w.createdAt).toBe('2026-05-23T00:00:00Z');
  });

  it('coerces nulls to undefined on optional fields', () => {
    const w = workerRowToWorker(baseRow);
    expect(w.email).toBeUndefined();
    expect(w.phone).toBeUndefined();
    expect(w.trade).toBeUndefined();
    expect(w.hourlyCost).toBeUndefined();
    expect(w.color).toBeUndefined();
  });

  it('preserves all roles', () => {
    const roles: WorkerRow['role'][] = ['owner', 'lead_tech', 'tech', 'apprentice', 'subcontractor'];
    for (const role of roles) {
      expect(workerRowToWorker({ ...baseRow, role }).role).toBe(role);
    }
  });

  it('hourly_cost preserves zero as zero, not undefined', () => {
    // 0 is a meaningful value (volunteer / family member); the `?? undefined`
    // pattern preserves it because 0 is not nullish.
    const w = workerRowToWorker({ ...baseRow, hourly_cost: 0 });
    expect(w.hourlyCost).toBe(0);
  });

  it('inactive workers are still hydrated (history retention)', () => {
    const w = workerRowToWorker({ ...baseRow, is_active: false });
    expect(w.isActive).toBe(false);
  });
});
