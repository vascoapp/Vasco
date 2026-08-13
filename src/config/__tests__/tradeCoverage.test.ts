/**
 * Trade-keyed tables rot silently as the trade list grows.
 *
 * The app went from 6 trades to 15. Every table typed `Record<string, X>`
 * stayed at its original 6 and fell back to `general` — so a roofer got the
 * general builder's consumables and a gas engineer got the general shopping
 * list, with nothing anywhere saying so. The ONE table typed `Record<Trade, X>`
 * (TRADE_CONFIGS) stayed complete, because the compiler refused to let it
 * drift. That is the whole lesson: type the table against the union.
 *
 * Completeness of the tables themselves is now enforced by tsc. What tsc cannot
 * check is the narrowing at the call site, which is what these cover.
 */
import { TRADE_CONFIGS, getTradeConfig, toTrade, type Trade } from '../tradeFeatures';

const ALL_TRADES = Object.keys(TRADE_CONFIGS) as Trade[];

describe('trade coverage', () => {
  it('has a config for every trade in the union', () => {
    expect(ALL_TRADES.length).toBeGreaterThanOrEqual(15);
    for (const t of ['roofing', 'tiling', 'solar', 'glazing', 'landscaping'] as Trade[]) {
      expect(ALL_TRADES).toContain(t);
    }
  });

  it('toTrade passes every known trade through unchanged', () => {
    for (const t of ALL_TRADES) expect(toTrade(t)).toBe(t);
  });

  it('toTrade falls back to general for unknown, empty or missing input', () => {
    // The fallback has to stay total: `trade` reaches these tables as free text
    // from the user profile, so anything can arrive.
    expect(toTrade('underwater-basket-weaving')).toBe('general');
    expect(toTrade('')).toBe('general');
    expect(toTrade(undefined)).toBe('general');
    expect(toTrade(null)).toBe('general');
  });

  it('never returns an undefined config, for any trade or for junk', () => {
    for (const t of ALL_TRADES) expect(getTradeConfig(t)).toBeDefined();
    expect(getTradeConfig('nonsense')).toBeDefined();
    expect(getTradeConfig(undefined)).toBeDefined();
  });
});
