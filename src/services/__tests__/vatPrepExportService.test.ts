/**
 * @jest-environment node
 */

jest.mock('react-native', () => ({
  Share: { share: jest.fn(async () => ({ action: 'sharedAction' })) },
  Linking: {
    canOpenURL: jest.fn(async () => true),
    openURL: jest.fn(async () => undefined),
  },
}));
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: '/tmp/fake.pdf' })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

import { formatSummary, shareSummary, sharePdf, openDigiD } from '../vatPrepExportService';
import type { VatReturnDraft } from '../vatPrepService';

const draft: VatReturnDraft = {
  country: 'NL',
  period: '2026-Q1',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  currency: 'EUR',
  lines: [],
  rubriek_1a: { net: 10000, vat: 2100 },
  rubriek_1b: { net: 500, vat: 45 },
  rubriek_1c: { net: 0, vat: 0 },
  rubriek_2a: { net: 0, vat: 0 },
  rubriek_3a: { net: 0, vat: 0 },
  rubriek_3b: { net: 0, vat: 0 },
  rubriek_4a: { net: 0, vat: 0 },
  rubriek_5b: { net: 800, vat: 168 },
  rollups: {
    rubriek_1a: { net: 10000, vat: 2100 },
    rubriek_1b: { net: 500, vat: 45 },
    rubriek_1c: { net: 0, vat: 0 },
    rubriek_2a: { net: 0, vat: 0 },
    rubriek_3a: { net: 0, vat: 0 },
    rubriek_3b: { net: 0, vat: 0 },
    rubriek_4a: { net: 0, vat: 0 },
    rubriek_5b: { net: 800, vat: 168 },
  },
  totalOutputVat: 2145,
  totalInputVat: 168,
  netPayable: 1977,
  lowConfidenceLines: 2,
  yoyVariancePct: 12.5,
  warnings: ['9%-regime alleen geldig als woning >2 jaar oud'],
  generatedAt: '2026-04-17T10:00:00Z',
};

describe('formatSummary', () => {
  it('includes period, totals, and warnings', () => {
    const txt = formatSummary(draft, 'De Vries Installatie');
    expect(txt).toContain('BTW-aangifte — 2026-Q1');
    expect(txt).toContain('De Vries Installatie');
    expect(txt).toContain('1a (21%)');
    expect(txt).toContain('2a (verlegd)');
    expect(txt).toContain('Te betalen/terug');
    expect(txt).toContain('9%-regime'); // warning passed through
    expect(txt).toContain('YoY variatie');
    expect(txt).toContain('2 regels met lage zekerheid'); // low-conf note
  });

  it('omits low-confidence note when zero', () => {
    const cleanDraft = { ...draft, lowConfidenceLines: 0, warnings: [] };
    const txt = formatSummary(cleanDraft, 'Test BV');
    expect(txt).not.toContain('regels met lage zekerheid');
    expect(txt).not.toContain('Waarschuwingen');
  });

  it('omits YoY line when variance is null', () => {
    const noYoy = { ...draft, yoyVariancePct: null };
    const txt = formatSummary(noYoy, 'Test BV');
    expect(txt).not.toContain('YoY variatie');
  });
});

describe('shareSummary', () => {
  it('calls Share.share with the formatted summary', async () => {
    const { Share } = require('react-native');
    await shareSummary(draft, 'Test BV');
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('BTW-aangifte'),
        title: 'BTW-aangifte 2026-Q1',
      }),
    );
  });
});

describe('sharePdf', () => {
  it('prints HTML to a file and hands it to Sharing.shareAsync', async () => {
    const Print = require('expo-print');
    const Sharing = require('expo-sharing');
    await sharePdf(draft, 'Test BV');
    expect(Print.printToFileAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledWith('/tmp/fake.pdf', expect.any(Object));
  });
});

describe('openDigiD', () => {
  it('returns true and calls Linking.openURL when supported', async () => {
    const { Linking } = require('react-native');
    const ok = await openDigiD();
    expect(ok).toBe(true);
    expect(Linking.openURL).toHaveBeenCalled();
  });

  it('returns false when the URL is not supported', async () => {
    const { Linking } = require('react-native');
    Linking.canOpenURL.mockResolvedValueOnce(false);
    const ok = await openDigiD();
    expect(ok).toBe(false);
  });
});
