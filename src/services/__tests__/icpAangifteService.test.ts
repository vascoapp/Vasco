/**
 * @jest-environment node
 */

import {
  quarterFromDate,
  isIcpEligible,
  buildIcpReport,
  formatIcpReport,
} from '../icpAangifteService';

describe('quarterFromDate', () => {
  test('Q1 boundaries', () => {
    expect(quarterFromDate(new Date('2026-01-01T00:00:00Z'))).toMatchObject({
      year: 2026, quarter: 1, startDate: '2026-01-01', endDate: '2026-03-31',
    });
    expect(quarterFromDate(new Date('2026-03-31T23:59:59Z'))).toMatchObject({
      year: 2026, quarter: 1, startDate: '2026-01-01', endDate: '2026-03-31',
    });
  });
  test('Q4', () => {
    expect(quarterFromDate(new Date('2026-12-15T00:00:00Z'))).toMatchObject({
      year: 2026, quarter: 4, startDate: '2026-10-01', endDate: '2026-12-31',
    });
  });
});

describe('isIcpEligible', () => {
  const base = { id: 'i1', amount: 1000, customerName: 'X' };

  test('NL→DE B2B with reverse charge — eligible', () => {
    expect(isIcpEligible({ ...base, customerVatNumber: 'DE123456789', customerCountry: 'DE', reverseCharged: true }, 'NL')).toBe(true);
  });
  test('NL→NL — same country, not eligible', () => {
    expect(isIcpEligible({ ...base, customerVatNumber: 'NL123456789B01', customerCountry: 'NL', reverseCharged: true }, 'NL')).toBe(false);
  });
  test('NL→US — non-EU, not eligible', () => {
    expect(isIcpEligible({ ...base, customerVatNumber: 'US-123', customerCountry: 'US', reverseCharged: true }, 'NL')).toBe(false);
  });
  test('NL→DE without VAT number — not eligible', () => {
    expect(isIcpEligible({ ...base, customerCountry: 'DE', reverseCharged: true }, 'NL')).toBe(false);
  });
  test('NL→DE with VAT charged — not eligible (would be domestic VAT case)', () => {
    expect(isIcpEligible({ ...base, customerVatNumber: 'DE123456789', customerCountry: 'DE', vatAmount: 210, reverseCharged: false }, 'NL')).toBe(false);
  });
});

describe('buildIcpReport', () => {
  test('aggregates goods + services per VAT-number', () => {
    const q = { year: 2026, quarter: 1 as const, startDate: '2026-01-01', endDate: '2026-03-31' };
    const report = buildIcpReport({
      invoices: [
        { id: 'i1', amount: 1000, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'Mueller GmbH', reverseCharged: true, isService: false, invoiceDate: '2026-02-01' },
        { id: 'i2', amount: 500, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'Mueller GmbH', reverseCharged: true, isService: true, invoiceDate: '2026-03-15' },
        { id: 'i3', amount: 300, customerVatNumber: 'BE222', customerCountry: 'BE', customerName: 'Janssens NV', reverseCharged: true, isService: false, invoiceDate: '2026-01-10' },
        // Out of quarter — should not count
        { id: 'i4', amount: 999, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'Mueller GmbH', reverseCharged: true, invoiceDate: '2026-04-01' },
        // Domestic — should not count
        { id: 'i5', amount: 200, customerVatNumber: 'NL333B01', customerCountry: 'NL', customerName: 'NL Customer', reverseCharged: true, invoiceDate: '2026-02-20' },
      ],
      contractorCountry: 'NL',
      contractorVatNumber: 'NL000000000B01',
      contractorName: 'Test BV',
      quarter: q,
    });

    expect(report.invoiceCount).toBe(3);
    expect(report.totalGoods).toBe(1300);
    expect(report.totalServices).toBe(500);
    expect(report.totalNet).toBe(1800);
    expect(report.rows).toHaveLength(2);
    const de = report.rows.find((r) => r.customerCountry === 'DE')!;
    expect(de.totalGoods).toBe(1000);
    expect(de.totalServices).toBe(500);
    expect(de.invoiceCount).toBe(2);
  });

  test('warns when contractor is on small-business scheme', () => {
    const q = { year: 2026, quarter: 1 as const, startDate: '2026-01-01', endDate: '2026-03-31' };
    const report = buildIcpReport({
      invoices: [],
      contractorCountry: 'NL', contractorVatNumber: 'NL', contractorName: 'X',
      vatScheme: 'small_business_NL_KOR',
      quarter: q,
    });
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings[0]).toMatch(/small-business/);
  });
});

