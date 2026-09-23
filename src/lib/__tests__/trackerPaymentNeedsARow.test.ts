/**
 * @jest-environment node
 *
 * Attaching a deposit link to a decision tracker only reports success when a
 * tracker row actually changed. PostgREST answers an UPDATE that matches
 * nothing with no error, so the old `!error → true` told the contractor the
 * customer's portal now had a Pay button when no row held the link (B1).
 */
let mockResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };

jest.mock('../supabase', () => {
  const q: any = {
    update: jest.fn(() => q),
    eq: jest.fn(() => q),
    select: jest.fn(() => q),
    then: (res: any, rej: any) => Promise.resolve(mockResult).then(res, rej),
  };
  return { supabase: { from: jest.fn(() => q) }, isSupabaseConfigured: true };
});

import { updateTrackerPayment } from '../dataProvider';

describe('updateTrackerPayment', () => {
  it('no tracker matched → false', async () => {
    mockResult = { data: [], error: null };
    expect(await updateTrackerPayment('ABC123', { payment_link: 'https://pay' })).toBe(false);
  });
  it('one tracker updated → true', async () => {
    mockResult = { data: [{ id: 't1' }], error: null };
    expect(await updateTrackerPayment('ABC123', { payment_link: 'https://pay' })).toBe(true);
  });
  it('server error → false', async () => {
    mockResult = { data: null, error: { message: 'rls' } };
    expect(await updateTrackerPayment('ABC123', { payment_link: 'https://pay' })).toBe(false);
  });
});
