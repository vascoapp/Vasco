/**
 * A quote is "sent" because it was shared, not because a button was pressed.
 *
 * The draft quote's "recommended next step" banner marked the quote SENT and
 * announced "Quote sent!", with sharing offered as an optional button inside
 * that alert. So a quote the customer never received sat in the pipeline as
 * sent, and the follow-up counted days from a send that never happened
 * (#197's shape; found walking the core path, #339).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { Share } from 'react-native';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const QuoteScreen = () => require('../app/quotes/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('quote send', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('only marks the quote sent once the share actually happened', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_quotes', JSON.stringify([
      { id: 'Q-T-1', customer: 'c1', job: 'Wartung', amount: 1000, status: 'draft', lastUpdated: 'today' },
    ]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Bäckerei Lindner' }]));

    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction } as never);

    const r = await walkScreen(QuoteScreen(), { settlePasses: 14, params: { id: 'Q-T-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;

    // The banner: the control that carries the "send it now" copy.
    const banner = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function' && n.props?.accessibilityRole === 'button'
        && n.findAll((c: any) => c.props?.name === 'paper-plane', { deep: true }).length > 0,
      { deep: true },
    )[0];
    expect(banner).toBeDefined();

    await act(async () => { await banner.props.onPress(); });
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });

    // Dismissed share sheet → the quote is still a draft.
    const afterDismiss = JSON.parse((await AsyncStorage.getItem('@vasco_quotes')) ?? '[]');
    expect(afterDismiss[0].status).toBe('draft');

    shareSpy.mockRestore();
    teardown(r);
  });
});
