// =============================================================================
// reputationService.requestReview tests (R288)
// =============================================================================
// Before R288, requestReview was a stub: built an in-memory ReviewRequest
// and emitted trackUserAction. Nothing reached the customer. Now it actually
// dispatches via WhatsApp / mailto / Share in priority order.
// =============================================================================

import { Linking, Share } from 'react-native';
import { reputationService } from '../reputationService';
import * as templateService from '../whatsappTemplateService';

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn().mockResolvedValue(undefined),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Share: { share: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../intelligence/intelligenceEngine', () => ({
  trackUserAction: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reputationService.requestReview', () => {
  it('routes to WhatsApp when consent + phone present', async () => {
    jest.spyOn(templateService, 'hasConsent').mockResolvedValue(true);
    const result = await reputationService.requestReview({
      projectId: 'p-1',
      customerId: 'c-1',
      customerName: 'Jan',
      customerPhone: '+31612345678',
      customerEmail: 'jan@example.com',
      businessName: 'Test BV',
      reviewLink: 'https://example.com/review',
    });
    expect(result.delivered).toBe(true);
    expect(result.channel).toBe('whatsapp');
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('wa.me/31612345678'));
    expect(Share.share).not.toHaveBeenCalled();
  });

  it('falls back to email when no WhatsApp consent', async () => {
    jest.spyOn(templateService, 'hasConsent').mockResolvedValue(false);
    const result = await reputationService.requestReview({
      projectId: 'p-1',
      customerId: 'c-1',
      customerName: 'Jan',
      customerPhone: '+31612345678',
      customerEmail: 'jan@example.com',
      businessName: 'Test BV',
      reviewLink: 'https://example.com/review',
    });
    expect(result.channel).toBe('email');
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('mailto:jan@example.com'));
  });

  it('falls back to Share when no email + no WhatsApp', async () => {
    jest.spyOn(templateService, 'hasConsent').mockResolvedValue(false);
    const result = await reputationService.requestReview({
      projectId: 'p-1',
      customerName: 'Jan',
      businessName: 'Test BV',
      reviewLink: 'https://example.com/review',
    });
    expect(result.channel).toBe('share');
    expect(Share.share).toHaveBeenCalled();
  });

  it('rejects unreasonably short phone numbers and falls through', async () => {
    jest.spyOn(templateService, 'hasConsent').mockResolvedValue(true);
    const result = await reputationService.requestReview({
      projectId: 'p-1',
      customerId: 'c-1',
      customerPhone: '12',  // too short
      customerEmail: 'jan@example.com',
      businessName: 'Test BV',
      reviewLink: 'https://example.com/review',
    });
    expect(result.channel).toBe('email');
  });

  it('records delivered + channel in the returned request', async () => {
    jest.spyOn(templateService, 'hasConsent').mockResolvedValue(false);
    const result = await reputationService.requestReview({
      projectId: 'p-1',
      businessName: 'Test BV',
      reviewLink: 'https://example.com/review',
    });
    expect(result).toMatchObject({
      delivered: true,
      channel: 'share',
      projectId: 'p-1',
      status: 'pending',
    });
  });
});
