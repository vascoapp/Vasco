/**
 * Business settings stores the contractor's VAT id where the PDF, the profile
 * gate and every e-invoice read it — written the local way, kept canonical.
 *  - Spain's "NIF/CIF" field wrote `registrationNumber`, so an edited NIF
 *    reached none of them (sweep, 2026-10-03).
 *  - An Italian bare partita IVA was refused with "es. NL123456789B01"
 *    (everyday matrix, 2026-10-03).
 * Mounted over a stubbed AppState, as businessSettingsItalianTaxCode does.
 */
import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockUpdate = jest.fn(async (_u: any) => undefined);
let mockState: any;
let mockCountry = 'ES';
jest.mock('../src/state/AppState', () => ({ useAppState: () => mockState }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { country: mockCountry } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../src/lib/dataProvider', () => ({ peekDocumentCounter: async () => null }));

// The real i18n, so the message is the one a contractor reads (interpolated).
require('../src/i18n/i18n');
const Screen = () => require('../app/(modals)/business-settings').default;
const inputs = (root: any) => root.findAll((n: any) => n.type === 'TextInput' && typeof n.props?.onChangeText === 'function', { deep: true });
const field = (root: any, placeholder: string) => inputs(root).find((n: any) => n.props.placeholder === placeholder);

async function render(profile: any) {
  mockCountry = profile.country;
  mockState = { profileLoaded: true, businessProfile: profile, updateBusinessProfile: mockUpdate };
  let tree: any;
  const S = Screen();
  await act(async () => { tree = TestRenderer.create(<S />); });
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}
const save = async (root: any) => {
  const btn = root.findAll((n: any) => typeof n.props?.onPress === 'function' && typeof n.props?.label === 'string', { deep: true });
  await act(async () => { await btn[btn.length - 1].props.onPress(); });
};

beforeEach(() => mockUpdate.mockClear());

it('Spain: the NIF/CIF field IS the VAT id — shown from it, saved into it, bare NIF stored with ES', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await render({ country: 'ES', businessName: 'Fontanería García', vatNumber: 'ESB87654323', kvkNumber: '5045', address: 'Calle Mayor 12', postcode: '28013', city: 'Madrid', province: 'Madrid', personType: 'F' });
  const nif = () => field(tree.root, '12345678A');
  expect(nif()).toBeDefined();
  expect(nif().props.value).toBe('ESB87654323');
  await act(async () => { nif().props.onChangeText('12345678Z'); });
  await save(tree.root);
  expect(alert).not.toHaveBeenCalled();
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ vatNumber: 'ES12345678Z' }));
  alert.mockRestore();
});

it('Italy: a bare partita IVA is saved with IT; a wrong one is refused with an ITALIAN example', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await render({ country: 'IT', businessName: 'Idraulica Rossi', vatNumber: '', address: 'Via Roma 12', postcode: '20121', city: 'Milano', province: 'MI', personType: 'F', fiscalRegime: 'RF01' });
  const piva = () => field(tree.root, 'IT12345678901');
  await act(async () => { piva().props.onChangeText('01234567896'); });
  await save(tree.root);
  expect(mockUpdate).not.toHaveBeenCalled();
  const body = String(alert.mock.calls[0]?.[1] ?? '');
  expect(body).toContain('IT12345678901');
  expect(body).not.toContain('NL123456789B01');
  alert.mockClear();
  await act(async () => { piva().props.onChangeText('01234567897'); });
  await save(tree.root);
  expect(alert).not.toHaveBeenCalled();
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ vatNumber: 'IT01234567897' }));
  alert.mockRestore();
});
