/**
 * Materialen zoeken says what its numbers are (user's call 2026-09-28:
 * "keep, but make it honest").
 *
 * It claimed "Beste leveranciers in jouw omgeving" (the app has no location),
 * titled baseline figures "Leveranciersprijzen", showed a cart button that did
 * nothing while empty, and hid trades past the edge of a chip strip.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const MaterialSearch = () => require('../app/contractor/material-search').default;

describe('Materialen zoeken', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('no location claim, no dead cart, every trade in one menu', async () => {
    const r = await walkScreen(MaterialSearch(), { settlePasses: 8 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const texts: string[] = root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
      .map((n: any) => [].concat(n.props.children).join(''));
    const all = texts.join(' | ');
    expect(all).not.toMatch(/omgeving|in your area|in Ihrer Nähe/i);
    expect(all).toContain((nl as any).materialSearch.topSuppliers);
    expect((nl as any).materialSearch.supplierPrices).not.toMatch(/Leveranciersprijzen/);

    // Empty cart → no cart button.
    expect(root.findAll((n: any) => n.props?.testID === 'material-cart')).toHaveLength(0);

    // One menu with every trade; no sideways list of trade chips.
    const menu = root.findAll((n: any) => Array.isArray(n.props?.items) && typeof n.props?.renderAnchor === 'function', { deep: true })[0];
    expect(menu.props.items.map((i: any) => i.key)).toEqual(['all', 'plumbing', 'electrical', 'gas', 'painting', 'carpentry']);
    const sideways = root.findAll((n: any) => n.props?.horizontal === true && Array.isArray(n.props?.data)
      && n.props.data.some((d: any) => d?.key === 'plumbing'), { deep: true });
    expect(sideways).toHaveLength(0);
    teardown(r);
  });
});
