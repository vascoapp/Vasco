/**
 * The certificate screen shows "Acties vereist" for an item at risk WITHOUT
 * waiting for the scheduler (device pass 2026-10-14): alerts live in memory
 * and the scheduler scans once per 12-hour block, so after a restart the card
 * was gone while the score still read "Kritiek". The screen asks for a scan.
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Certificaten = () => require('../app/(contractor)/certificaten').default;

describe('Certificaten after a restart', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('raises the alert for a stored certificate on its own', async () => {
    const { complianceService } = require('../src/services/complianceService');
    await complianceService.load();
    complianceService.saveTrackedItem({ type: 'certification', name: 'VCA Basis', expiryDate: new Date(Date.now() + 6 * 86_400_000) });
    // A scan "ran" moments ago in an earlier process: the scheduler would skip.
    await AsyncStorage.setItem('@vasco_compliance_agent_last_run', new Date().toISOString());

    const r = await walkScreen(Certificaten(), { settlePasses: 12, as: 'contractor' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const texts: string[] = root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children);
    expect(texts).toContain((nl as any).compliance.actionsRequired);
    const card = root.findAll((n: any) => n.props?.accessibilityRole === 'button' && typeof n.props?.onPress === 'function'
      && String(n.props?.accessibilityLabel ?? '').includes('VCA Basis'), { deep: true });
    expect(card.length).toBeGreaterThan(0);
    teardown(r);
  });
});
