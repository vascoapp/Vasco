/**
 * The push a contractor gets when their customer decides in the portal (W119)
 * — every language, both decisions, never a placeholder or an English
 * leftover, and the customer's name or the market's word for "customer".
 */
import { quoteDecisionPush, type DecisionLocale } from '../../supabase/functions/_shared/quoteDecisionCopy';

const LOCALES: DecisionLocale[] = ['en', 'nl', 'de', 'fr', 'es', 'it'];

describe.each(LOCALES)('%s', (lng) => {
  it.each(['accepted', 'rejected'] as const)('%s: names the customer and the quote', (decision) => {
    const p = quoteDecisionPush(lng, decision, 'Edilizia Bianchi S.r.l.', 'Q0001');
    expect(p.body).toContain('Edilizia Bianchi S.r.l.');
    expect(p.body).toContain('Q0001');
    expect(`${p.title} ${p.body}`).not.toMatch(/[{}]/);
    if (lng !== 'en') expect(`${p.title} ${p.body}`).not.toMatch(/\b(accepted|declined|Quote)\b/);
  });

  it('no name → the word for customer, never blank', () => {
    const p = quoteDecisionPush(lng, 'accepted', '  ', 'Q0002');
    expect(p.body.trim().length).toBeGreaterThan('Q0002'.length + 5);
    expect(p.body.startsWith(' ')).toBe(false);
  });
});

it('accepted and declined say different things', () => {
  for (const l of LOCALES) {
    expect(quoteDecisionPush(l, 'accepted', 'A', 'Q1')).not.toEqual(quoteDecisionPush(l, 'rejected', 'A', 'Q1'));
  }
});
