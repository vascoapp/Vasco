/**
 * @jest-environment node
 *
 * CLOSING THE PHOTO→QUOTE LEARNING LOOP
 *
 * Line corrections are captured BEFORE a quote exists — the contractor edits on
 * the photo screen, and the quote is created afterwards. So every delta from
 * that path was written with `quote_id = null`, and a null quote id can never be
 * joined to an outcome.
 *
 * That distinction is the whole game. Without the join the system can only learn
 * IMITATION ("contractors raise this line ~12%"); with it, it can eventually
 * learn whether the raised price still WON. Optimising the first will happily
 * teach a model to price itself out of work.
 */

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: jest.fn() },
}));
jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-1',
  getCurrentTrade: () => 'electrical',
  getCurrentCountry: () => 'NL',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { attachQuoteIdToRecentDeltas } from '../reasonCodeService';

const KEY = '@vasco_quote_line_deltas';

const delta = (over: Record<string, unknown> = {}) => ({
  id: `d-${Math.random().toString(36).slice(2, 8)}`,
  userId: 'user-1',
  lineItemId: 'line-1',
  description: 'YMvK kabel',
  originalQty: 10,
  newQty: 12,
  originalUnitPrice: 3,
  newUnitPrice: 3.4,
  source: 'ai_draft',
  createdAt: new Date().toISOString(),
  ...over,
});

const seed = (rows: unknown[]) => AsyncStorage.setItem(KEY, JSON.stringify(rows));
const read = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');

beforeEach(async () => { await AsyncStorage.removeItem(KEY); });

describe('attachQuoteIdToRecentDeltas', () => {
  it('links this session’s corrections to the quote they produced', async () => {
    await seed([delta(), delta({ lineItemId: 'line-2' })]);
    const n = await attachQuoteIdToRecentDeltas('Q0042');
    expect(n).toBe(2);
    expect((await read()).every((d: { quoteId?: string }) => d.quoteId === 'Q0042')).toBe(true);
  });

  it('leaves deltas that already belong to another quote alone', async () => {
    // A correction can only have produced one quote. Re-attributing it would
    // credit the wrong outcome and corrupt the signal in a way nothing would
    // ever surface.
    await seed([delta({ quoteId: 'Q0001' }), delta({ lineItemId: 'line-2' })]);
    const n = await attachQuoteIdToRecentDeltas('Q0042');
    expect(n).toBe(1);
    const rows = await read();
    expect(rows.find((d: { lineItemId: string }) => d.lineItemId === 'line-1').quoteId).toBe('Q0001');
    expect(rows.find((d: { lineItemId: string }) => d.lineItemId === 'line-2').quoteId).toBe('Q0042');
  });

  it('ignores corrections older than the window', async () => {
    // A contractor who abandons a quote and starts another two hours later must
    // not have the first one's edits attributed to the second.
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    await seed([delta({ createdAt: old })]);
    expect(await attachQuoteIdToRecentDeltas('Q0042')).toBe(0);
    expect((await read())[0].quoteId).toBeUndefined();
  });

  it('is a no-op without a quote id rather than writing a null link', async () => {
    await seed([delta()]);
    expect(await attachQuoteIdToRecentDeltas('')).toBe(0);
  });

  it('does not throw when there is nothing to link', async () => {
    await expect(attachQuoteIdToRecentDeltas('Q0042')).resolves.toBe(0);
  });
});
