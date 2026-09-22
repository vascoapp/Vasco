/**
 * With EMBEDDINGS_ENABLED off, nothing calls the embedding functions.
 *
 * Production has no OPENAI_API_KEY / VOYAGE_API_KEY, so `generate-embedding`
 * and `embed-text` answer 503. The quote builder's "Similar past jobs" called
 * one per keystroke: seven 503s in a minute from one first-time contractor
 * typing a scope (edge logs, 2026-09-22 18:06 UTC), each followed by the local
 * keyword search it would have run anyway.
 *
 * Supabase is mocked as CONFIGURED here — the global mock says it is not, and
 * under that every call site returns early for the wrong reason.
 */
const mockInvoke = jest.fn(async () => ({ data: null, error: { message: '503' } }));
const mockRpc = jest.fn(async () => ({ data: [], error: null }));
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    functions: { invoke: (...a: any[]) => (mockInvoke as any)(...a) },
    rpc: (...a: any[]) => (mockRpc as any)(...a),
  },
}));
jest.mock('../lib/currentUser', () => ({
  getAuthedUserId: () => 'user-1',
  getCurrentUserId: () => 'user-1',
  getCurrentCountry: () => 'NL',
}));

import { EMBEDDINGS_ENABLED } from '../config/ai';
import { searchSimilarJobs, searchMaterials } from '../intelligence/semanticSearch';
import {
  embedCustomer, embedMaterial, embedLead, findSimilarLeads, findSimilarWorkers,
  findSimilarCustomersByText, findSimilarMaterials,
} from '../services/embeddingService';

describe('embeddings stay dark without a key', () => {
  beforeEach(() => { mockInvoke.mockClear(); });

  it('the flag is off in this build', () => {
    expect(EMBEDDINGS_ENABLED).toBe(false);
  });

  it('the quote builder search never calls the server', async () => {
    await searchSimilarJobs('Drie kamers stucen', 3);
    await searchMaterials('gipsplaat', 3);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('no embedding writer or reader calls the server', async () => {
    await embedCustomer({ customerId: 'c1', text: 'Familie Jansen Utrecht' }).catch(() => {});
    await embedMaterial({ materialKey: 'gips', text: 'gipsplaat 12,5 mm' } as any).catch(() => {});
    await embedLead({ leadId: 'l1', text: 'badkamer renovatie' } as any).catch(() => {});
    await findSimilarLeads('badkamer', 3);
    await findSimilarWorkers('stukadoor', 3);
    await findSimilarCustomersByText('Jansen', 3);
    await findSimilarMaterials('gips', 3).catch(() => []);
    const called = mockInvoke.mock.calls.map((c: any[]) => c[0]);
    expect(called.filter((n: string) => n === 'generate-embedding' || n === 'embed-text')).toEqual([]);
  });
});
