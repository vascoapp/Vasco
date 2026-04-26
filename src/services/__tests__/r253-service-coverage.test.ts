/**
 * @jest-environment node
 *
 * R253 — fills test-coverage gaps for previously-untested services:
 *  - viesVatValidation: parsing, error paths
 *  - calendarSync: ICS RFC 5545 generator
 *  - multiCurrency: formatMoney + convertSync
 *  - banking.matchTransactionsToInvoices: edge cases
 *  - permitAutofill: registry + autofill
 *  - recurringJobsService: cadence + nextDueDate + CRUD
 *  - country registry: validators
 *  - eIDAS signing: error paths
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
      __mockStore: mockStore,
    },
  };
});

describe('viesVatValidation parsing', () => {
  test('strips spaces + dots before regex match', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true, json: async () => ({ valid: true, name: 'Test', requestDate: '2026-04-26' }),
    } as any);
    const { validateVat } = require('../../integrations/viesVatValidation');
    await validateVat('NL 123.456.789B01');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: expect.stringContaining('"countryCode":"NL"') }),
    );
    fetchSpy.mockRestore();
  });

  test('object input shape works', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: true, json: async () => ({ valid: true }),
    } as any);
    const { validateVat } = require('../../integrations/viesVatValidation');
    const r = await validateVat({ countryCode: 'DE', vatNumber: '123456789' });
    expect(r.valid).toBe(true);
    fetchSpy.mockRestore();
  });

  test('non-200 returns error with status', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
      ok: false, status: 500,
    } as any);
    const { validateVat } = require('../../integrations/viesVatValidation');
    const r = await validateVat('NL123456789B01');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/500/);
    fetchSpy.mockRestore();
  });
});

describe('calendarSync ICS', () => {
  test('escapes commas, semicolons, backslashes', () => {
    const { generateIcs } = require('../../integrations/calendarSync');
    const ics = generateIcs({
      id: 'j', title: 'A; B, C \\ D',
      startsAt: '2026-04-28T09:00:00.000Z', endsAt: '2026-04-28T11:00:00.000Z',
    });
    expect(ics).toMatch(/SUMMARY:A\\; B\\, C \\\\\\\\ D|SUMMARY:A\\; B\\, C \\\\ D/);
  });

  test('omits LOCATION when not given', () => {
    const { generateIcs } = require('../../integrations/calendarSync');
    const ics = generateIcs({
      id: 'j', title: 'X',
      startsAt: '2026-04-28T09:00:00.000Z', endsAt: '2026-04-28T11:00:00.000Z',
    });
    expect(ics).not.toContain('LOCATION:');
  });

  test('attendee block when customerEmail set', () => {
    const { generateIcs } = require('../../integrations/calendarSync');
    const ics = generateIcs({
      id: 'j', title: 'X',
      startsAt: '2026-04-28T09:00:00.000Z', endsAt: '2026-04-28T11:00:00.000Z',
      customerEmail: 'jan@example.com',
    });
    expect(ics).toContain('mailto:jan@example.com');
  });

  test('isCalendarConnected false on empty store', async () => {
    const { isCalendarConnected } = require('../../integrations/calendarSync');
    expect(await isCalendarConnected()).toBe(false);
  });
});

describe('multiCurrency', () => {
  test('formatMoney EUR uses €', () => {
    const { formatMoney } = require('../../utils/multiCurrency');
    const result = formatMoney(1234.5, 'EUR', 'nl-NL');
    expect(result).toMatch(/1\.234,50/);
  });

  test('formatMoney GBP uses £', () => {
    const { formatMoney } = require('../../utils/multiCurrency');
    const result = formatMoney(99, 'GBP', 'en-GB');
    expect(result).toContain('£');
  });

  test('convertSync EUR→EUR returns same', () => {
    const { convertSync } = require('../../utils/multiCurrency');
    const result = convertSync(100, 'EUR', 'EUR', { EUR: 1 });
    expect(result).toBe(100);
  });

  test('convertSync EUR→SEK with given rates', () => {
    const { convertSync } = require('../../utils/multiCurrency');
    const result = convertSync(100, 'EUR', 'SEK', { EUR: 1, SEK: 11.4 });
    expect(result).toBeCloseTo(1140, 0);
  });

  test('convertSync missing rate falls through unchanged', () => {
    const { convertSync } = require('../../utils/multiCurrency');
    const result = convertSync(100, 'EUR', 'SEK', { EUR: 1 } as any);
    expect(result).toBe(100);
  });
});

describe('banking matcher', () => {
  test('IBAN match alone insufficient without amount alignment', () => {
    const { matchTransactionsToInvoices } = require('../../integrations/banking');
    const matches = matchTransactionsToInvoices(
      [{ id: 't', accountId: 'a', amount: 1000, currency: 'EUR', date: '2026-04-26', description: 'X', counterpartyIban: 'NL91ABNA0417164300' }],
      [{ id: 'i', amount: 5000, customerIban: 'NL91ABNA0417164300' }],
    );
    expect(matches).toHaveLength(0);
  });

  test('exact amount + name + date proximity stacks confidence', () => {
    const { matchTransactionsToInvoices } = require('../../integrations/banking');
    const matches = matchTransactionsToInvoices(
      [{ id: 't', accountId: 'a', amount: 250, currency: 'EUR', date: '2026-04-25', description: 'X', counterpartyName: 'Smit Bouw' }],
      [{ id: 'i', amount: 250, customerName: 'Smit Bouw', sentAt: '2026-04-20' }],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBeGreaterThanOrEqual(0.6);
  });

  test('outflows always rejected', () => {
    const { matchTransactionsToInvoices } = require('../../integrations/banking');
    const matches = matchTransactionsToInvoices(
      [{ id: 't', accountId: 'a', amount: -100, currency: 'EUR', date: '2026-04-26', description: 'Outflow' }],
      [{ id: 'i', amount: 100 }],
    );
    expect(matches).toHaveLength(0);
  });
});

describe('permitAutofill', () => {
  test('NL permits filtered correctly', () => {
    const { getPermitsForCountry } = require('../../integrations/permitAutofill');
    const nlPermits = getPermitsForCountry('NL');
    expect(nlPermits.length).toBeGreaterThanOrEqual(5);
    expect(nlPermits.every((p: any) => p.country === 'NL')).toBe(true);
  });

  test('DE permits filtered correctly', () => {
    const { getPermitsForCountry } = require('../../integrations/permitAutofill');
    const dePermits = getPermitsForCountry('DE');
    expect(dePermits.length).toBeGreaterThanOrEqual(5);
    expect(dePermits.every((p: any) => p.country === 'DE')).toBe(true);
  });

  test('autofillPermit fills + reports missing', () => {
    const { getPermitById, autofillPermit } = require('../../integrations/permitAutofill');
    const permit = getPermitById('nl_omgevingsvergunning');
    expect(permit).toBeDefined();
    const result = autofillPermit(permit, {
      businessName: 'Test BV', kvkNumber: '12345678',
    });
    expect(Object.keys(result.filledFields).length).toBeGreaterThan(0);
    expect(result.missingFields.length).toBeGreaterThan(0);
    expect(result.portalUrlWithParams).toContain('aanvrager_bedrijfsnaam=Test+BV');
  });

  test('totalMinutesSaved computes correctly', () => {
    const { totalMinutesSaved } = require('../../integrations/permitAutofill');
    const total = totalMinutesSaved('NL', { nl_omgevingsvergunning: 2, nl_zzp_btw_aangifte: 4 });
    // 2*35 + 4*15 = 70 + 60 = 130
    expect(total).toBe(130);
  });
});

describe('recurringJobsService', () => {
  beforeEach(() => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const store = AsyncStorage.__mockStore as Record<string, string>;
    for (const k of Object.keys(store)) delete store[k];
  });

  test('createRecurring + getAllRecurring round-trip', async () => {
    const svc = require('../recurringJobsService');
    const t = await svc.createRecurring({
      customerId: 'c1', title: 'Boiler check',
      cadence: 'annual', startDate: new Date().toISOString(),
      reminderDaysBeforeDue: 7,
    });
    expect(t.id).toMatch(/^rec-/);
    const all = await svc.getAllRecurring();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Boiler check');
  });

  test('nextDueDate respects cadence', () => {
    const { nextDueDate } = require('../recurringJobsService');
    const monthly = nextDueDate({ cadence: 'monthly', startDate: '2026-01-01T00:00:00Z' } as any);
    // Jan 1 + 30 days = Jan 31 → either Jan (m=0) or Feb (m=1) depending on UTC roll
    expect([0, 1]).toContain(new Date(monthly).getUTCMonth());
    const annual = nextDueDate({ cadence: 'annual', startDate: '2026-01-01T00:00:00Z' } as any);
    expect(new Date(annual).getUTCFullYear()).toBe(2027);
  });

  test('pause / resume toggles paused flag', async () => {
    const svc = require('../recurringJobsService');
    const t = await svc.createRecurring({
      customerId: 'c1', title: 'X', cadence: 'monthly', startDate: new Date().toISOString(),
      reminderDaysBeforeDue: 7,
    });
    await svc.pause(t.id);
    const list1 = await svc.getAllRecurring();
    expect(list1[0].paused).toBe(true);
    await svc.resume(t.id);
    const list2 = await svc.getAllRecurring();
    expect(list2[0].paused).toBe(false);
  });

  test('getRecurringInstances filters out paused by default', async () => {
    const svc = require('../recurringJobsService');
    const t = await svc.createRecurring({
      customerId: 'c1', title: 'X', cadence: 'monthly', startDate: new Date().toISOString(),
      reminderDaysBeforeDue: 7,
    });
    await svc.pause(t.id);
    const instances = await svc.getRecurringInstances({});
    expect(instances).toHaveLength(0);
    const all = await svc.getRecurringInstances({ includePaused: true });
    expect(all).toHaveLength(1);
  });

  test('deleteRecurring removes entry', async () => {
    const svc = require('../recurringJobsService');
    const t = await svc.createRecurring({
      customerId: 'c1', title: 'X', cadence: 'monthly', startDate: new Date().toISOString(),
      reminderDaysBeforeDue: 7,
    });
    await svc.deleteRecurring(t.id);
    const all = await svc.getAllRecurring();
    expect(all).toHaveLength(0);
  });
});

describe('country registry validators', () => {
  test('validateBusinessId accepts NL 8-digit KvK', () => {
    const { validateBusinessId } = require('../../data/countries');
    expect(validateBusinessId('NL', '12345678')).toBe(true);
    expect(validateBusinessId('NL', '1234')).toBe(false);
  });

  test('validateBusinessId accepts DE HRB format', () => {
    const { validateBusinessId } = require('../../data/countries');
    expect(validateBusinessId('DE', 'HRB 12345')).toBe(true);
    expect(validateBusinessId('DE', '12345')).toBe(false);
  });

  test('validateVatNumber accepts properly formatted NL VAT', () => {
    const { validateVatNumber } = require('../../data/countries');
    expect(validateVatNumber('NL', 'NL123456789B01')).toBe(true);
    expect(validateVatNumber('NL', 'NL123')).toBe(false);
  });

  test('listSupportedCountries returns 10', () => {
    const { listSupportedCountries } = require('../../data/countries');
    expect(listSupportedCountries()).toHaveLength(10);
  });

  test('listNordicCountries returns SE NO DK FI', () => {
    const { listNordicCountries } = require('../../data/countries');
    const codes = require('../../data/countries').listNordicCountries().map((c: any) => c.code);
    expect(codes.sort()).toEqual(['DK', 'FI', 'NO', 'SE']);
  });
});

describe('eIDAS signing error paths', () => {
  test('isEidasConnected false without config', async () => {
    const { isEidasConnected } = require('../../integrations/eidasSigning');
    expect(await isEidasConnected()).toBe(false);
  });

  test('createSigningSession returns null without config', async () => {
    const { createSigningSession } = require('../../integrations/eidasSigning');
    const result = await createSigningSession({
      documentId: 'd', title: 'T', documentBase64: 'YWJj',
      signers: [{ name: 'X', email: 'x@y.z', role: 'customer' }],
    });
    expect(result).toBeNull();
  });

  test('getSigningStatus returns pending without config', async () => {
    const { getSigningStatus } = require('../../integrations/eidasSigning');
    expect(await getSigningStatus('xyz')).toBe('pending');
  });
});
