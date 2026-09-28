/**
 * Besparen: "add your first supplier invoice" is a way there, not a sentence.
 *
 * With no invoices read, the price-intelligence card said "Scan je eerste
 * leveranciersfactuur…" as plain orange text — nothing to tap, and the photo
 * scan it named is dark in production (#364). It now opens Inkoop, where
 * supplier invoices are read (emulator walk 2026-09-28).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Besparen = () => require('../app/(contractor)/besparen').default;

describe('Besparen first-invoice hint', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('opens Inkoop and does not promise a photo scan', async () => {
    const r = await walkScreen(Besparen(), { settlePasses: 8 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const hint = root.findAll((n: any) => n.props?.testID === 'savings-add-first-invoice' && typeof n.props?.onPress === 'function', { deep: true });
    expect(hint.length).toBeGreaterThan(0);

    const texts: string[] = root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
      .map((n: any) => [].concat(n.props.children).join(''));
    expect(texts.some((x) => x.includes((nl as any).savings.addFirstInvoice))).toBe(true);
    expect(texts.some((x) => /^Scan je eerste/.test(x))).toBe(false);

    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();
    await act(async () => { hint[hint.length - 1].props.onPress(); });
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push.mock.calls[0][0]).toBe('/contractor/inkoop');
    teardown(r);
  });
});
