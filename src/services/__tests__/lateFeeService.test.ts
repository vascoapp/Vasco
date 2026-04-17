/**
 * @jest-environment node
 */

import { computeLateFee, disclosureLineLocalized } from '../lateFeeService';

describe('computeLateFee — EU Directive 2011/7/EU', () => {
  it('applies 12.5% (4.5% ECB + 8% margin) to NL B2B invoice', () => {
    const fee = computeLateFee({
      invoiceAmount: 1000,
      daysOverdue: 30,
      country: 'NL',
      customerType: 'business',
    });
    expect(fee.applicable).toBe(true);
    expect(fee.effectiveRatePct).toBe(12.5);
    // 1000 * 0.125 * (30/365) = 10.27
    expect(fee.interest).toBeCloseTo(10.27, 1);
    expect(fee.recoveryFee).toBe(40);
    expect(fee.currency).toBe('EUR');
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
});
