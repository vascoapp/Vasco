// =============================================================================
// THE QUOTE → JOB LINK SURVIVES A COLD START
// =============================================================================
// What this product sells that a general tool cannot copy is one capture
// flowing the length of the job: quote → job → photos → completion → invoice →
// filing → the accountant. Every part was built. The edge between the first two
// existed in React state and was dropped at the persist boundary, so the chain
// could not be followed in the data at all — only guessed at by matching names
// and amounts.
//
// These pin the round trip. A green suite that never reloads the row is exactly
// how this class of bug survives (learnings #110: mappers hydrating FROM the DB
// prove the column round-trips, not that anything writes it).
// =============================================================================

import { jobUpdatesToRowPayload, jobRowToJob } from '../mappers';

/** Minimal JobRow — only what jobRowToJob needs to not throw. */
const row = (over: Record<string, unknown> = {}) => ({
  id: 'job-uuid-1',
  user_id: 'u1',
  customer_id: 'cust-1',
  title: 'Badkamer verbouwing',
  description: null,
  status: 'scheduled',
  created_at: '2026-08-06T09:00:00Z',
  updated_at: '2026-08-06T09:00:00Z',
  ...over,
}) as never;

describe('the quote→job edge', () => {
  it('survives the round trip through the row mapper', () => {
    const payload = jobUpdatesToRowPayload({ quoteId: 'Q0042' } as never);
    expect(payload).toEqual({ quote_id: 'Q0042' });
    expect(jobRowToJob(row({ quote_id: 'Q0042' })).quoteId).toBe('Q0042');
  });

  it('is undefined — not null, not empty string — for a directly created job', () => {
    // A job made straight from the Werk tab legitimately has no quote. That
    // must read as "no quote", distinct from "quote unknown"; collapsing the
    // two is what let absent fields masquerade as answers (learnings #109).
    expect(jobRowToJob(row({ quote_id: null })).quoteId).toBeUndefined();
  });
});

describe('trade reaches the job, because downstream filters on it', () => {
  // templatesForJob treats an undefined trade as "this job is trade-agnostic"
  // and returns only untagged forms, so a job with no trade matches nothing a
  // contractor actually wrote. Both creation paths now stamp one.
  it('round-trips', () => {
    expect(jobUpdatesToRowPayload({ trade: 'plumbing' } as never)).toEqual({ trade: 'plumbing' });
    expect(jobRowToJob(row({ trade: 'plumbing' })).trade).toBe('plumbing');
  });

  it('stays undefined when genuinely unknown rather than defaulting in the mapper', () => {
    // The default belongs at the capture sites, where the contractor's own
    // trade is known. A mapper inventing one would make every legacy job claim
    // a trade nobody chose.
    expect(jobRowToJob(row({ trade: null })).trade).toBeUndefined();
  });
});
