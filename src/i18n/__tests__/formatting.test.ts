// =============================================================================
// FORMATTING — Unit Tests
// =============================================================================
// Tests currency formatting for EUR/GBP, date formatting across locales,
// number formatting, and country config lookups.
// =============================================================================

import {
  formatCurrency,
  formatDate,
  formatDateShort,
  formatNumber,
  getCountryConfig,
  getDefaultLanguage,
  Country,
} from '../formatting';

describe('formatting', () => {
  // ─── formatCurrency ───────────────────────────────────────────────────────

  describe('formatCurrency', () => {
    it('should format EUR for NL with comma decimal separator', () => {
      const result = formatCurrency(1234.56, 'NL');
      // Dutch format: € 1.234,56 (various spacing/symbol variants)
      expect(result).toContain('1.234');
      expect(result).toContain('56');
    });

    it('should format GBP for UK with pound symbol', () => {
      const result = formatCurrency(1234.56, 'UK');
      expect(result).toContain('£');
      expect(result).toContain('1,234.56');
    });

    it('should format EUR for DE', () => {
      const result = formatCurrency(999.99, 'DE');
      // German: 999,99 €
      expect(result).toContain('999');
      expect(result).toContain('99');
    });

    it('should format EUR for FR', () => {
      const result = formatCurrency(2500, 'FR');
      // French: 2 500,00 €
      expect(result).toContain('2');
      expect(result).toContain('500');
    });

    it('should format zero correctly', () => {
      const result = formatCurrency(0, 'NL');
      expect(result).toContain('0');
    });

    it('should format negative amounts', () => {
      const result = formatCurrency(-150.5, 'NL');
      expect(result).toContain('150');
    });

    it('should always use 2 decimal places', () => {
      const result = formatCurrency(100, 'UK');
      expect(result).toContain('100.00');
    });

    it('should format EUR for ES', () => {
      // Use ≥10000 so thousands separator is guaranteed across Node ICU
      // variants (ES/IT omit separator on 4-digit numbers in some datasets).
      const result = formatCurrency(10000, 'ES');
      expect(result).toContain('10.000');
    });

    it('should format EUR for IT', () => {
      const result = formatCurrency(10000, 'IT');
      expect(result).toContain('10.000');
    });
  });

  // ─── formatDate ───────────────────────────────────────────────────────────

  describe('formatDate', () => {
    const testDate = new Date('2026-03-15T12:00:00Z');

    it('should format long date for NL', () => {
      const result = formatDate(testDate, 'NL');
      expect(result).toContain('15');
      expect(result).toContain('2026');
      // Should contain Dutch month name (maart)
      expect(result.toLowerCase()).toContain('maart');
    });

    it('should format long date for UK', () => {
      const result = formatDate(testDate, 'UK');
      expect(result).toContain('15');
      expect(result).toContain('2026');
      expect(result).toContain('March');
    });

    it('should format long date for DE', () => {
      const result = formatDate(testDate, 'DE');
      expect(result).toContain('15');
      expect(result).toContain('2026');
      expect(result.toLowerCase()).toContain('märz');
    });

    it('should format long date for FR', () => {
      const result = formatDate(testDate, 'FR');
      expect(result).toContain('15');
      expect(result).toContain('2026');
      expect(result.toLowerCase()).toContain('mars');
    });

    it('should accept string dates', () => {
      const result = formatDate('2026-06-01', 'NL');
      expect(result).toContain('2026');
    });
  });

  // ─── formatDateShort ──────────────────────────────────────────────────────

  describe('formatDateShort', () => {
    it('should produce shorter output than formatDate', () => {
      const long = formatDate(new Date('2026-03-15'), 'NL');
      const short = formatDateShort(new Date('2026-03-15'), 'NL');
      // Short month name should generally be shorter
      expect(short.length).toBeLessThanOrEqual(long.length);
    });

    it('should still contain day and year', () => {
      const result = formatDateShort(new Date('2026-12-25'), 'UK');
      expect(result).toContain('25');
      expect(result).toContain('2026');
    });
  });

  // ─── formatNumber ─────────────────────────────────────────────────────────

  describe('formatNumber', () => {
    it('should format with locale-specific thousand separators for NL', () => {
      const result = formatNumber(12345, 'NL');
      expect(result).toContain('12');
      expect(result).toContain('345');
    });

    it('should format with comma separators for UK', () => {
      const result = formatNumber(12345, 'UK');
      expect(result).toBe('12,345');
    });
  });

  // ─── getCountryConfig ─────────────────────────────────────────────────────

  describe('getCountryConfig', () => {
    it('should return EUR for all EU countries', () => {
      const euCountries: Country[] = ['NL', 'DE', 'FR', 'ES', 'IT'];
      for (const country of euCountries) {
        expect(getCountryConfig(country).currency).toBe('EUR');
      }
    });

    it('should return GBP for UK', () => {
      expect(getCountryConfig('UK').currency).toBe('GBP');
    });

    it('should return correct locale codes', () => {
      expect(getCountryConfig('NL').locale).toBe('nl-NL');
      expect(getCountryConfig('DE').locale).toBe('de-DE');
      expect(getCountryConfig('FR').locale).toBe('fr-FR');
      expect(getCountryConfig('UK').locale).toBe('en-GB');
    });
  });

  // ─── getDefaultLanguage ───────────────────────────────────────────────────

  describe('getDefaultLanguage', () => {
    it('should map each country to its language', () => {
      expect(getDefaultLanguage('UK')).toBe('en');
      expect(getDefaultLanguage('NL')).toBe('nl');
      expect(getDefaultLanguage('DE')).toBe('de');
      expect(getDefaultLanguage('FR')).toBe('fr');
      expect(getDefaultLanguage('ES')).toBe('es');
      expect(getDefaultLanguage('IT')).toBe('it');
    });
  });
});
