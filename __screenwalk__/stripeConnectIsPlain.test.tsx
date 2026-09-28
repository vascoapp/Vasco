/**
 * Connecting Stripe reads like it is for a builder, and claims no fee.
 *
 * User, emulator walk 2026-09-28: "highly technical for a construction
 * worker". The screen said "API-SLEUTEL · live_xxxx of test_xxxx · Stripe
 * Dashboard → Developers → API keys", and "Vasco rekent 3.5% commissie" — a
 * fee Vasco does not charge (own Stripe account; the tier commission must
 * not ship, memory/payments-monetization-2026-08.md).
 */
import React from 'react';
import { Alert, Linking } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import i18n from '../src/i18n/i18n';
import nl from '../src/i18n/locales/nl.json';

let mockState: any;
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', country: 'NL' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const Screen = () => require('../app/(modals)/stripe').default;
const m = (nl as any).stripe;

async function mount() {
  await i18n.changeLanguage('nl');
  mockState = { stripeConnected: false, connectStripe: jest.fn(), disconnectStripe: jest.fn(), businessProfile: { country: 'NL' } };
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  const texts: string[] = tree.root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
    .map((n: any) => [].concat(n.props.children).join(''));
  return { tree, texts };
}

it('shows three plain steps and no developer jargon or fee', async () => {
  const { tree, texts } = await mount();
  const all = texts.join(' | ');
  expect(all).toContain(m.stepsTitle);
  for (const k of ['step1', 'step2', 'step3']) expect(all).toContain(m[k]);
  expect(all).not.toMatch(/API|Developers|sk_live_xxxx|commissie|[0-9][.,]?[0-9]?\s?%/i);
  const input = tree.root.findAll((n: any) => n.props?.testID === 'stripe-code' && n.props?.placeholder)[0];
  expect(input.props.placeholder).toBe(m.codePlaceholder);
  tree.unmount();
});

it('"Open Stripe" opens the page where the code is', async () => {
  const { tree } = await mount();
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  const btn = tree.root.findAll((n: any) => n.props?.testID === 'stripe-open' && typeof n.props?.onPress === 'function')[0];
  await act(async () => { btn.props.onPress(); });
  expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/dashboard\.stripe\.com\/apikeys/));
  open.mockRestore();
  tree.unmount();
});

it('a pasted code with spaces around it is accepted; a wrong one gets a plain message', async () => {
  const { tree } = await mount();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const input = () => tree.root.findAll((n: any) => n.props?.testID === 'stripe-code' && typeof n.props?.onChangeText === 'function')[0];
  const connect = () => tree.root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === m.connect, { deep: true }).length > 0)[0];

  await act(async () => { input().props.onChangeText('abc123456'); });
  await act(async () => { await connect().props.onPress(); });
  expect(alert).toHaveBeenCalledWith(m.invalidKeyTitle, m.invalidKeyDesc);

  alert.mockClear();
  await act(async () => { input().props.onChangeText('  sk_live_abcdefghijklmnop \n'); });
  await act(async () => { await connect().props.onPress(); });
  // Past the format check: the next thing asked is consent, not "invalid".
  expect(alert.mock.calls.some((c) => c[0] === m.invalidKeyTitle)).toBe(false);
  alert.mockRestore();
  tree.unmount();
});
