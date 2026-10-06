/**
 * Opened before its lines and the profile have loaded, the invoice screen ends
 * on the STORED lines and the invoice's own total — never a line made from the
 * gross at rate 0 with VAT added on top.
 *
 * German walk, 2026-10-06 (cold start via deep link): "Erbrachte Leistungen
 * 1 × € 225,51 · MwSt. (19 %) € 42,85 · Gesamt € 268,36" for INV0001
 * (€ 225,51: Heizungswartung 189,50 + 19 %). The lines were built once at mount.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async (n = 14) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

/** Park the cache read of these keys until `open()`. */
function gateCacheReads(keys: string[]) {
  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  const mockGet = AsyncStorage.getItem as unknown as jest.Mock;
  const realGet = mockGet.getMockImplementation()!;
  mockGet.mockImplementation(async (k: string) => { if (keys.includes(k)) await gate; return realGet(k); });
  return { open, restore: () => mockGet.mockImplementation(realGet) };
}

const texts = (root: any): string => root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true })
  .map((n: any) => n.props.children).join(' | ');

run('an invoice opened before its lines and profile load', () => {
  it('ends on the stored line and the invoice total', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-b', name: 'Bäckerei Schmitz GmbH', email: 'b@example.de' }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'INV0001', customerId: 'c-b', customer: 'Bäckerei Schmitz GmbH', job: 'Heizungswartung', amount: 225.51, status: 'draft', dueInDays: 14 },
    ]));
    await AsyncStorage.setItem('@vasco_line_items', JSON.stringify({
      INV0001: [{ id: 'l1', description: 'Heizungswartung', quantity: 1, unitPrice: 189.5, vatRate: 19 }],
    }));
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ businessName: 'Sanitär Weber', country: 'DE' }));
    const gate = gateCacheReads(['@vasco_line_items', '@vasco_business_profile']);

    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'INV0001' }, language: 'de' });
    expect(r.error).toBeNull();
    await act(async () => { gate.open(); });
    await settle(20);
    gate.restore();

    const shown = texts((r.tree as any).root);
    expect(shown).toMatch(/Heizungswartung/);
    expect(shown).not.toMatch(/268,36/);
    expect(shown).toMatch(/225,51/);
    teardown(r);
  });
});
