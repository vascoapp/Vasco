/**
 * FR statutory withdrawal right (Code de la consommation L221-5 / L221-9).
 *
 * The acknowledgement is ENFORCED in `decide_acceptance_link`, not in the UI —
 * verified against the live database: an FR acceptance with
 * `p_withdrawal_ack: false` raises `withdrawal_ack_required`, and with `true`
 * it stamps `withdrawal_ack_at`.
 *
 * What this file pins is the CLIENT half: every caller must actually send the
 * flag. A client that forgets does not fail silently — the RPC raises — but it
 * would break FR acceptance in production, which is worth catching here.
 */
jest.mock('../lib/supabase', () => {
  const rpc = jest.fn(async () => ({ data: null, error: null }));
  return { supabase: { rpc }, isSupabaseConfigured: true };
});

import { supabase } from '../lib/supabase';
import { decideAcceptanceLink } from '../lib/dataProvider';

const rpcMock = () => (supabase.rpc as unknown as jest.Mock);

describe('the withdrawal acknowledgement reaches the RPC', () => {
  beforeEach(() => rpcMock().mockClear());

  it('sends the flag when the customer acknowledged', async () => {
    await decideAcceptanceLink('a'.repeat(32), 'accepted', undefined, true);
    const call = rpcMock().mock.calls.find((c) => c[0] === 'decide_acceptance_link');
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ p_decision: 'accepted', p_withdrawal_ack: true });
  });

  it('defaults to false rather than omitting the argument', async () => {
    await decideAcceptanceLink('a'.repeat(32), 'accepted');
    const call = rpcMock().mock.calls.find((c) => c[0] === 'decide_acceptance_link');
    // Omitting it would let PostgREST fall back to the DEFAULT and mask a
    // caller that never thought about the notice. Send it explicitly.
    expect(call![1]).toHaveProperty('p_withdrawal_ack', false);
  });

  it('still sends it when rejecting — the RPC ignores it there, and declining commits to nothing', async () => {
    await decideAcceptanceLink('a'.repeat(32), 'rejected', 'too expensive');
    const call = rpcMock().mock.calls.find((c) => c[0] === 'decide_acceptance_link');
    expect(call![1]).toMatchObject({ p_decision: 'rejected', p_reason: 'too expensive' });
    expect(call![1]).toHaveProperty('p_withdrawal_ack');
  });
});
