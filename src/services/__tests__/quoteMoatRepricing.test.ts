/**
 * @jest-environment node
 *
 * PHOTO → QUOTE: the repricing layer
 *
 * The product claim is "photograph the job, get a quote priced from what you
 * actually paid". The vision model's judgement is the part nobody can unit-test
 * — but everything BETWEEN the model and the number a customer sees is testable,
 * and it had no tests at all.
 *
 * That gap mattered: the layer decides whether a stale scan can blow up a quote,
 * whether a low-confidence guess silently enters it, and whether repricing a
 * material can quietly delete the install labour. Those are the properties that
 * make the claim safe to charge for, so they are what this file pins.
 *
 * What remains untested after this is exactly one thing: whether the model reads
 * the photo well. That needs an API key and a real image.
 */

const mockCohort = jest.fn();
const mockScanIndex = jest.fn();

jest.mock('../pricingMoatService', () => ({
  applyCohortAdjustments: (...a: unknown[]) => mockCohort(...a),
}));
jest.mock('../invoiceScanService', () => ({
  getScannedUnitPriceIndex: () => mockScanIndex(),
}));

import { repriceQuoteLinesFromMoat, CONFIDENCE_GATE } from '../quoteMoatRepricing';

const OPTS = { trade: 'electrical', country: 'NL', userId: 'u1' };

/** Cohort layer passes lines through untouched unless a test says otherwise. */
function cohortPassthrough() {
  mockCohort.mockImplementation((lines: Array<Record<string, unknown>>) => ({
    lines: lines.map((l) => ({ ...l, adjustmentApplied: false, cohortContractors: 0 })),
  }));
}

const scan = (over: Record<string, unknown> = {}) => ({
  unitPrice: 2.0, unit: 'stuk', supplier: 'Rexel', samples: 3,
  lastObserved: '2026-08-01', ...over,
});

const line = (over: Record<string, unknown> = {}) => ({
  id: 'l1', description: 'YMvK kabel 3x2,5mm2', unit: 'stuk',
  suggestedQuantity: 10, suggestedPrice: 3.0, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  cohortPassthrough();
  mockScanIndex.mockResolvedValue(new Map());
});

describe('degrading safely', () => {
  it('returns an empty result for no lines rather than throwing', async () => {
    const r = await repriceQuoteLinesFromMoat([], OPTS);
    expect(r.items).toEqual([]);
    expect(r.summary.totalLines).toBe(0);
  });

  it('still produces a quote when the scan index is unavailable', async () => {
    // A contractor mid-quote must not lose the whole result because a
    // background price lookup failed.
    mockScanIndex.mockRejectedValue(new Error('offline'));
    const r = await repriceQuoteLinesFromMoat([line()], OPTS);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].suggestedPrice).toBe(3.0);
    expect(r.items[0].moatSource).toBe('ai');
  });
});

describe('the confidence gate — a guess must not enter a customer quote silently', () => {
  it(`flags a line below ${CONFIDENCE_GATE} for review`, async () => {
    const r = await repriceQuoteLinesFromMoat(
      [line({ confidence: CONFIDENCE_GATE - 1 })],
      OPTS,
    );
    expect(r.items[0].needsReview).toBe(true);
    expect(r.summary.lowConfidence).toBe(1);
  });

  it('does not flag a confident line', async () => {
    const r = await repriceQuoteLinesFromMoat([line({ confidence: 95 })], OPTS);
    expect(r.items[0].needsReview).toBe(false);
  });

  it('treats a missing confidence as certain, not as zero', async () => {
    // Absent ≠ 0. Defaulting to 0 would flag every line the model did not
    // score, training the contractor to click past the warning.
    const r = await repriceQuoteLinesFromMoat([line()], OPTS);
    expect(r.items[0].needsReview).toBe(false);
  });
});

