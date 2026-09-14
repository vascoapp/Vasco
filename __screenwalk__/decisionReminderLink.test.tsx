/**
 * A decision reminder links the customer to THEIR portal.
 *
 * The Klanten tab's "Remind" shared the same text to every customer, ending in
 * the bare `https://admin.vascobuild.com/customer` — a path with no page; only
 * `/customer/[code]` exists. A customer who tapped it got a 404, and nothing in
 * the message said which project it was about. The reminder now carries the
 * tracker's own access code.
 *
 * ONE test per file — the harness keeps a module-scoped AppState (see
 * flowTemplateApply.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const Bedrijf = () => require('../app/(contractor)/bedrijf').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('decision reminder link', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('shares the tracker\'s own portal link', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_decision_trackers', JSON.stringify([
      { id: 't1', customerName: 'Familie de Vries', templateName: 'Badkamer', totalDecisions: 5, decidedCount: 2, overdueCount: 1, accessCode: 'VDB24A' },
    ]));

    const r = await walkScreen(Bedrijf(), { settlePasses: 14 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;

    const decisionsTab = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && /^BESLISSINGEN$/.test(c.props.children), { deep: true }).length > 0,
      { deep: true },
    );
    expect(decisionsTab.length).toBeGreaterThan(0);
    await act(async () => { decisionsTab[decisionsTab.length - 1].props.onPress(); });

    const remind = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && typeof n.props?.accessibilityLabel === 'string'
        && /Familie de Vries/.test(n.props.accessibilityLabel)
        && /herinnering/i.test(n.props.accessibilityLabel),
      { deep: true },
    );
    expect(remind.length).toBeGreaterThan(0);

    (Share.share as jest.Mock).mockClear();
    await act(async () => { await remind[remind.length - 1].props.onPress(); });
    expect(Share.share).toHaveBeenCalledTimes(1);
    const message = (Share.share as jest.Mock).mock.calls[0][0].message as string;
    expect(message).toContain('https://admin.vascobuild.com/customer/VDB24A');
    teardown(r);
  });
});
