/**
 * A benchmark the contractor may price against must not carry a provenance it
 * does not have.
 *
 * `getTradeBaselines` used to fall back twice: `TRADE_BASELINES[t] ??
 * TRADE_BASELINES.general` handed a roofer the general builder's hourly rate in
 * an object stamped `trade: 'roofing'`, and `tradeData[c] ?? tradeData.NL`
 * handed a German the DUTCH rate in an object stamped `country: 'DE'`.
 */
// jest.setup mocks this module globally (getTradeBaselines -> Promise<null>),
// so without this the assertions run against the stub and pass or fail for
// reasons that have nothing to do with the code. Its own comment says suites
// needing real behaviour must unmock explicitly.
jest.unmock('../cohortBenchmarkService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getTradeBaselines } = jest.requireActual('../cohortBenchmarkService');

describe('a baseline is labelled with what it actually is', () => {
  it('returns nothing for a trade with no baseline, rather than the general builder', () => {
    expect(getTradeBaselines('roofing', 'NL')).toEqual([]);
    expect(getTradeBaselines('glazing', 'DE')).toEqual([]);
  });

  it('still returns the real baseline for a covered trade', () => {
    const [nl] = getTradeBaselines('plumbing', 'NL');
    expect(nl).toBeDefined();
    expect(nl.trade).toBe('plumbing');
    expect(nl.country).toBe('NL');
    expect(nl.avgHourlyRate).toBeGreaterThan(0);
  });

  it('never returns one country\'s numbers under another country\'s label', () => {
    const [nl] = getTradeBaselines('plumbing', 'NL');
    const [de] = getTradeBaselines('plumbing', 'DE');
    // If DE had fallen back to NL these would be identical.
    expect(de.avgHourlyRate).not.toBe(nl.avgHourlyRate);
    expect(de.country).toBe('DE');
  });

  it('reports sampleSize 0 — a static baseline is not cohort evidence', () => {
    for (const b of getTradeBaselines('plumbing')) {
      expect(b.sampleSize).toBe(0);
    }
  });

  it('every returned row is self-consistent with what was asked for', () => {
    for (const b of getTradeBaselines(undefined, 'DE')) {
      expect(b.country).toBe('DE');
      expect(b.avgHourlyRate).toBeGreaterThan(0);
    }
  });
});
