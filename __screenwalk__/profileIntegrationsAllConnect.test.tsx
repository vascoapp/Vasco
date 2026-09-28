/**
 * Profile → Integrations lists only integrations that can be connected.
 *
 * Xero (UK/US) and QuickBooks (US) had no connect flow: a tap only raised a
 * "Coming soon" alert. User's decision (emulator walk 2026-09-28): hide until
 * built — DORMANT_CONTROLS.integrationsWithoutFlow. The walk has no UK/US
 * posture, so the market is set through a mocked AppState.
 */
import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

let mockState: any;
const mockPush = jest.fn();
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', country: mockState.businessProfile.country }, updateUser: jest.fn(), logout: jest.fn() }),
  isDemoMode: false,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: mockPush, replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const Screen = () => require('../app/contractor/profile').default;

async function integrationRows(country: string) {
  mockState = {
    jobs: [], customers: [], invoices: [], moneybirdConnected: false, mollieConnected: false, stripeConnected: false,
    businessProfile: { country, businessName: 'Test Ltd' },
  };
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

describe.each(['UK', 'US', 'NL', 'DE'])('Profile integrations (%s)', (country) => {
  it('every listed integration opens a flow — no "Coming soon"', async () => {
    const tree = await integrationRows(country);
    const texts: string[] = tree.root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children);
    expect(texts).not.toContain('Xero');
    expect(texts).not.toContain('QuickBooks');

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // Press every row that names a known integration.
    const names = ['Stripe', 'Mollie', 'Moneybird'];
    const rows = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && names.includes(c.props.children), { deep: true }).length > 0
      && n.findAll((c: any) => typeof c.props?.onPress === 'function', { deep: true }).length === 1, { deep: true });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) await act(async () => { r.props.onPress(); });
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
    tree.unmount();
  });
});
