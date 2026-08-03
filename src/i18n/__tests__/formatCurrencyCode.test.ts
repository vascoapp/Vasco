// =============================================================================
// formatCurrencyCode / formatCurrency robustness
// =============================================================================
// formatCurrency takes a COUNTRY and derives the currency. Enterprise
// dashboards hold amounts already denominated in a currency, and passing that
// code into the country slot destructured undefined and threw, taking the
// screen down over a formatting detail.
// =============================================================================

import { formatCurrency, formatCurrencyCode } from '../formatting';

describe('currency formatting robustness', () => {
  it('does not throw when handed something that is not a Country', () => {
    expect(() => formatCurrency(1234, 'GBP' as any)).not.toThrow();
    expect(() => formatCurrency(1234, '' as any)).not.toThrow();
    expect(() => formatCurrency(1234, undefined as any)).not.toThrow();
  });

  it('formats an amount in the currency it is denominated in', () => {
    expect(formatCurrencyCode(1234.5, 'GBP')).toContain('£');
    expect(formatCurrencyCode(1234.5, 'EUR')).toContain('€');
    expect(formatCurrencyCode(1234.5, 'USD')).toContain('$');
  });

  it('keeps the viewer\'s separators while switching the currency', () => {
    // Dutch grouping with a pound sign: the money is GBP, the reader is NL.
    const nl = formatCurrencyCode(1234.5, 'GBP', 'NL');
    const uk = formatCurrencyCode(1234.5, 'GBP', 'UK');
    expect(nl).toContain('£');
    expect(uk).toContain('£');
    expect(nl).not.toBe(uk);
  });

  it('degrades to a readable string on a malformed code rather than throwing', () => {
    expect(() => formatCurrencyCode(10, 'NOTACURRENCY')).not.toThrow();
    expect(formatCurrencyCode(10, 'NOTACURRENCY')).toContain('10');
  });
});
