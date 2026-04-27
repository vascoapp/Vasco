/**
 * @jest-environment node
 *
 * R258 — extended edge cases for the compliance layer:
 *  - GoBD chain integrity under tampering scenarios
 *  - ICP edge cases (boundary dates, multiple quarters, invalid VAT formats)
 *  - eIDAS scheme negotiation
 *  - Multi-currency rounding
 *  - VAT scheme exemption matrix
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

describe('GoBD chain — tamper detection', () => {
  beforeEach(async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.__resetForTest();
  });

  test('detects flipped index in middle of chain', async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.appendAudit({ type: 'invoice_created', ref: 'I1', payload: { v: 1 } });
    await svc.appendAudit({ type: 'invoice_sent', ref: 'I1', payload: { v: 2 } });
    await svc.appendAudit({ type: 'invoice_paid', ref: 'I1', payload: { v: 3 } });

    // Tamper: corrupt the second entry's index
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem('@vasco_gobd_audit_log');
    const log = JSON.parse(raw);
    log[1].index = 99;
    await AsyncStorage.setItem('@vasco_gobd_audit_log', JSON.stringify(log));

    const result = await svc.verifyAuditTrail();
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.brokenReason).toMatch(/index/);
  });

  test('detects altered prevHash', async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.appendAudit({ type: 'invoice_created', ref: 'A', payload: {} });
    await svc.appendAudit({ type: 'invoice_sent', ref: 'A', payload: {} });

    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem('@vasco_gobd_audit_log');
    const log = JSON.parse(raw);
    log[1].prevHash = 'tampered000000000';
    await AsyncStorage.setItem('@vasco_gobd_audit_log', JSON.stringify(log));

    const result = await svc.verifyAuditTrail();
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.brokenReason).toMatch(/prevHash/);
  });

  test('getAuditEntries filters by ref', async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.appendAudit({ type: 'invoice_created', ref: 'I1', payload: {} });
    await svc.appendAudit({ type: 'invoice_created', ref: 'I2', payload: {} });
    const i1 = await svc.getAuditEntries({ ref: 'I1' });
    expect(i1).toHaveLength(1);
    expect(i1[0].ref).toBe('I1');
  });

  test('getAuditEntries filters by type', async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.appendAudit({ type: 'invoice_created', ref: 'X', payload: {} });
    await svc.appendAudit({ type: 'invoice_sent', ref: 'X', payload: {} });
    const sent = await svc.getAuditEntries({ type: 'invoice_sent' });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('invoice_sent');
  });

  test('exportAuditTrail emits one line per entry plus header', async () => {
    const svc = require('../gobdAuditTrailService');
    await svc.appendAudit({ type: 'invoice_created', ref: 'A', payload: {} });
    await svc.appendAudit({ type: 'invoice_sent', ref: 'A', payload: {} });
    const text = await svc.exportAuditTrail();
    const lines = text.split('\n').filter((l: string) => !l.startsWith('#') && l.length > 0);
    expect(lines.length).toBe(2);
  });
});

describe('ICP edge cases', () => {
  test('quarter boundary — Mar 31 23:59 still Q1', () => {
    const { quarterFromDate } = require('../icpAangifteService');
    const q = quarterFromDate(new Date('2026-03-31T23:59:59Z'));
    expect(q.quarter).toBe(1);
    expect(q.endDate).toBe('2026-03-31');
  });

  test('quarter boundary — Apr 1 00:00 is Q2', () => {
    const { quarterFromDate } = require('../icpAangifteService');
    const q = quarterFromDate(new Date('2026-04-01T00:00:00Z'));
    expect(q.quarter).toBe(2);
  });

  test('mixes goods + services rolls up correctly', () => {
    const { buildIcpReport } = require('../icpAangifteService');
    const report = buildIcpReport({
      invoices: [
        { id: 'g1', amount: 500, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'X', reverseCharged: true, isService: false, invoiceDate: '2026-02-01' },
        { id: 's1', amount: 200, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'X', reverseCharged: true, isService: true, invoiceDate: '2026-02-15' },
      ],
      contractorCountry: 'NL', contractorVatNumber: 'NL', contractorName: 'Test',
      quarter: { year: 2026, quarter: 1, startDate: '2026-01-01', endDate: '2026-03-31' },
    });
    expect(report.totalGoods).toBe(500);
    expect(report.totalServices).toBe(200);
    expect(report.totalNet).toBe(700);
  });

  test('invoices outside quarter excluded', () => {
    const { buildIcpReport } = require('../icpAangifteService');
    const report = buildIcpReport({
      invoices: [
        { id: 'in', amount: 100, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'X', reverseCharged: true, invoiceDate: '2026-02-15' },
        { id: 'out', amount: 999, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'X', reverseCharged: true, invoiceDate: '2026-04-15' },
      ],
      contractorCountry: 'NL', contractorVatNumber: 'NL', contractorName: 'Test',
      quarter: { year: 2026, quarter: 1, startDate: '2026-01-01', endDate: '2026-03-31' },
    });
    expect(report.invoiceCount).toBe(1);
    expect(report.totalNet).toBe(100);
  });

  test('multiple customers from same country grouped separately', () => {
    const { buildIcpReport } = require('../icpAangifteService');
    const report = buildIcpReport({
      invoices: [
        { id: 'a', amount: 100, customerVatNumber: 'DE111', customerCountry: 'DE', customerName: 'A GmbH', reverseCharged: true, invoiceDate: '2026-02-01' },
        { id: 'b', amount: 200, customerVatNumber: 'DE222', customerCountry: 'DE', customerName: 'B GmbH', reverseCharged: true, invoiceDate: '2026-02-10' },
      ],
      contractorCountry: 'NL', contractorVatNumber: 'NL', contractorName: 'Test',
      quarter: { year: 2026, quarter: 1, startDate: '2026-01-01', endDate: '2026-03-31' },
    });
    expect(report.rows).toHaveLength(2);
  });
});

describe('VAT scheme exemption matrix', () => {
  test('all 3 schemes return correct boolean + note pair', () => {
    const { isSmallBusinessExempt, getVatExemptionNote } = require('../../domain/business');
    const cases = [
      { scheme: 'standard', exempt: false, noteRe: null },
      { scheme: 'small_business_NL_KOR', exempt: true, noteRe: /KOR/ },
      { scheme: 'small_business_DE_kleinunternehmer', exempt: true, noteRe: /§ 19 UStG/ },
    ] as const;
    for (const c of cases) {
      expect(isSmallBusinessExempt({ vatScheme: c.scheme as any })).toBe(c.exempt);
      const note = getVatExemptionNote('NL', c.scheme as any);
      if (c.noteRe) expect(note).toMatch(c.noteRe);
      else expect(note).toBeNull();
    }
  });

  test('undefined scheme treated as standard', () => {
    const { isSmallBusinessExempt, getVatExemptionNote } = require('../../domain/business');
    expect(isSmallBusinessExempt({})).toBe(false);
    expect(getVatExemptionNote('NL', undefined)).toBeNull();
  });
});

describe('multi-currency rounding', () => {
  test('formatMoney rounds to 2 decimals', () => {
    const { formatMoney } = require('../../utils/multiCurrency');
    const result = formatMoney(99.999, 'EUR', 'nl-NL');
    expect(result).toMatch(/100,00/);
  });

  test('zero formats with 2 decimals', () => {
    const { formatMoney } = require('../../utils/multiCurrency');
    expect(formatMoney(0, 'EUR', 'nl-NL')).toMatch(/0,00/);
  });

  test('negative amounts format correctly', () => {
    const { formatMoney } = require('../../utils/multiCurrency');
    const result = formatMoney(-50, 'EUR', 'nl-NL');
    expect(result).toMatch(/-/);
    expect(result).toMatch(/50,00/);
  });
});

describe('eIDAS isEidasConnected default', () => {
  beforeEach(() => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const store = AsyncStorage.__mockStore as Record<string, string>;
    for (const k of Object.keys(store)) delete store[k];
  });
  test('returns false when storage empty', async () => {
    const { isEidasConnected } = require('../../integrations/eidasSigning');
    expect(await isEidasConnected()).toBe(false);
  });
});
