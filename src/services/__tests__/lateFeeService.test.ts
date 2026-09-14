/**
 * @jest-environment node
 */

import {
  computeLateFee,
  disclosureLineLocalized,
  formatLateFeeRate,
  lateFeeCountry,
  lateFeeCustomerType,
} from '../lateFeeService';

describe('computeLateFee — EU Directive 2011/7/EU', () => {
  it('applies 10.4% (2.40% ECB + 8 points) to an NL B2B invoice', () => {
    const fee = computeLateFee({
      invoiceAmount: 1000,
      daysOverdue: 30,
      country: 'NL',
      customerType: 'business',
    });
    expect(fee.applicable).toBe(true);
    // The published NL wettelijke handelsrente from 2026-07-01 is 10,4%.
    expect(fee.effectiveRatePct).toBeCloseTo(10.4, 5);
    // 1000 * 0.104 * (30/365) = 8.55
    expect(fee.interest).toBeCloseTo(8.55, 2);
    expect(fee.recoveryFee).toBe(40);
    expect(fee.currency).toBe('EUR');
  });

  // The directive's 8 points is a floor. A flat 8 understated both of these.
  it('uses the transposed margin: DE Basiszinssatz + 9, FR ECB + 10', () => {
    const de = computeLateFee({ invoiceAmount: 1000, daysOverdue: 30, country: 'DE' });
    const fr = computeLateFee({ invoiceAmount: 1000, daysOverdue: 30, country: 'FR' });
    expect(de.marginPct).toBe(9);
    expect(de.effectiveRatePct).toBeCloseTo(10.52, 5); // Bundesbank: 10,52 % B2B
    expect(fr.marginPct).toBe(10);
    expect(fr.effectiveRatePct).toBeCloseTo(12.4, 5); // taux par défaut 12,40 %
  });

  it('uses 8 points for ES, IT and UK', () => {
    for (const country of ['ES', 'IT', 'UK'] as const) {
      expect(computeLateFee({ invoiceAmount: 1000, daysOverdue: 30, country }).marginPct).toBe(8);
    }
    expect(computeLateFee({ invoiceAmount: 1000, daysOverdue: 30, country: 'UK' }).effectiveRatePct)
      .toBeCloseTo(11.75, 5);
  });

  it('skips interest for consumer invoices', () => {
    const fee = computeLateFee({
      invoiceAmount: 1000,
      daysOverdue: 30,
      country: 'NL',
      customerType: 'consumer',
    });
    expect(fee.applicable).toBe(false);
    expect(fee.interest).toBe(0);
    expect(fee.recoveryFee).toBe(0);
    expect(fee.totalOwedIncludingFees).toBe(1000);
  });

  it('tiers UK recovery fee by invoice value (£40/£70/£100)', () => {
    expect(computeLateFee({ invoiceAmount: 500, daysOverdue: 30, country: 'UK' }).recoveryFee).toBe(40);
    expect(computeLateFee({ invoiceAmount: 5000, daysOverdue: 30, country: 'UK' }).recoveryFee).toBe(70);
    expect(computeLateFee({ invoiceAmount: 15000, daysOverdue: 30, country: 'UK' }).recoveryFee).toBe(100);
  });

  it('uses GBP for UK invoices', () => {
    const fee = computeLateFee({ invoiceAmount: 1000, daysOverdue: 30, country: 'UK' });
    expect(fee.currency).toBe('GBP');
  });

  it('returns non-applicable when daysOverdue < 1', () => {
    const fee = computeLateFee({ invoiceAmount: 1000, daysOverdue: 0, country: 'NL' });
    expect(fee.applicable).toBe(false);
  });

  it('honors base rate override (e.g. ECB rate moved)', () => {
    const fee = computeLateFee({
      invoiceAmount: 1000,
      daysOverdue: 365,
      country: 'NL',
      baseRatePctOverride: 3,
    });
    // (3 + 8) = 11% annualized on 1000 for full year = 110
    expect(fee.interest).toBeCloseTo(110, 0);
  });
});

describe('disclosureLineLocalized', () => {
  const fee = computeLateFee({ invoiceAmount: 1000, daysOverdue: 30, country: 'NL' });
  it.each(['en', 'nl', 'de', 'fr', 'es', 'it'] as const)('produces non-empty disclosure in %s', (locale) => {
    const line = disclosureLineLocalized(fee, locale);
    expect(line.length).toBeGreaterThan(20);
  });

  it('returns empty string when not applicable', () => {
    const consumer = computeLateFee({ invoiceAmount: 1000, daysOverdue: 30, country: 'NL', customerType: 'consumer' });
    expect(disclosureLineLocalized(consumer, 'nl')).toBe('');
  });

  // Seen on a device: "€64.93 … 12.50 %" in a French sentence beside "€ 866,67".
  it('formats amounts and the rate in the market, never with a decimal point', () => {
    const frFee = computeLateFee({ invoiceAmount: 5200, daysOverdue: 14, country: 'FR' });
    const line = disclosureLineLocalized(frFee, 'fr');
    expect(line).toContain('12,4 %');
    expect(line).not.toMatch(/\d\.\d/);
    expect(line).toMatch(/40,00/);
  });
});

describe('lateFeeCountry', () => {
  it('returns null for a market with no regime instead of defaulting to NL', () => {
    expect(lateFeeCountry('US')).toBeNull();
    expect(lateFeeCountry(undefined)).toBeNull();
    expect(lateFeeCountry('DE')).toBe('DE');
  });
});

describe('lateFeeCustomerType', () => {
  it('needs a VAT id as evidence of a business', () => {
    expect(lateFeeCustomerType({ vatId: 'NL123456789B01' }, 'NL')).toBe('business');
    expect(lateFeeCustomerType({ vatId: '  ' }, 'NL')).toBe('consumer');
    expect(lateFeeCustomerType({}, 'DE')).toBe('consumer');
    expect(lateFeeCustomerType(undefined, 'FR')).toBe('consumer');
  });

  // Facturae stores a private person's NIF in the same field.
  it('reads a Spanish NIF: entity letter = business, DNI/NIE = person', () => {
    expect(lateFeeCustomerType({ vatId: 'B12345678' }, 'ES')).toBe('business');
    expect(lateFeeCustomerType({ vatId: 'ESB12345678' }, 'ES')).toBe('business');
    expect(lateFeeCustomerType({ vatId: '12345678Z' }, 'ES')).toBe('consumer');
    expect(lateFeeCustomerType({ vatId: 'X1234567L' }, 'ES')).toBe('consumer');
  });
});

describe('formatLateFeeRate', () => {
  it('keeps the two decimals a statutory rate has, in the local format', () => {
    expect(formatLateFeeRate(10.52, 'DE')).toBe('10,52');
    expect(formatLateFeeRate(11.75, 'UK')).toBe('11.75');
    expect(formatLateFeeRate(10.4, 'NL')).toBe('10,4');
  });
});
