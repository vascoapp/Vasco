/**
 * @jest-environment node
 *
 * R265 — postcode cohort: prefix-length per country + RPC plumbing.
 */

jest.mock('../../lib/supabase', () => {
  const rpcMock = jest.fn();
  return {
    isSupabaseConfigured: true,
    supabase: { rpc: rpcMock, from: jest.fn() },
    __rpcMock: rpcMock,
  };
});

import { getPostcodeCohort } from '../postcodeCohortService';

describe('getPostcodeCohort', () => {
  let rpcMock: jest.Mock;

  beforeEach(() => {
    rpcMock = require('../../lib/supabase').__rpcMock;
    rpcMock.mockReset();
  });

  test('returns null when postcode missing', async () => {
    const r = await getPostcodeCohort('plumbing', 'NL', null);
    expect(r).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test('returns null when prefix < 2 chars after stripping spaces', async () => {
    const r = await getPostcodeCohort('plumbing', 'NL', ' 1 ');
    expect(r).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  test('NL → 4-char prefix', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await getPostcodeCohort('plumbing', 'NL', '1011 AB');
    expect(rpcMock).toHaveBeenCalledWith(
      'get_postcode_cohort_stats',
      expect.objectContaining({ p_postcode_prefix: '1011' }),
    );
  });

  test('DE → 3-char prefix', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await getPostcodeCohort('elektrik', 'DE', '10115');
    expect(rpcMock).toHaveBeenCalledWith(
      'get_postcode_cohort_stats',
      expect.objectContaining({ p_postcode_prefix: '101' }),
    );
  });

  test('UK → 4-char outward code', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await getPostcodeCohort('plumbing', 'UK', 'EC1A 1BB');
    expect(rpcMock).toHaveBeenCalledWith(
      'get_postcode_cohort_stats',
      expect.objectContaining({ p_postcode_prefix: 'EC1A' }),
    );
  });

  test('SE/NO/DK/FI → 4-char prefix (Nordics)', async () => {
    for (const country of ['SE', 'NO', 'DK', 'FI']) {
      rpcMock.mockResolvedValue({ data: [], error: null });
      await getPostcodeCohort('plumbing', country, '12345');
      expect(rpcMock).toHaveBeenLastCalledWith(
        'get_postcode_cohort_stats',
        expect.objectContaining({ p_postcode_prefix: '1234' }),
      );
    }
  });

  test('parses RPC row correctly', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        avg_unit_price: 75.5,
        median_unit_price: 80,
        avg_margin: 0.32,
        acceptance_rate: 0.65,
        sample_size: 42,
        contractor_count: 7,
      }],
      error: null,
    });
    const r = await getPostcodeCohort('plumbing', 'NL', '1011');
    expect(r).toEqual({
      avgUnitPrice: 75.5,
      medianUnitPrice: 80,
      avgMargin: 0.32,
      acceptanceRate: 0.65,
      sampleSize: 42,
      contractorCount: 7,
    });
  });

  test('returns null on RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'fail' } });
    const r = await getPostcodeCohort('plumbing', 'NL', '1011');
    expect(r).toBeNull();
  });
});