describe('formatIcpReport', () => {
  test('produces a parseable plain-text summary', () => {
    const q = { year: 2026, quarter: 1 as const, startDate: '2026-01-01', endDate: '2026-03-31' };
    const report = buildIcpReport({
      invoices: [
        { id: 'i1', amount: 1000, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'Mueller GmbH', reverseCharged: true, invoiceDate: '2026-02-01' },
      ],
      contractorCountry: 'NL', contractorVatNumber: 'NL000000000B01', contractorName: 'Test BV',
      quarter: q,
    });
    const text = formatIcpReport(report);
    expect(text).toContain('ICP-aangifte 2026 Q1');
    expect(text).toContain('NL000000000B01');
    expect(text).toContain('DE DE111');
    expect(text).toContain('€1000.00');
  });
});

describe('isSmallBusinessExempt + getVatExemptionNote', () => {
  test('KOR returns Dutch note', () => {
    const { isSmallBusinessExempt, getVatExemptionNote } = require('../../domain/business');
    expect(isSmallBusinessExempt({ vatScheme: 'small_business_NL_KOR' })).toBe(true);
    expect(getVatExemptionNote('NL', 'small_business_NL_KOR')).toMatch(/KOR/);
  });
  test('Kleinunternehmer returns German note', () => {
    const { isSmallBusinessExempt, getVatExemptionNote } = require('../../domain/business');
    expect(isSmallBusinessExempt({ vatScheme: 'small_business_DE_kleinunternehmer' })).toBe(true);
    expect(getVatExemptionNote('DE', 'small_business_DE_kleinunternehmer')).toMatch(/§ 19 UStG/);
  });
  test('standard returns null', () => {
    const { isSmallBusinessExempt, getVatExemptionNote } = require('../../domain/business');
    expect(isSmallBusinessExempt({ vatScheme: 'standard' })).toBe(false);
    expect(getVatExemptionNote('NL', 'standard')).toBeNull();
  });
});

describe('defaultPaymentMethodsForCountry', () => {
  test('NL prefers iDEAL', () => {
    const { defaultPaymentMethodsForCountry } = require('../../integrations/mollie');
    expect(defaultPaymentMethodsForCountry('NL')?.[0]).toBe('ideal');
  });
  test('DE prefers Sofort', () => {
    const { defaultPaymentMethodsForCountry } = require('../../integrations/mollie');
    expect(defaultPaymentMethodsForCountry('DE')?.[0]).toBe('sofort');
  });
  test('BE prefers Bancontact', () => {
    const { defaultPaymentMethodsForCountry } = require('../../integrations/mollie');
    expect(defaultPaymentMethodsForCountry('BE')?.[0]).toBe('bancontact');
  });
  test('Nordics prefer Klarna', () => {
    const { defaultPaymentMethodsForCountry } = require('../../integrations/mollie');
    expect(defaultPaymentMethodsForCountry('SE')?.[0]).toBe('klarnapaylater');
  });
  test('unknown country returns undefined', () => {
    const { defaultPaymentMethodsForCountry } = require('../../integrations/mollie');
    expect(defaultPaymentMethodsForCountry('XX')).toBeUndefined();
  });
});
