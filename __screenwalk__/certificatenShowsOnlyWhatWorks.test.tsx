/**
 * Certificaten offers only what works (emulator walk 2026-09-28).
 *
 * The screen had five controls that only raised a "Coming soon" alert (add
 * certificate ×2, add on the empty list, renew, share) and a KvK "Controleer"
 * with no API behind it. User's decision: hide until built — gated by
 * DORMANT_CONTROLS, not deleted. Also: the tab strip scrolled sideways and hid
 * "Vergunningen", and the screen had no back control.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 * The filled-profile case: certificatenRegistrationsFromProfile.test.tsx.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Certificaten = () => require('../app/(contractor)/certificaten').default;

describe('Certificaten', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('shows no dead control, every tab, a way back, and asks for the missing numbers', async () => {
    // Signed in as the NL demo contractor: an UNKNOWN country shows no NL
    // Registraties block at all (review 2026-09-28).
    const r = await walkScreen(Certificaten(), { settlePasses: 10, as: 'contractor' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    // Host <Text> nodes only — the composite wrapper repeats every string.
    const texts: string[] = root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children);
    const c = (nl as any).compliance;

    // No control that can only say "Coming soon".
    for (const dead of [c.addCertificate, c.add, c.checkKvK, c.share, c.renew, c.renewAction]) {
      expect(texts).not.toContain(dead);
    }
    const alertsComingSoon = root.findAll((n: any) => typeof n.props?.onPress === 'function', { deep: true })
      .filter((n: any) => /comingSoon/.test(String(n.props.onPress)));
    expect(alertsComingSoon).toHaveLength(0);

    // Every tab reachable: none inside a sideways scroller.
    const tabs = root.findAll((n: any) => n.props?.accessibilityRole === 'tab' && typeof n.props?.onPress === 'function', { deep: true });
    const tabLabels = [...new Set(tabs.map((n: any) => n.props.accessibilityLabel))];
    expect(tabLabels).toEqual(expect.arrayContaining([c.tabOverview, c.tabCertificates, c.tabInsurance, c.tabLicenses]));
    for (const tab of tabs) {
      for (let p = tab.parent; p; p = p.parent) expect(p.props?.horizontal).not.toBe(true);
    }

    // A way back.
    expect(root.findAll((n: any) => n.props?.accessibilityLabel === (nl as any).common.back && typeof n.props?.onPress === 'function', { deep: true }).length).toBeGreaterThan(0);

    // Empty demo profile (NL): both numbers asked for, nothing claims "verified" or "Inactief".
    expect(texts.filter((x) => x === c.notEntered)).toHaveLength(2);
    expect(texts).toContain(c.enterNumber);
    expect(texts).not.toContain(c.inactive);
    expect(texts).not.toContain(c.unverified);
    teardown(r);
  });
});
