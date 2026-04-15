/**
 * @jest-environment node
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: () => ({ select: async () => ({ data: null, error: new Error('not configured') }) }) },
}));

import { isFeatureEnabled } from '../featureFlagService';

describe('featureFlagService', () => {
  test('defaults payments_mollie = true when no Supabase cache', () => {
    expect(isFeatureEnabled('payments_mollie', { userId: 'u1' })).toBe(true);
  });

  test('defaults whatsapp_business = false (seeded off)', () => {
    expect(isFeatureEnabled('whatsapp_business', { userId: 'u1' })).toBe(false);
  });
});
