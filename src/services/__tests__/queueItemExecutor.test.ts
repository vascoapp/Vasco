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
  // iOS: the sheet's own result decides (shareOutcome.test covers Android).
  Platform: { OS: 'ios' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) },
  Alert: { alert: (...a: unknown[]) => mockAlert(...a) },
}));
const mockAlert = jest.fn();
const mockReopen = jest.fn(async (_id: string) => undefined);
jest.mock('../aiActionQueueService', () => ({ reopenItem: (id: string) => mockReopen(id) }));

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
    expect(isInformationalQueueType('draft_invoice')).toBe(false);
    // NOT informational: its producers label the button "Compare" / "View
    // savings", so it must land somewhere. See the navigate test below.
    expect(isInformationalQueueType('supplier_comparison')).toBe(false);
  });
});

describe('navigate paths', () => {
  it('draft_invoice with jobId routes to job detail with create-invoice action', async () => {
    // R304: was simple string path; now passes ?action=create-invoice so the
    // job detail screen auto-fires addInvoiceFromJob on mount.
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'draft_invoice', preparedData: { jobId: 'j-1' } }),
      { router },
    );
    expect(result.executed).toBe(true);
    expect(result.via).toBe('navigate');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/contractor/job/[id]',
      params: { id: 'j-1', action: 'create-invoice' },
    });
  });

  it('draft_invoice without jobId falls back to payments', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'draft_invoice' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/payments');
  });

  it('cert_renewal without an item (older producers) opens permits', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'cert_renewal' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/permits');
  });

  // Decision 3a: the compliance agent's card names ONE certificate/policy —
  // it opens that item, where renewing = typing the new date. Permits holds
  // neither certificates nor insurance.
  it('cert_renewal for a tracked item opens that item in Compliance', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'cert_renewal', preparedData: { itemId: 'cert-1', itemType: 'certification' } }), { router });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/(contractor)/certificaten', params: { itemId: 'cert-1' } });
  });

  it('schedule_suggestion opens the schedule board', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'schedule_suggestion' }), { router });
    expect(router.push).toHaveBeenCalledWith('/contractor/schedule');
  });

  it('tax_prep opens vat-prep with previous-period prefill', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(makeItem({ type: 'tax_prep' }), { router });
    // R-tax: route now carries `period: previous` so the screen lands on the
    // last-completed quarter, not the empty current one.
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/contractor/vat-prep',
      params: { period: 'previous' },
    });
  });

  it('tax_prep for Q3 tapped in September opens the CURRENT quarter (#365)', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date(2026, 8, 22, 10, 0, 0));
    try {
      const router = makeRouter();
      await executeApprovedQueueItem(makeItem({ type: 'tax_prep', preparedData: { quarter: 'Q3', year: 2026 } }), { router });
      expect(router.push).toHaveBeenCalledWith({ pathname: '/contractor/vat-prep', params: { period: 'current' } });
    } finally {
      jest.useRealTimers();
    }
  });

  it('einvoice_submit deep-links to invoice with submit prefill', async () => {
    const router = makeRouter();
    await executeApprovedQueueItem(
      makeItem({ type: 'einvoice_submit', preparedData: { invoiceId: 'inv-9' } }),
      { router },
    );
    // R20: pass submit=einvoice so the invoice screen auto-opens the e-invoice
    // export dialog instead of waiting for the user to find the button.
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/invoices/inv-9',
      params: { submit: 'einvoice' },
    });
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

  it('supplier_comparison opens the comparison screen its button names', async () => {
    // Regression: this used to return {executed:false, via:'inform'} while the
    // card's actionLabel read "Compare" — a button naming a screen it never
    // opened.
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'supplier_comparison', preparedData: { materialName: 'CV-ketel' } }),
      { router },
    );
    expect(result.executed).toBe(true);
    expect(router.push).toHaveBeenCalledWith('/contractor/market-prices');
  });

  it('the monthly overpaying-items roll-up goes to Besparen instead', async () => {
    const router = makeRouter();
    const result = await executeApprovedQueueItem(
      makeItem({ type: 'supplier_comparison', preparedData: { totalMonthlySavings: 240, overpayingItems: [] } }),
      { router },
    );
    expect(result.executed).toBe(true);
    expect(router.push).toHaveBeenCalledWith('/(contractor)/besparen');
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

// ─── tax_prep opens the quarter the card NAMES (#365) ────────────────────────
// It always sent 'previous', so "Btw-voorbereiding Q3" tapped on 22 Sep opened Q2.
describe('taxPrepPeriod', () => {
  const { taxPrepPeriod } = require('../queueItemExecutor');
  it('Q3 tapped in September is the current quarter', () => {
    expect(taxPrepPeriod({ quarter: 'Q3', year: 2026 }, new Date(2026, 8, 22))).toBe('current');
  });
  it('Q3 tapped on 1 October is the previous quarter', () => {
    expect(taxPrepPeriod({ quarter: 'Q3', year: 2026 }, new Date(2026, 9, 1))).toBe('previous');
  });
  it('Q4 tapped in January is the previous quarter', () => {
    expect(taxPrepPeriod({ quarter: 'Q4', year: 2026 }, new Date(2027, 0, 2))).toBe('previous');
  });
  it('a card without a quarter keeps the old default', () => {
    expect(taxPrepPeriod(undefined, new Date(2026, 8, 22))).toBe('previous');
  });
});

// Review 2026-09-29: callers approve BEFORE executing, and approveItem retires
// the card (and suppresses a new chase for 3 days). A send that did not happen
// must put it back. Opening WhatsApp is not sending either — neither platform
// reports it, so the contractor is asked.
describe('a send that did not happen re-opens the card', () => {
  const reminder = () => makeItem({ id: 'q-rem', type: 'draft_reminder', preparedData: { template: 'Beste klant…' } });

  it('re-opens after a dismissed share sheet', async () => {
    (Share.share as jest.Mock).mockResolvedValueOnce({ action: 'dismissedAction' });
    const r = await executeApprovedQueueItem(reminder(), { router: makeRouter() });
    expect(r.executed).toBe(false);
    expect(mockReopen).toHaveBeenCalledWith('q-rem');
  });

  it('does not re-open a send that happened', async () => {
    (Share.share as jest.Mock).mockResolvedValueOnce({ action: 'sharedAction' });
    const r = await executeApprovedQueueItem(reminder(), { router: makeRouter() });
    expect(r.executed).toBe(true);
    expect(mockReopen).not.toHaveBeenCalled();
  });

  it('does not re-open a navigate action', async () => {
    await executeApprovedQueueItem(makeItem({ type: 'draft_invoice', preparedData: { jobId: 'j1' } }), { router: makeRouter() });
    expect(mockReopen).not.toHaveBeenCalled();
  });

  it('WhatsApp opened is asked about — "not yet" re-opens, "yes" records', async () => {
    const wa = () => makeItem({ id: 'q-wa', type: 'draft_reminder', preparedData: { template: 'x', affiliateUrl: 'https://wa.me/31612345678?text=x' } });
    mockAlert.mockImplementationOnce((_t: unknown, _b: unknown, buttons: any[]) => buttons[0].onPress());
    const no = await executeApprovedQueueItem(wa(), { router: makeRouter() });
    expect(Linking.openURL).toHaveBeenCalledWith('https://wa.me/31612345678?text=x');
    expect(no).toMatchObject({ executed: false, via: 'link' });
    expect(mockReopen).toHaveBeenCalledWith('q-wa');

    mockReopen.mockClear();
    mockAlert.mockImplementationOnce((_t: unknown, _b: unknown, buttons: any[]) => buttons[1].onPress());
    const yes = await executeApprovedQueueItem(wa(), { router: makeRouter() });
    expect(yes).toMatchObject({ executed: true, via: 'link' });
    expect(mockReopen).not.toHaveBeenCalled();
  });
});
