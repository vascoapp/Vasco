/**
 * Certificaten's KvK + BTW rows read the BUSINESS PROFILE (#218).
 *
 * They read dutchComplianceService's own record, which nothing fills: a
 * contractor with both numbers in their profile saw "KvK —" and "BTW
 * Inactief" (emulator walk 2026-09-28).
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import nl from '../src/i18n/locales/nl.json';

let mockState: any;
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { country: 'NL' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));

const Screen = () => require('../app/(contractor)/certificaten').default;

async function texts() {
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const out: string[] = tree.root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string', { deep: true })
    .map((n: any) => n.props.children);
  tree.unmount();
  return out;
}
const c = (nl as any).compliance;

it('shows the numbers the contractor entered, and no "enter" button for them', async () => {
  mockState = { businessProfile: { country: 'NL', kvkNumber: '69599084', vatNumber: 'NL001234567B01' } };
  const t = await texts();
  expect(t).toContain('69599084');
  expect(t).toContain('NL001234567B01');
  expect(t.filter((x) => x === c.fromProfile)).toHaveLength(2);
  expect(t).not.toContain(c.notEntered);
  expect(t).not.toContain(c.enterNumber);
  // No KvK API is connected: with a number on file, still no "Controleer".
  expect(t).not.toContain(c.checkKvK);
});

it('asks for a number that is missing', async () => {
  mockState = { businessProfile: { country: 'NL', kvkNumber: '69599084' } };
  const t = await texts();
  expect(t).toContain('69599084');
  expect(t.filter((x) => x === c.notEntered)).toHaveLength(1);
  expect(t).toContain(c.enterNumber);
});
