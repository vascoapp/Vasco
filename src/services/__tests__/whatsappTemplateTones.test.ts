// =============================================================================
// whatsappTemplateService tone variants test (R301)
// =============================================================================
// Verifies the customer-tag → reminder-tone mapping wires through correctly.
// =============================================================================

import { renderPaymentReminderForTag, toneForCustomerTag } from '../whatsappTemplateService';

describe('toneForCustomerTag', () => {
  it.each([
    ['vip', 'gentle'],
    ['loyal', 'gentle'],
    ['new', 'standard'],
    [undefined, 'standard'],
    ['risky', 'firm'],
    ['inactive', 'firm'],
  ] as const)('%p → %p', (tag, expected) => {
    expect(toneForCustomerTag(tag as any)).toBe(expected);
  });
});

describe('renderPaymentReminderForTag', () => {
  const vars = { customer: 'Jan', ref: 'INV-001', amount: '€450', link: 'https://pay.example/1', business: 'Test BV' };

  it('VIP gets a gentle nudge ("courtesy nudge")', () => {
    const text = renderPaymentReminderForTag('en', vars, 'vip');
    expect(text).toContain('courtesy nudge');
    expect(text).toContain('Jan');
    expect(text).toContain('INV-001');
  });

  it('risky gets the firm "overdue / 7 days" variant', () => {
    const text = renderPaymentReminderForTag('en', vars, 'risky');
    expect(text).toContain('overdue');
    expect(text).toContain('7 days');
  });

  it('default falls through to standard', () => {
    const text = renderPaymentReminderForTag('en', vars);
    expect(text).toContain('friendly reminder');
  });

  it('Dutch locale renders the gentle variant', () => {
    const text = renderPaymentReminderForTag('nl', vars, 'loyal');
    expect(text).toContain('vriendelijk seintje');
  });
});
