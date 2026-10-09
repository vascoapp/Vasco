/**
 * A renewal card opens ITS item in Certificaten (?itemId=), once (decision 3a,
 * review 2026-10-09): the param stayed on the route, so the sheet re-opened
 * whenever the list changed — and the param is cleared after use, so a second
 * tap on a card works.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import nl from '../src/i18n/locales/nl.json';

let mockState: any;
let mockParams: Record<string, string | undefined> = {};
const mockSetParams = jest.fn((p: Record<string, string | undefined>) => { mockParams = { ...mockParams, ...p }; });
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { country: 'NL' } }) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), setParams: mockSetParams }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const sheet = (nl as any).complianceSheet;

it('opens the named item in the sheet once, then clears the param', async () => {
  await require('../src/i18n/i18n').default.changeLanguage('nl');
  const { complianceService } = require('../src/services/complianceService');
  const { id } = complianceService.saveTrackedItem({ type: 'certification', name: 'Gas Safe', expiryDate: new Date(Date.now() + 5 * 86_400_000) });
  mockState = { businessProfile: { country: 'NL' } };
  mockParams = { itemId: id };
  const S = require('../app/(contractor)/certificaten').default;
  let tree: any;
  await act(async () => { tree = TestRenderer.create(<S />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const sheetOpen = () => tree.root.findAll((n: any) => n.props?.visible === true && n.findAll((m: any) => m.props?.accessibilityLabel === sheet.editTitle, { deep: true }).length > 0, { deep: true }).length > 0;
  expect(sheetOpen()).toBe(true);
  expect(mockSetParams).toHaveBeenCalledWith({ itemId: undefined });
  tree.unmount();
});
