/**
 * Sending is a promotion, never a demotion.
 *
 * "Send to customer" stays on the quote screen after the customer has accepted
 * — re-sending the link is legitimate — but `markQuoteSent` set the status
 * unconditionally. So sharing an accepted quote put it back to `sent`: the
 * Accept tile returned (and accepting again creates a SECOND job from one
 * quote) and the follow-up counter restarted. Found reviewing my own fa21d7a,
 * which added the two share→markQuoteSent call sites.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { Share } from 'react-native';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const QuoteScreen = () => require('../app/quotes/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('sharing an accepted quote', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('does not put it back to sent', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_quotes', JSON.stringify([
      { id: 'Q-T-2', customer: 'c1', job: 'Wartung', amount: 1000, status: 'accepted', lastUpdated: 'today' },
    ]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Bäckerei Lindner' }]));

    // The share SUCCEEDS here — that is the case that used to demote it.
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as never);

    const r = await walkScreen(QuoteScreen(), { settlePasses: 14, params: { id: 'Q-T-2' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;

    const tile = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => c.props?.name === 'paper-plane', { deep: true }).length > 0,
      { deep: true },
    )[0];
    expect(tile).toBeDefined();

    await act(async () => { await tile.props.onPress(); });
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });

    const after = JSON.parse((await AsyncStorage.getItem('@vasco_quotes')) ?? '[]');
    expect(after[0].status).toBe('accepted');

    shareSpy.mockRestore();
    teardown(r);
  });
});
