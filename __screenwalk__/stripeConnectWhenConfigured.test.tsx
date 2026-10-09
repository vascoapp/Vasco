/**
 * Once the server has Stripe Connect set up (decision 2a, 2026-10-09), the
 * Stripe screen asks for NO key: one "Connect with Stripe" button that opens
 * Stripe's own consent page; the result is read back from the server. Until
 * then the old form stays (stripeConnectIsPlain.test.tsx) — a UK contractor's
 * only payment provider is Stripe.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import i18n from '../src/i18n/i18n';
import nl from '../src/i18n/locales/nl.json';

let mockState: any;
let mockStatus = { configured: true, connected: false, livemode: false };
const mockOpen = jest.fn();
const mockClearKey = jest.fn(async () => {});
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', country: 'UK' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: (...a: any[]) => mockOpen(...a) }));
jest.mock('../src/services/consentService', () => ({ consentService: { getConsent: async () => true, setConsent: async () => {} } }));
jest.mock('../src/integrations/stripeConnect', () => ({
  getConnectStatus: async () => mockStatus,
  startConnect: async () => 'https://connect.stripe.com/oauth/authorize?state=s',
}));
jest.mock('../src/integrations/stripe', () => ({
  ...jest.requireActual('../src/integrations/stripe'),
  clearStripeConfig: () => mockClearKey(),
}));

const m = (nl as any).stripe;
const Screen = () => require('../app/(modals)/stripe').default;

async function mount() {
  await i18n.changeLanguage('nl');
  mockState = { stripeConnected: false, connectStripe: jest.fn(), disconnectStripe: jest.fn(), businessProfile: { country: 'UK' } };
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  await act(async () => { await new Promise((r) => setImmediate(r)); });
  return tree;
}
const texts = (tree: any) => tree.root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
  .map((n: any) => [].concat(n.props.children).join('')).join(' | ');

beforeEach(() => { mockOpen.mockReset(); mockClearKey.mockClear(); mockStatus = { configured: true, connected: false, livemode: false }; });

it('asks for no key — one button that opens Stripe', async () => {
  const tree = await mount();
  expect(tree.root.findAll((n: any) => n.props?.testID === 'stripe-code')).toHaveLength(0);
  expect(texts(tree)).toContain(m.connectWithStripe);
  expect(texts(tree)).not.toMatch(/sk_live|API/);
  tree.unmount();
});

it('connected = the SERVER says so: the old key is removed from the phone', async () => {
  const tree = await mount();
  mockOpen.mockImplementation(async () => { mockStatus = { configured: true, connected: true, livemode: true }; return { type: 'success', url: 'vasco://stripe-connected?status=connected' }; });
  const btn = tree.root.findAll((n: any) => n.props?.testID === 'stripe-connect-start' && typeof n.props?.onPress === 'function')[0];
  await act(async () => { btn.props.onPress(); await new Promise((r) => setImmediate(r)); });
  expect(mockOpen).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/connect\.stripe\.com\//), 'vasco://stripe-connected');
  expect(mockState.connectStripe).toHaveBeenCalled();
  expect(mockClearKey).toHaveBeenCalled();
  expect(tree.root.findAll((n: any) => n.props?.testID === 'stripe-connect-connected').length).toBeGreaterThan(0);
  tree.unmount();
});

it('a redirect that SAYS connected while the server says not: not connected', async () => {
  const tree = await mount();
  mockOpen.mockResolvedValue({ type: 'success', url: 'vasco://stripe-connected?status=connected' });
  const btn = tree.root.findAll((n: any) => n.props?.testID === 'stripe-connect-start' && typeof n.props?.onPress === 'function')[0];
  await act(async () => { btn.props.onPress(); await new Promise((r) => setImmediate(r)); });
  expect(mockState.connectStripe).not.toHaveBeenCalled();
  expect(mockClearKey).not.toHaveBeenCalled();
  tree.unmount();
});

it('a Stripe account already used by another Vasco account is said plainly', async () => {
  const tree = await mount();
  mockOpen.mockResolvedValue({ type: 'success', url: 'vasco://stripe-connected?status=taken' });
  const btn = tree.root.findAll((n: any) => n.props?.testID === 'stripe-connect-start' && typeof n.props?.onPress === 'function')[0];
  await act(async () => { btn.props.onPress(); await new Promise((r) => setImmediate(r)); });
  expect(texts(tree)).toContain(m.connectTaken);
  tree.unmount();
});

it('a disconnect that did not land is said, not shown as disconnected', async () => {
  mockStatus = { configured: true, connected: true, livemode: true };
  const tree = await mount();
  const { Alert } = require('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t: any, _b: any, buttons: any) => { buttons?.[1]?.onPress?.(); });
  const btn = tree.root.findAll((n: any) => n.props?.accessibilityRole === undefined && typeof n.props?.onPress === 'function'
    && n.findAll((m: any) => m.props?.children === m_disconnect(), { deep: true }).length > 0, { deep: true })[0];
  await act(async () => { btn.props.onPress(); await new Promise((r) => setImmediate(r)); });
  expect(mockState.disconnectStripe).toHaveBeenCalled();
  expect(texts(tree)).toContain(m.disconnectFailed);
  alert.mockRestore();
  tree.unmount();
});
function m_disconnect() { return m.disconnect; }
