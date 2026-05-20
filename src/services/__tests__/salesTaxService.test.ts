import { applySalesTax, taxDisclosure, type SalesTaxBreakdown } from '../salesTaxService';

describe('salesTaxService', () => {
  describe('applySalesTax', () => {
    it('computes tax + total for a state-default rate', () => {
      const breakdown: SalesTaxBreakdown = { rate: 0.0625, source: 'state_default' };
      const { tax, total } = applySalesTax(1000, breakdown);
      expect(tax).toBe(62.5);
      expect(total).toBe(1062.5);
    });

    it('rounds tax to 2 decimals', () => {
      const breakdown: SalesTaxBreakdown = { rate: 0.0825, source: 'taxjar' };
      const { tax } = applySalesTax(123.45, breakdown);
      expect(tax).toBe(10.18); // 123.45 * 0.0825 = 10.184625 → round to 10.18
    });

    it('handles zero-rate (NH/OR/etc.)', () => {
      const breakdown: SalesTaxBreakdown = { rate: 0, source: 'state_default' };
      const { tax, total } = applySalesTax(500, breakdown);
      expect(tax).toBe(0);
      expect(total).toBe(500);
    });
  });

  describe('taxDisclosure', () => {
    it('credits TaxJar when source is taxjar', () => {
      const out = taxDisclosure({ rate: 0.0825, source: 'taxjar', jurisdiction: 'Austin · Travis · TX' });
      expect(out).toContain('8.25%');
      expect(out).toContain('Austin');
    });

    it('flags state default as warning', () => {
      const out = taxDisclosure({ rate: 0.0625, source: 'state_default' });
      expect(out).toContain('6.25%');
      expect(out).toContain('state default');
      expect(out.toLowerCase()).toContain('local rates may apply');
    });

    it('credits TaxJar from cache', () => {
      const out = taxDisclosure({ rate: 0.09, source: 'cache', jurisdiction: 'LA · CA' });
      expect(out).toContain('9%');
      expect(out).toContain('LA');
    });

    it('handles missing jurisdiction', () => {
      const out = taxDisclosure({ rate: 0.07, source: 'taxjar' });
      expect(out).toContain('7%');
      expect(out).not.toContain('()');
    });
  });
});
