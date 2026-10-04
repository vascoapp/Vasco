/**
 * The price list shows the PROFILE's currency, not the account's (#218).
 * A UK contractor whose account still said NL saw prices in euros.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

let mockProfile: any = { country: 'UK' };
jest.mock('../state/AppState', () => ({ useAppState: () => ({ businessProfile: mockProfile }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', country: 'NL' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useFocusEffect: () => {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: ({ children }: any) => children }));
jest.mock('../services/pricebookService', () => ({
  ...jest.requireActual('../services/pricebookService'),
  usePricebook: () => ({
    loading: false,
    refresh: jest.fn(),
    entries: [{ id: 'e1', name: 'Hourly rate', category: 'labor', unit: 'hour', basePrice: 85, isActive: true }],
  }),
}));

async function renderedTexts() {
  const { Pricebook } = require('../components/contractor/Pricebook');
  let tree: any;
  await act(async () => { tree = TestRenderer.create(<Pricebook />); });
  const texts = tree.root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children).join(' | ');
  tree.unmount();
  return texts;
}

it('a UK profile on an NL account prices in pounds', async () => {
  mockProfile = { country: 'UK' };
  const texts = await renderedTexts();
  expect(texts).toMatch(/£/);
  expect(texts).not.toMatch(/€/);
});
