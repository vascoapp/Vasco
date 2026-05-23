// R96 — verify trackEvent bridges into addBreadcrumb so crashes carry
// the event trail. The bridge is silent — only this test exercises the
// contract directly.

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
  isSupabaseConfigured: false,
}));

const mockAddBreadcrumb = jest.fn();
jest.mock('../../lib/errorReporting', () => ({
  addBreadcrumb: (crumb: unknown) => mockAddBreadcrumb(crumb),
}));

jest.mock('../consentService', () => ({
  consentService: { getConsent: jest.fn().mockResolvedValue(true) },
}));

import { trackEvent } from '../eventTrackingService';

beforeEach(() => mockAddBreadcrumb.mockClear());

describe('eventTracking → Sentry breadcrumb bridge', () => {
  it('emits a breadcrumb for lead_created with category=lead', async () => {
    await trackEvent('lead_created', { source: 'manual' });
    expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
    const crumb = mockAddBreadcrumb.mock.calls[0][0];
    expect(crumb).toMatchObject({
      category: 'lead',
      message: 'lead_created',
      data: { source: 'manual' },
      level: 'info',
    });
  });

  it('categorizes worker events under crew', async () => {
    await trackEvent('worker_added', { role: 'tech' });
    expect(mockAddBreadcrumb.mock.calls[0][0].category).toBe('crew');
  });

  it('categorizes license events under compliance', async () => {
    await trackEvent('license_added', {});
    expect(mockAddBreadcrumb.mock.calls[0][0].category).toBe('compliance');
  });

  it('categorizes ai_command_sent under ai', async () => {
    await trackEvent('ai_command_sent', { length: 12 });
    expect(mockAddBreadcrumb.mock.calls[0][0].category).toBe('ai');
  });

  it('categorizes invoice/quote events under transaction', async () => {
    await trackEvent('invoice_created', {});
    expect(mockAddBreadcrumb.mock.calls[0][0].category).toBe('transaction');
    mockAddBreadcrumb.mockClear();
    await trackEvent('quote_sent', {});
    expect(mockAddBreadcrumb.mock.calls[0][0].category).toBe('transaction');
  });

  it('categorizes login/logout under auth (always tracked, bypasses consent)', async () => {
    await trackEvent('login', {});
    expect(mockAddBreadcrumb.mock.calls[0][0].category).toBe('auth');
  });

  it('falls back to user category for un-prefixed events', async () => {
    await trackEvent('feature_used', { name: 'export' });
    expect(mockAddBreadcrumb.mock.calls[0][0].category).toBe('user');
  });
});
