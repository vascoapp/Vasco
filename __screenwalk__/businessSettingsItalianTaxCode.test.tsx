/**
 * An Italian contractor can enter their codice fiscale (user decision
 * 2026-10-01). Before, the only Italian identity fields were the Partita IVA
 * and the REA, so a sole trader's invoices fell back to the Partita IVA as
 * the SdI transmitter id. A wrong check letter is refused at Save, not at the
 * first export (SdI 00302/00300).
 */
import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockUpdate = jest.fn(async (_u: any) => undefined);
let mockState: any;
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { country: 'IT' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/lib/dataProvider', () => ({ peekDocumentCounter: async () => null }));

const Screen = () => require('../app/(modals)/business-settings').default;
const PROFILE = {
  country: 'IT', businessName: 'Mario Rossi Impianti', vatNumber: 'IT01114601006', registrationNumber: 'REA MI-1234567',
  address: 'Via Roma 10', postcode: '20121', city: 'Milano', province: 'MI', personType: 'F', fiscalRegime: 'RF01',
  email: 'info@rossi.it', phone: '+39 02 1234567', defaultPaymentTerms: 30,
};
const PLACEHOLDER = 'RSSMRA80A01H501U';
const inputs = (root: any) => root.findAll((n: any) => typeof n.props?.onChangeText === 'function' && n.props.value !== undefined, { deep: true });

async function render(profile: any) {
  mockState = { profileLoaded: true, businessProfile: profile, updateBusinessProfile: mockUpdate };
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}
const cfField = (root: any) => inputs(root).find((n: any) => n.props.placeholder === PLACEHOLDER);
const save = async (root: any) => {
  const btn = root.findAll((n: any) => typeof n.props?.onPress === 'function' && typeof n.props?.label === 'string', { deep: true });
  await act(async () => { await btn[btn.length - 1].props.onPress(); });
};

beforeEach(() => mockUpdate.mockClear());

it('refuses a codice fiscale with a wrong check letter, saves a valid one upper-cased', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await render(PROFILE);
  expect(cfField(tree.root)).toBeDefined();

  await act(async () => { cfField(tree.root).props.onChangeText('RSSMRA80A01H501X'); });
  await save(tree.root);
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalled();

  await act(async () => { cfField(tree.root).props.onChangeText('rssmra 80a01 h501u'); });
  await save(tree.root);
  expect(mockUpdate).toHaveBeenCalledWith({ taxCode: 'RSSMRA80A01H501U' });
  alert.mockRestore();
  tree.unmount();
});

it("a company's own codice fiscale is its 11 digits — a person's 16-character code is refused", async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await render({ ...PROFILE, personType: 'J', businessName: 'Rossi Impianti S.r.l.' });
  await act(async () => { cfField(tree.root).props.onChangeText('RSSMRA80A01H501U'); });
  await save(tree.root);
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => { cfField(tree.root).props.onChangeText('01114601006'); });
  await save(tree.root);
  expect(mockUpdate).toHaveBeenCalledWith({ taxCode: '01114601006' });
  alert.mockRestore();
  tree.unmount();
});

it('is not shown outside Italy', async () => {
  const tree = await render({ ...PROFILE, country: 'DE', vatNumber: 'DE123456789' });
  expect(cfField(tree.root)).toBeUndefined();
  tree.unmount();
});
