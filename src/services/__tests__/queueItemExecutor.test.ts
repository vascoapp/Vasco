// =============================================================================
// queueItemExecutor.test.ts (R286)
// =============================================================================
// Verifies the AI queue's approve loop actually fires a side-effect for each
// item type. Before R286, approve was decorative for everything except
// customer_question + Share-sheet types in VascoCard.
// =============================================================================

import { Share, Linking } from 'react-native';
import {
  executeApprovedQueueItem,
  isShareableQueueType,
  isInformationalQueueType,
} from '../queueItemExecutor';
import type { QueueItem } from '../aiActionQueueService';

jest.mock('react-native', () => ({
  Share: { share: jest.fn().mockResolvedValue(undefined) },
  Linking: { openURL: jest.fn().mockResolvedValue(undefined) },
}));

const makeItem = (overrides: Partial<QueueItem>): QueueItem => ({
  id: 'q-test',
  type: 'draft_invoice',
  status: 'pending',
  title: 'Test',
  description: 'Test description',
  preparedData: {},
  actionLabel: 'Approve',
  estimatedImpact: '€0',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(),
  setParams: jest.fn(),
  navigate: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  prefetch: jest.fn(),
}) as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('classification helpers', () => {
  it('shareable types are recognised', () => {
    expect(isShareableQueueType('draft_reminder')).toBe(true);
    expect(isShareableQueueType('progress_note')).toBe(true);
    expect(isShareableQueueType('draft_invoice')).toBe(false);
  });

  it('informational types are recognised', () => {
    expect(isInformationalQueueType('low_win_alert')).toBe(true);
    expect(isInformationalQueueType('late_payment_risk_alert')).toBe(true);
    expect(isInformationalQueueType('supplier_comparison')).toBe(true);
    expect(isInformationalQueueType('draft_invoice')).toBe(false);
  });
});

describe('navigate paths', () => {
  it('draft_invoice with jobId routes to job detail', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'draft_invoice', preparedData: { jobId: 'j-1' } }),
      { router },
    );
    expect(result.executed).toBe(true);
    expect(result.via).toBe('navigate');
    expect(router.push).toHaveBeenCalledWith('/contractor/job/j-1');
  });

  it('draft_invoice without jobId falls back to payments', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'draft_invoice' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/payments');
  });

  it('cert_renewal opens permits', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'cert_renewal' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/permits');
  });

  it('schedule_suggestion opens drag-schedule', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'schedule_suggestion' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/drag-schedule');
  });

  it('tax_prep opens vat-prep', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'tax_prep' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/vat-prep');
  });

  it('einvoice_submit deep-links to invoice when id present', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(
      makeItem({ type: 'einvoice_submit', preparedData: { invoiceId: 'inv-9' } }),
      { router },
    );
    expect(router.push).toHaveBeenCalledWith('/invoices/inv-9');
  });
});

describe('share paths', () => {
  it('shareable type fires Share.share with template', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'draft_reminder', preparedData: { template: 'Hello!' } }),
      { router },
    );
    expect(result.executed).toBe(true);
    expect(result.via).toBe('share');
    expect(Share.share).toHaveBeenCalledWith({ message: 'Hello!', title: 'Test' });
  });

  it('alreadyShared:true skips Share.share', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'draft_reminder', preparedData: { template: 'Hello!' } }),
      { router },
      { alreadyShared: true },
    );
    expect(result.via).toBe('noop');
    expect(Share.share).not.toHaveBeenCalled();
  });

  it('shareable with no text returns no-op', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'draft_reminder', description: '' }),
      { router },
    );
    expect(result.executed).toBe(false);
    expect(Share.share).not.toHaveBeenCalled();
  });
});

describe('link paths', () => {
  it('price_alert with affiliateUrl opens external link', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'price_alert', preparedData: { affiliateUrl: 'https://example.com' } }),
      { router },
    );
    expect(result.executed).toBe(true);
    expect(result.via).toBe('link');
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('price_alert without affiliateUrl falls back to inkoop', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'price_alert' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/inkoop');
  });
});

describe('informational paths', () => {
  it('low_win_alert with quoteId deep-links to the quote', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'low_win_alert', preparedData: { quoteId: 'q-7' } }),
      { router },
    );
    expect(result.executed).toBe(true);
    expect(router.push).toHaveBeenCalledWith('/contractor/quote/q-7');
  });

  it('supplier_comparison without ids stays informational', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(makeItem({ type: 'supplier_comparison' }), { router });
    expect(result.executed).toBe(false);
    expect(result.via).toBe('inform');
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('special handling', () => {
  it('customer_question is no-op (handled in approveItem)', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(makeItem({ type: 'customer_question' }), { router });
    expect(result.via).toBe('noop');
    expect(Share.share).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
