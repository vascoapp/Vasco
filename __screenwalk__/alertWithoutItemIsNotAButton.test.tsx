/**
 * An alert card is a button only when it opens something (device pass
 * 2026-10-14): a card about a certificate opens it; one with no related item
 * (an audit or a rule change) has no chevron and no button role, so a screen
 * reader does not announce a control that does nothing.
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

jest.mock('../src/services/complianceAgentService', () => ({ scan: async () => ({}) }));
const Certificaten = () => require('../app/(contractor)/certificaten').default;

describe('Certificaten — an alert with nothing behind it', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('is not announced as a button and has no chevron', async () => {
    const r = await walkScreen(Certificaten(), { settlePasses: 10 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    // After mount: signing in (the shipping posture) starts the store clean.
    const { complianceService } = require('../src/services/complianceService');
    const { act } = require('react-test-renderer');
    await act(async () => {
      complianceService.addAlert({
        id: 'audit-1', type: 'audit_due', severity: 'high', title: 'Jaarlijkse audit',
        description: 'Plan de audit', createdAt: new Date(), acknowledged: false,
      });
    });
    const card = root.findAll((n: any) => typeof n.props?.accessibilityLabel === 'string'
      && n.props.accessibilityLabel.startsWith('Jaarlijkse audit') && n.props?.style !== undefined, { deep: true })[0];
    expect(card).toBeDefined();
    expect(card.props.accessibilityRole).toBeUndefined();
    expect(card.findAll((n: any) => n.props?.name === 'chevron-forward', { deep: true })).toHaveLength(0);
    teardown(r);
  });
});
