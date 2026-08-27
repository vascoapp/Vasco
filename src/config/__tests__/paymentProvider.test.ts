import { getPaymentProviderForCountry, getPaymentDisplayForCountry } from '../paymentMethods';

/**
 * The payments screen named its provider and its headline method from
 * hardcoded strings: the header said "iDEAL & Mollie" in all six locale files
 * and the connection card said "Mollie Payments" over an "M" badge. iDEAL is
 * Dutch — it does not exist in the UK or the US, and is not the local method in
 * DE/FR/ES/IT either — and UK/US contractors are on Stripe, not Mollie.
 *
 * The same fault had already been fixed once for the METHOD LIST (see the
 * comment on STRIPE_DISPLAY_US: US contractors used to see "iDEAL /
 * Bancontact"); the two labels beside it kept it.
 */
describe('payments screen names the right provider and method', () => {
  it('routes UK and US to Stripe, the EUR markets to Mollie', () => {
    expect(getPaymentProviderForCountry('UK')).toBe('Stripe');
    expect(getPaymentProviderForCountry('US')).toBe('Stripe');
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT']) {
      expect(getPaymentProviderForCountry(c)).toBe('Mollie');
    }
  });

  it('never offers iDEAL outside the Netherlands', () => {
    for (const c of ['DE', 'FR', 'ES', 'IT', 'UK', 'US'] as const) {
      const names = getPaymentDisplayForCountry(c).map((m) => m.name.toLowerCase());
      expect(names).not.toContain('ideal');
    }
    // ...and still offers it where it belongs.
    expect(getPaymentDisplayForCountry('NL').map((m) => m.name)).toContain('iDEAL');
  });

  it('gives every market a headline method for the subtitle', () => {
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT', 'UK', 'US'] as const) {
      const first = getPaymentDisplayForCountry(c)[0];
      expect(first?.name?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
