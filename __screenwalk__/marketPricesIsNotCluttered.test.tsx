/**
 * Marktprijzen without the contractor's own data shows ONE way forward.
 *
 * It stacked "0 aannemers in jouw regio", "Geen aanbevelingen", "Meer data
 * nodig", "nog te weinig vakmensen…" and "Nog geen marktdata" (user, emulator
 * walk 2026-09-28: "too cluttered"). Now: the cost index (when there is one),
 * the labelled market averages, and a single card to Inkoop.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Market = () => require('../app/contractor/market-prices').default;

describe('Marktprijzen, no own data', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('one card to Inkoop, none of the stacked empty states', async () => {
    const r = await walkScreen(Market(), { settlePasses: 12 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const texts: string[] = root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
      .map((n: any) => [].concat(n.props.children).join(''));
    const m = (nl as any).market;
    for (const gone of [m.noRecommendations, m.noBenchmarks, m.noDataYet]) expect(texts).not.toContain(gone);
    expect(texts.some((x) => /^0 aannemers/.test(x))).toBe(false);
    // At most ONE row of market averages — the contractor's own trade, not
    // six unnamed rows (one per trade).
    expect(texts.filter((x) => x === m.hourlyRate).length).toBeLessThanOrEqual(1);

    const card = root.findAll((n: any) => n.props?.testID === 'market-own-prices' && typeof n.props?.onPress === 'function', { deep: true });
    expect(card.length).toBeGreaterThan(0);
    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();
    await act(async () => { card[card.length - 1].props.onPress(); });
    expect(nav.push).toHaveBeenCalledWith('/contractor/inkoop');
    teardown(r);
  });
});
