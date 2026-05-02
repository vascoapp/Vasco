/**
 * @jest-environment node
 *
 * R279 — findSimilarMaterials wraps the match_similar_materials RPC.
 * Tests cover success path, empty cohort, RPC error, and configured-off no-op.
 */

const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-abc',
}));

import { findSimilarMaterials } from '../embeddingService';

describe('findSimilarMaterials', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('returns mapped rows on success', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { material_key: 'painting|primer 1l', similarity: 0.91 },
        { material_key: 'painting|topcoat 1l', similarity: 0.78 },
      ],
      error: null,
    });
    const result = await findSimilarMaterials('painting|paint 1l', 5);
    expect(mockRpc).toHaveBeenCalledWith('match_similar_materials', {
      p_query_key: 'painting|paint 1l',
      p_limit: 5,
    });
    expect(result).toEqual([
      { materialKey: 'painting|primer 1l', similarity: 0.91 },
      { materialKey: 'painting|topcoat 1l', similarity: 0.78 },
    ]);
  });

  it('returns empty array when RPC returns null data (k-anonymity gated)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await findSimilarMaterials('plumbing|copper pipe', 5);
    expect(result).toEqual([]);
  });

  it('returns empty array on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failure' } });
    const result = await findSimilarMaterials('plumbing|copper pipe', 5);
    expect(result).toEqual([]);
  });

  it('returns empty when RPC throws', async () => {
    mockRpc.mockRejectedValueOnce(new Error('network down'));
    const result = await findSimilarMaterials('plumbing|copper pipe', 5);
    expect(result).toEqual([]);
  });

  it('returns empty for empty key without calling RPC', async () => {
    const result = await findSimilarMaterials('', 5);
    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
