/**
 * A new maintenance contract with no customers asks for the customer FIRST.
 *
 * TestFlight, 2026-09-22: "Nieuw onderhoud" let a first-time contractor fill
 * in the form, then answered the customer picker with "Voeg eerst een klant
 * toe…" and only Annuleren. The add-customer sheet now opens on arrival.
 *
 * Meaningful only with zero customers, so it asserts in `walk:fresh` and
 * `walk:prod` and checks the ordinary picker in `walk` (seeded customers).
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal } from 'react-native';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Recurring = () => require('../app/contractor/recurring/[id]').default;

describe('new maintenance contract', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('opens the add-customer sheet when there are no customers, the picker otherwise', async () => {
    const r = await walkScreen(Recurring(), { settlePasses: 10, params: { id: 'new' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const newCustomer = (nl as any).dk.actions.newCustomer.toUpperCase();
    const sheetOpen = root.findAll((n: any) => n.type === Modal && n.props.visible === true
      && n.findAll((c: any) => c.props?.children === newCustomer, { deep: true }).length > 0, { deep: true }).length > 0;
    const picker = root.findAll((n: any) => n.props?.testID === 'recurring-customer-select', { deep: true }).length > 0;
    // walk:prod is a signed-in account on an EMPTY backend — day one, too.
    if (process.env.WALK_POSTURE === 'fresh' || process.env.WALK_REAL_AUTH === '1') {
      expect(sheetOpen).toBe(true);
      expect(picker).toBe(false);
    } else {
      expect(sheetOpen).toBe(false);
      expect(picker).toBe(true);
    }
    teardown(r);
  });
});
