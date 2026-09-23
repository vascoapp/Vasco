/**
 * The price watch reads grouped pairs from get_my_price_pairs (review #366):
 * the newest 2,000 raw rows of a large DATANORM list were all one day, so the
 * old read never saw an earlier price. "Materials tracked" is the true total.
 */
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...a: any[]) => mockRpc(...a) },
}));
jest.mock('../../lib/currentUser', () => ({ getAuthedUserId: () => '11111111-1111-1111-1111-111111111111' }));

import { getMyPriceWatch } from '../personalPriceWatch';

describe('price watch over get_my_price_pairs', () => {
  it('reports the rise and the true number of tracked materials', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { supplier_id: 'richter', supplier_name: 'Richter', material_name: 'Kupferrohr 15 mm', unit: 'm',
          previous_price: 12.5, previous_day: '2026-01-10', latest_price: 13.5, latest_day: '2026-09-01', total_pairs: 2100 },
        { supplier_id: 'richter', supplier_name: 'Richter', material_name: 'Fitting', unit: 'stk',
          previous_price: 3, previous_day: '2026-01-10', latest_price: 3, latest_day: '2026-09-01', total_pairs: 2100 },
      ],
      error: null,
    });
    const w = await getMyPriceWatch();
    expect(mockRpc).toHaveBeenCalledWith('get_my_price_pairs', expect.anything());
    expect(w.tracked).toBe(2100);
    expect(w.rises).toHaveLength(1);
    expect(w.rises[0]).toMatchObject({ materialName: 'Kupferrohr 15 mm', previous: 12.5, latest: 13.5, pct: 8 });
  });

  it('shows nothing when the call fails — never a guessed result', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(getMyPriceWatch()).resolves.toEqual({ tracked: 0, rises: [] });
  });
});
