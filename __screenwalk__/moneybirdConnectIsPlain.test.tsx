/**
 * Connecting Moneybird reads like it is for a builder.
 *
 * It asked for an "API-TOKEN" plus an "ADMINISTRATIE-ID" (emulator walk
 * 2026-09-28: "highly technical for a construction worker"). Now: three
 * plain steps, paste the code, Koppelen — and only when the code sees more
 * than one administration, a menu of their NAMES.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import i18n from '../src/i18n/i18n';
import nl from '../src/i18n/locales/nl.json';

const mockList = jest.fn();
const mockConnect = jest.fn(async (_: any) => ({ ok: true, administrationId: 'x' }));
jest.mock('../src/integrations/moneybird', () => ({
  listAdministrationsForToken: (...a: any[]) => mockList(...a),
  connectWithPersonalToken: (a: any) => mockConnect(a),
  clearMoneybirdConfig: jest.fn(),
  isConnected: async () => false,
}));
let mockState: any;
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const Screen = () => require('../app/(modals)/moneybird').default;
const m = (nl as any).moneybird;
const texts = (tree: any): string[] => tree.root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
  .map((n: any) => [].concat(n.props.children).join(''));

async function mountAndSubmit(code: string) {
  await i18n.changeLanguage('nl');
  mockState = { connectMoneybird: jest.fn(), disconnectMoneybird: jest.fn(), moneybirdConnected: false };
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  const input = tree.root.findAll((n: any) => n.props?.testID === 'moneybird-code' && typeof n.props?.onChangeText === 'function')[0];
  await act(async () => { input.props.onChangeText(code); });
  const btn = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === m.connect, { deep: true }).length > 0)[0];
  await act(async () => { await btn.props.onPress(); });
  return tree;
}

beforeEach(() => { mockList.mockReset(); mockConnect.mockClear(); });

it('asks for no token or administration id, in words a builder uses', async () => {
  await i18n.changeLanguage('nl');
  mockState = { connectMoneybird: jest.fn(), disconnectMoneybird: jest.fn(), moneybirdConnected: false };
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  const all = texts(tree).join(' | ');
  expect(all).toContain(m.stepsTitle);
  expect(all).not.toMatch(/API|token|administratie-?ID|Developers/i);
  tree.unmount();
});

it('one administration: connects straight away', async () => {
  mockList.mockResolvedValue({ ok: true, admins: [{ id: '42', name: 'Jansen Loodgieters' }] });
  const tree = await mountAndSubmit('  code-123 ');
  expect(mockConnect).toHaveBeenCalledWith({ accessToken: 'code-123', administrationId: '42' });
  expect(tree.root.findAll((n: any) => n.props?.testID === 'moneybird-pick')).toHaveLength(0);
  tree.unmount();
});

it('several: shows their names, connects the one picked — never the first by default', async () => {
  mockList.mockResolvedValue({ ok: true, admins: [{ id: '1', name: 'Privé' }, { id: '2', name: 'Jansen Loodgieters' }] });
  const tree = await mountAndSubmit('code-123');
  expect(mockConnect).not.toHaveBeenCalled();
  const menu = tree.root.findAll((n: any) => Array.isArray(n.props?.items) && typeof n.props?.renderAnchor === 'function')[0];
  expect(menu.props.items.map((i: any) => i.label)).toEqual(['Privé', 'Jansen Loodgieters']);
  await act(async () => { menu.props.items[1].onPress(); });
  expect(mockConnect).toHaveBeenCalledWith({ accessToken: 'code-123', administrationId: '2' });
  tree.unmount();
});
