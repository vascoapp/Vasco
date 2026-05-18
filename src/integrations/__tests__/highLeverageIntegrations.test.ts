/**
 * @jest-environment node
 *
 * R245 — verifies the 5 high-leverage integrations:
 *  - VIES VAT validation
 *  - Company lookup (KvK NL + Handelsregister DE)
 *  - Calendar sync (.ics export + config flow)
 *  - Banking reconciliation matcher
 *  - Lead marketplaces config storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;

describe('VIES VAT validation', () => {
  test('parses string with country prefix', async () => {
    const { validateVat } = require('../viesVatValidation');
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ valid: true, name: 'Test BV', address: 'Amsterdam', requestDate: '2026-04-26' }),
    } as any);
    const result = await validateVat('NL123456789B01');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('check-vat-number'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"countryCode":"NL"'),
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.name).toBe('Test BV');
    fetchSpy.mockRestore();
  });

  test('returns invalid on bad format', async () => {
    const { validateVat } = require('../viesVatValidation');
    const result = await validateVat('XX');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid VAT format/);
  });

  test('handles network error gracefully', async () => {
    const { validateVat } = require('../viesVatValidation');
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockRejectedValueOnce(new Error('network'));
    const result = await validateVat('NL123456789B01');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/network/);
    fetchSpy.mockRestore();
  });
});

describe('Company lookup', () => {
  test('KvK rejects non-8-digit numbers', async () => {
    const { lookupKvk } = require('../companyLookup');
    const result = await lookupKvk('123');
    expect(result.found).toBe(false);
    expect(result.error).toMatch(/8 digits/);
  });

  test('KvK reports missing API key', async () => {
    const { lookupKvk } = require('../companyLookup');
    const result = await lookupKvk('12345678');
    expect(result.found).toBe(false);
    expect(result.error).toMatch(/API key/);
  });

  test('Handelsregister parses OffeneRegister hits', async () => {
    const { lookupHandelsregister } = require('../companyLookup');
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hits: { hits: [{ _source: { name: 'Test GmbH', native_address: 'Berlin', address_postal_code: '10115' } }] },
      }),
    } as any);
    const result = await lookupHandelsregister('HRB12345');
    expect(result.found).toBe(true);
    expect(result.name).toBe('Test GmbH');
    expect(result.postcode).toBe('10115');
    fetchSpy.mockRestore();
  });
});

describe('Calendar sync', () => {
  test('generates valid RFC 5545 .ics', async () => {
    const { generateIcs } = require('../calendarSync');
    const ics = generateIcs({
      id: 'job-1',
      title: 'Plumbing repair — Smit',
      description: 'Replace boiler',
      startsAt: '2026-04-28T09:00:00.000Z',
      endsAt: '2026-04-28T11:00:00.000Z',
      location: 'Amsterdam',
    });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('UID:job-1@vascobuild.com');
    expect(ics).toContain('DTSTART:20260428T090000Z');
    expect(ics).toContain('DTEND:20260428T110000Z');
    expect(ics).toContain('SUMMARY:Plumbing repair — Smit');
    expect(ics).toContain('LOCATION:Amsterdam');
  });

  test('escapes special chars in summary', async () => {
    const { generateIcs } = require('../calendarSync');
    const ics = generateIcs({
      id: 'job-2',
      title: 'Bath, kitchen; storeroom',
      startsAt: '2026-04-28T09:00:00.000Z',
      endsAt: '2026-04-28T11:00:00.000Z',
    });
    expect(ics).toContain('SUMMARY:Bath\\, kitchen\\; storeroom');
  });

  test('isCalendarConnected returns false without config', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const { isCalendarConnected } = require('../calendarSync');
    expect(await isCalendarConnected()).toBe(false);
  });
});

describe('Banking reconciliation', () => {
  test('matches transaction by amount + IBAN', async () => {
    const { matchTransactionsToInvoices } = require('../banking');
    const matches = matchTransactionsToInvoices(
      [{
        id: 'tx-1', accountId: 'acc-1', amount: 1250.00, currency: 'EUR',
        date: '2026-04-26', description: 'Invoice INV-1',
        counterpartyName: 'Smit Bouw', counterpartyIban: 'NL91ABNA0417164300',
      }],
      [{ id: 'inv-1', amount: 1250.00, customerName: 'Smit Bouw', customerIban: 'NL91ABNA0417164300', sentAt: '2026-04-20' }],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].invoiceId).toBe('inv-1');
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.85);
    expect(matches[0].reasons).toContain('IBAN match');
  });

  test('skips outflows', async () => {
    const { matchTransactionsToInvoices } = require('../banking');
    const matches = matchTransactionsToInvoices(
      [{ id: 'tx-2', accountId: 'acc-1', amount: -100, currency: 'EUR', date: '2026-04-26', description: 'Supplier' }],
      [{ id: 'inv-1', amount: 100 }],
    );
    expect(matches).toHaveLength(0);
  });

  test('rejects matches below 0.5 confidence', async () => {
    const { matchTransactionsToInvoices } = require('../banking');
    const matches = matchTransactionsToInvoices(
      [{ id: 'tx-3', accountId: 'acc-1', amount: 1000, currency: 'EUR', date: '2026-04-26', description: 'something' }],
      [{ id: 'inv-1', amount: 1500 }],  // amount mismatch >2%
    );
    expect(matches).toHaveLength(0);
  });
});

describe('Lead marketplaces', () => {
  test('isLeadProviderConnected returns false without config', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const { isLeadProviderConnected } = require('../leadMarketplaces');
    expect(await isLeadProviderConnected('werkspot')).toBe(false);
  });

  test('submitQuote returns helpful error when not connected', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const { submitQuote } = require('../leadMarketplaces');
    const result = await submitQuote({
      leadId: 'l-1', provider: 'werkspot', amount: 500, message: 'hello', validUntil: '2026-05-01',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/werkspot not connected/i);
  });
});
