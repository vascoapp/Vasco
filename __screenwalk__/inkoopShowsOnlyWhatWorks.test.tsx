/**
 * Inkoop offers only what writes real rows (rebuilt 2026-09-22).
 *
 * The old hub's Herbestellen / Leveranciers / Voorraad / "Stockouts voorkomen"
 * / "Bespaard op inkoop" were fed by an inventory only a test seed ever
 * filled, and "Zoek materiaal" searched hardcoded prices. The rebuilt screen
 * reads supplier invoices and offers DATANORM as price intelligence; the photo
 * route appears only when the server can run Claude Vision.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Inkoop = () => require('../app/contractor/inkoop').default;

describe('Inkoop', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('offers the e-invoice and DATANORM routes, no photo route without vision, none of the dead tiles', async () => {
    const r = await walkScreen(Inkoop(), { settlePasses: 8 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const byTestId = (id: string) => root.findAll((n: any) => n.props?.testID === id, { deep: true }).length > 0;
    const nodes: string[] = root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children);
    const texts = nodes.join(' | ');
    const k = (nl as any).inkoop;

    expect(byTestId('inkoop-einvoice')).toBe(true);
    expect(byTestId('inkoop-datanorm')).toBe(true);
    expect(texts).toContain(k.readInvoiceTitle);
    expect(texts).toContain(k.priceWatchTitle);

    // No key in this build and no server to ask → no photo route.
    expect(byTestId('inkoop-photo')).toBe(false);

    for (const dead of [k.reorder, k.suppliers, k.searchMaterial, k.noStockTracked, k.noReorders]) {
      // Whole text nodes: "Leveranciers" is a prefix of "Leveranciersfactuur".
      if (dead) expect(nodes.map((x) => x.toLowerCase())).not.toContain(String(dead).toLowerCase());
    }
    teardown(r);
  });
});
