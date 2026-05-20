import {
  getUkVatTaxCode,
  getUsTaxCode,
  getTaxCodeForCountry,
  defaultCurrencyForCountry,
} from '../quickbooks';

describe('quickbooks tax routing (R82)', () => {
  describe('getUsTaxCode', () => {
    it('returns TAX for any positive rate', () => {
      expect(getUsTaxCode(0.01)).toBe('TAX');
      expect(getUsTaxCode(6.25)).toBe('TAX');
      expect(getUsTaxCode(9.5)).toBe('TAX');
    });
    it('returns NON for zero rate', () => {
      expect(getUsTaxCode(0)).toBe('NON');
    });
  });

  describe('getTaxCodeForCountry', () => {
    it('routes US to TAX/NON', () => {
      expect(getTaxCodeForCountry('US', 6.25)).toBe('TAX');
      expect(getTaxCodeForCountry('US', 0)).toBe('NON');
    });
    it('routes UK to numeric VAT codes', () => {
      expect(getTaxCodeForCountry('UK', 20)).toBe('20');
      expect(getTaxCodeForCountry('UK', 5)).toBe('5');
      expect(getTaxCodeForCountry('UK', 0)).toBe('NON');
    });
    it('falls through to UK semantics for unknown country', () => {
      // Reasonable default — QBO outside UK/US is rare and the UK
      // numeric tax code is the more conservative choice (vs TAX which
      // would only work with AST enabled).
      expect(getTaxCodeForCountry('FR', 20)).toBe('20');
    });
  });

  describe('defaultCurrencyForCountry', () => {
    it.each([
      ['US', 'USD'],
      ['UK', 'GBP'],
      ['GB', 'GBP'],
      ['NL', 'EUR'],
      ['DE', 'EUR'],
      ['FR', 'EUR'],
      ['IT', 'EUR'],
    ])('%s → %s', (country, expected) => {
      expect(defaultCurrencyForCountry(country)).toBe(expected);
    });
  });

  describe('getUkVatTaxCode (regression)', () => {
    it('maps 20 to standard', () => expect(getUkVatTaxCode(20)).toBe('20'));
    it('maps 5 to reduced', () => expect(getUkVatTaxCode(5)).toBe('5'));
    it('maps 0 to NON', () => expect(getUkVatTaxCode(0)).toBe('NON'));
  });
});
