/**
 * Besparen counts only what the contractor actually did (sweep B7).
 *
 * Tapping a procurement card only OPENS material search, yet it joined
 * "N acties ingepland" — nothing was scheduled anywhere. A tip asked to be
 * "activated" for an "expected saving" and nothing was ever activated.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockPush = jest.fn();
jest.mock('../components/shared/FadeIn', () => ({ FadeIn: ({ children }: any) => children }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }), useFocusEffect: () => {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: ({ children }: any) => children }));
jest.mock('../state/AppState', () => ({ useAppState: () => ({ jobs: [], jobMaterials: {}, materials: [], businessProfile: { country: 'NL' } }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', country: 'NL' } }) }));
jest.mock('../services/actionLedgerService', () => ({ ...jest.requireActual('../services/actionLedgerService'), useActionLedger: () => ({ total: 0, byType: {} }) }));
jest.mock('../services/predictiveSavingsService', () => ({
  ...jest.requireActual('../services/predictiveSavingsService'),
  usePredictiveSavings: () => [{ id: 'tip-1', title: 'Bundel je bestellingen', description: 'Eén besteldag per week', potentialSaving: 120, icon: 'bulb-outline', actionLabel: 'Besteldag instellen' }],
}));
jest.mock('../services/procurementAgentService', () => ({
  ...jest.requireActual('../services/procurementAgentService'),
  useProcurementAgent: () => ({ results: [{ material: { name: 'Koperbuis 15mm' }, recommendation: 'Goedkoper bij Technische Unie', bestOption: { savings: 40 } }] }),
}));

const ORDER = require('../i18n/locales/en.json').savings.order as string;
const Screen = () => require('../../app/(contractor)/besparen').default;
const texts = (tree: any) => tree.root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children).join(' | ');
const pressLabel = async (tree: any, label: string) => {
  const btn = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => c.props?.children === label, { deep: true }).length > 0, { deep: true });
  await act(async () => { btn[btn.length - 1].props.onPress(); });
};

it('opening a screen is not counted; a handled tip is', async () => {
  const S = Screen();
  let tree: any;
  await act(async () => { tree = TestRenderer.create(<S />); });

  await pressLabel(tree, ORDER);
  expect(mockPush).toHaveBeenCalledWith('/contractor/material-search');
  expect(texts(tree)).not.toMatch(/\d+ (actions? scheduled|tips? handled)/i);
  expect(texts(tree)).toMatch(/Koperbuis 15mm/); // still there to act on

  await pressLabel(tree, 'Handled');
  expect(texts(tree)).toMatch(/1 tip handled/);
  tree.unmount();
});
