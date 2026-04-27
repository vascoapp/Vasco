/**
 * @jest-environment node
 *
 * R270 — customer smart replies (Google-Inbox style 1-tap suggestions).
 */

jest.mock('../../i18n/i18n', () => ({
  __esModule: true,
  default: {
    t: (k: string, opts: any = {}) => {
      let s = opts.defaultValue ?? k;
      for (const [vk, vv] of Object.entries(opts)) {
        if (vk === 'defaultValue') continue;
        s = s.replace(new RegExp(`\\{\\{${vk}\\}\\}`, 'g'), String(vv));
      }
      return s;
    },
  },
}));

import { generateSmartReplies, type CustomerContext } from '../customerSmartReplyService';

const baseCtx = (over: Partial<CustomerContext> = {}): CustomerContext => ({
  customerName: 'Mary',
  customerEmail: 'mary@example.com',
  customerPhone: '+31611111111',
  isNewCustomer: false,
  ...over,
});

describe('generateSmartReplies', () => {
  test('inbound "when" question → high-priority schedule reply', () => {
    const r = generateSmartReplies(baseCtx({ lastInboundMessage: 'When can you come?' }));
    expect(r[0].id).toBe('inbound-when');
    expect(r[0].priority).toBeGreaterThan(50);
  });

  test('inbound "price" → quote-promise reply', () => {
    const r = generateSmartReplies(baseCtx({ lastInboundMessage: 'wat is de prijs?' }));
    expect(r.some((x) => x.id === 'inbound-price')).toBe(true);
  });

  test('open quote >48h ago → followup suggestion', () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const r = generateSmartReplies(baseCtx({
      latestQuote: { id: 'Q1', status: 'sent', sentAt: sixDaysAgo },
    }));
    expect(r.some((x) => x.id === 'quote-followup')).toBe(true);
  });

  test('overdue invoice → reminder reply', () => {
    const r = generateSmartReplies(baseCtx({
      latestInvoice: { id: 'I42', status: 'overdue', dueInDays: -5 },
    }));
    const overdue = r.find((x) => x.id === 'invoice-overdue');
    expect(overdue).toBeDefined();
    expect(overdue!.body).toContain('I42');
    expect(overdue!.body).toContain('5');
  });

  test('completed job <7d → feedback ask', () => {
    const r = generateSmartReplies(baseCtx({
      latestJob: { id: 'J1', status: 'completed', completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    }));
    expect(r.some((x) => x.id === 'job-feedback')).toBe(true);
  });

  test('scheduled job → on-the-way heads-up', () => {
    const r = generateSmartReplies(baseCtx({
      latestJob: { id: 'J1', status: 'scheduled', title: 'Boiler check' },
    }));
    expect(r.some((x) => x.id === 'job-onway')).toBe(true);
  });

  test('new customer with no signal → 2 generic openers', () => {
    const r = generateSmartReplies(baseCtx({ isNewCustomer: true }));
    expect(r.find((x) => x.id === 'new-greet')).toBeDefined();
    expect(r.find((x) => x.id === 'new-ack')).toBeDefined();
  });

  test('caps to max parameter', () => {
    const r = generateSmartReplies(baseCtx({
      lastInboundMessage: 'When and what is the price?',
      latestQuote: { id: 'Q', status: 'sent', sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      latestInvoice: { id: 'I', status: 'overdue', dueInDays: -3 },
    }), 2);
    expect(r).toHaveLength(2);
  });

  test('priority ordering — inbound > overdue > quote-followup', () => {
    const r = generateSmartReplies(baseCtx({
      lastInboundMessage: 'when can you come',
      latestInvoice: { id: 'I', status: 'overdue', dueInDays: -10 },
      latestQuote: { id: 'Q', status: 'sent', sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    }));
    expect(r[0].id).toBe('inbound-when');
  });

  test('channel selection prefers WhatsApp when phone present', () => {
    const r = generateSmartReplies(baseCtx({ customerPhone: '+31611111111' }), 1);
    if (r.length > 0) expect(r[0].channel).toBe('whatsapp');
  });

  test('channel falls back to email when no phone', () => {
    const r = generateSmartReplies(baseCtx({ customerPhone: undefined, customerEmail: 'a@b.c' }), 1);
    if (r.length > 0) expect(r[0].channel).toBe('email');
  });

  test('no signal + existing customer → empty', () => {
    const r = generateSmartReplies(baseCtx({ isNewCustomer: false }));
    expect(r).toHaveLength(0);
  });
});
