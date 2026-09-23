/**
 * The business-details form never saves a blank it was opened with.
 *
 * Every field was seeded ONCE from `businessProfile`. Opened before hydrate
 * (cold start, deep link, push) the form showed blanks, and Save wrote every
 * one of them over the contractor's real name, VAT number and IBAN (sweep
 * 2026-09-23, D4). Now: no form until the profile is loaded, and Save sends
 * only what the contractor changed.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockUpdate = jest.fn(async () => undefined);
let mockState: any;
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { country: 'DE' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/lib/dataProvider', () => ({ peekDocumentCounter: async () => null }));

const Screen = () => require('../app/(modals)/business-settings').default;

const PROFILE = {
  country: 'DE', businessName: 'Müller Sanitär GmbH', vatNumber: 'DE123456789',
  iban: 'DE89370400440532013000', email: 'info@mueller.de', phone: '+49 221 123456',
  address: 'Hauptstr. 1', postcode: '50667', city: 'Köln', defaultPaymentTerms: 14,
};

const inputs = (root: any) => root.findAll((n: any) => typeof n.props?.onChangeText === 'function' && n.props.value !== undefined, { deep: true });

async function render() {
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

beforeEach(() => mockUpdate.mockClear());

it('before the profile loads: no form, so nothing blank can be saved', async () => {
  mockState = { profileLoaded: false, businessProfile: { isComplete: false, completenessPercent: 0 }, updateBusinessProfile: mockUpdate };
  const tree = await render();
  expect(inputs(tree.root)).toHaveLength(0);
  tree.unmount();
});

it('Save sends ONLY the field the contractor changed', async () => {
  mockState = { profileLoaded: true, businessProfile: PROFILE, updateBusinessProfile: mockUpdate };
  const tree = await render();
  const fields = inputs(tree.root);
  expect(fields.map((n: any) => n.props.value)).toContain('Müller Sanitär GmbH');
  const city = fields.find((n: any) => n.props.value === 'Köln');
  await act(async () => { city.props.onChangeText('Bonn'); });
  const save = tree.root.findAll((n: any) => typeof n.props?.onPress === 'function' && typeof n.props?.label === 'string', { deep: true });
  expect(save.length).toBeGreaterThan(0);
  await act(async () => { await save[save.length - 1].props.onPress(); });
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(mockUpdate).toHaveBeenCalledWith({ city: 'Bonn' });
  tree.unmount();
});
