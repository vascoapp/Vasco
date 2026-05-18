/**
 * @jest-environment node
 *
 * R66r50 — country-aware Mollie redirect default.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { defaultPaymentSuccessUrl } from '../mollie';
import { setCurrentUser } from '../../lib/currentUser';

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
  else process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL = ORIGINAL_ENV;
  setCurrentUser(null);
});

describe('defaultPaymentSuccessUrl', () => {
  it('uses env var when set, regardless of country', () => {
    process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL = 'https://custom.example/done';
    setCurrentUser({ id: 'u1', country: 'DE' });
    expect(defaultPaymentSuccessUrl()).toBe('https://custom.example/done');
  });

  it('routes NL to .nl when env unset', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
    setCurrentUser({ id: 'u1', country: 'NL' });
    expect(defaultPaymentSuccessUrl()).toBe('https://app.vascobuild.com/payment/success');
  });

  it('routes DE to .de when env unset', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
    setCurrentUser({ id: 'u1', country: 'DE' });
    expect(defaultPaymentSuccessUrl()).toBe('https://app.vascobuild.com/payment/success');
  });

  it('routes FR to .fr when env unset', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
    setCurrentUser({ id: 'u1', country: 'FR' });
    expect(defaultPaymentSuccessUrl()).toBe('https://app.vascobuild.com/payment/success');
  });

  it('routes IT to .it when env unset', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
    setCurrentUser({ id: 'u1', country: 'IT' });
    expect(defaultPaymentSuccessUrl()).toBe('https://app.vascobuild.com/payment/success');
  });

  it('falls back to .app for UK', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
    setCurrentUser({ id: 'u1', country: 'UK' });
    expect(defaultPaymentSuccessUrl()).toBe('https://app.vascobuild.com/payment/success');
  });

  it('falls back to .app when country unknown', () => {
    delete process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
    setCurrentUser({ id: 'u1' });
    expect(defaultPaymentSuccessUrl()).toBe('https://app.vascobuild.com/payment/success');
  });
});