describe('own scanned prices', () => {
  it('reprices from the price this contractor actually paid, and says which supplier', async () => {
    mockScanIndex.mockResolvedValue(new Map([['ymvk kabel 3x2,5mm2', scan({ unitPrice: 2.5 })]]));
    const r = await repriceQuoteLinesFromMoat([line({ suggestedPrice: 3.0 })], OPTS);
    expect(r.items[0].moatSource).toBe('scan');
    expect(r.items[0].scanSupplier).toBe('Rexel');
    expect(r.summary.scanRepriced).toBe(1);
  });

  it('caps how far a fuzzy match may move the price', async () => {
    // A mis-OCR'd or stale scan must not blow up a customer quote. Fuzzy
    // matches are capped at ±40%.
    mockScanIndex.mockResolvedValue(new Map([['ymvk kabel 3x2,5mm2', scan({ unitPrice: 100 })]]));
    const r = await repriceQuoteLinesFromMoat([line({ suggestedPrice: 3.0 })], OPTS);
    expect(r.items[0].suggestedPrice).toBeLessThanOrEqual(3.0 * 1.4 + 0.001);
  });

  it('will not reprice an m² line from a raw material price', async () => {
    // m²/m/uur/job lines bundle labour and area work, so a supplier material
    // price is the wrong anchor. Only discrete material units match fuzzily.
    mockScanIndex.mockResolvedValue(new Map([['stucwerk wand', scan({ unitPrice: 1.2 })]]));
    const r = await repriceQuoteLinesFromMoat(
      [line({ description: 'stucwerk wand', unit: 'm2', suggestedPrice: 28 })],
      OPTS,
    );
    expect(r.items[0].moatSource).toBe('ai');
    expect(r.items[0].suggestedPrice).toBe(28);
  });

  it('an exact EAN match may reprice a non-material unit — an identifier IS the product', async () => {
    mockScanIndex.mockResolvedValue(
      new Map([['x', scan({ unitPrice: 2.5, ean: '4006379012345' })]]),
    );
    const r = await repriceQuoteLinesFromMoat(
      [line({ description: 'totally different wording', unit: 'm', ean: '4006379012345' })],
      OPTS,
    );
    expect(r.items[0].moatSource).toBe('scan');
  });
});

describe('material/labour split — repricing must not delete the labour', () => {
  it('replaces only the material portion and preserves labour exactly', async () => {
    // The failure this guards: an EAN match silently strips the install labour
    // out of a line, and the contractor sends a quote that loses them money.
    mockScanIndex.mockResolvedValue(
      new Map([['x', scan({ unitPrice: 20, ean: '4006379012345' })]]),
    );
    const r = await repriceQuoteLinesFromMoat(
      [line({
        description: 'wandcontactdoos incl. montage',
        unit: 'stuk',
        suggestedPrice: 55,
        ean: '4006379012345',
        materialCostPerUnit: 25,
        laborCostPerUnit: 30,
      })],
      OPTS,
    );
    // material 20 (scanned) + labour 30 (untouched) = 50
    expect(r.items[0].suggestedPrice).toBe(50);
    expect(r.items[0].moatSource).toBe('scan');
  });
});

describe('the learning loop', () => {
  it('seeds the baseline from what was DISPLAYED, not from the raw AI number', async () => {
    // Downstream delta capture measures the contractor's edit against what they
    // were actually shown. Baselining the pre-moat value would attribute the
    // moat's own adjustment to the contractor and poison the training signal.
    mockCohort.mockImplementation((lines: Array<Record<string, unknown>>) => ({
      lines: lines.map((l) => ({
        ...l, unitPrice: 4.2, adjustmentApplied: true, cohortContractors: 7,
      })),
    }));
    const r = await repriceQuoteLinesFromMoat([line({ suggestedPrice: 3.0 })], OPTS);

    expect(r.items[0].suggestedPrice).toBe(4.2);
    expect(r.items[0].moatSource).toBe('cohort');
    expect(r.items[0].cohortContractors).toBe(7);
    expect(r.baselines.get('l1')).toEqual({ qty: 10, price: 4.2, source: 'cohort' });
  });
});
