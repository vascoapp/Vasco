/**
 * @jest-environment node
 */
// The recursive-learning sweep (#355). Three loops that ran, wrote, and taught
// the model something false — worse than a loop that never turned, because the
// output is presented to the contractor as a measurement of their business.
//
//  • quote_win recorded ACCEPTANCES ONLY. `calibrateModels` averages `actual`
//    into `personalAcceptanceRate`, so after 10 accepted quotes it reached 1.0
//    and `predictQuoteWin` fed it back as `baseRate` — a 100% win rate shown to
//    every contractor who had never lost a quote *that the app recorded*.
//  • payment trained on `predicted = 14` (a literal, never the model's output)
//    and `actual = 14 - dueInDays`, which measures the PAYMENT TERM rather than
//    how long the customer took. `personalBaseDSO` learned the contractor's own
//    invoice terms back.
//  • `pricing_intelligence` rows were inserted with no `quote_id` while every
//    outcome writer keys on `.eq('quote_id', …)`, so every outcome UPDATE
//    matched zero rows and the cohort model had no labelled data at all.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const APPSTATE = read('src/state/AppState.tsx');
const MLMODELS = read('src/intelligence/mlModels.ts');
const COLLECTOR = read('src/intelligence/dataCollector.ts');

describe('a quote outcome is recorded whichever way it went', () => {
  it('both outcomes go through one chokepoint', () => {
    // A rule that lives in two call sites is a rule one of them will forget —
    // which is exactly what happened: the accept branch existed for months and
    // the reject branch was never written.
    expect(MLMODELS).toMatch(/export async function recordQuoteWinOutcome\(/);
  });

  it('AppState records the acceptance AND the rejection', () => {
    const accepted = [...APPSTATE.matchAll(/recordQuoteWinOutcome\(quote, true,/g)];
    const rejected = [...APPSTATE.matchAll(/recordQuoteWinOutcome\(quote, false,/g)];
    expect({ accepted: accepted.length, rejected: rejected.length })
      .toEqual({ accepted: 1, rejected: 1 });
  });

  it('nothing records a quote_win outcome with a hardcoded pair', () => {
    // The original defect, verbatim: `recordModelPrediction('quote_win', 0.5, 1)`.
    // Any literal probability here is a fabricated prediction.
    expect(APPSTATE).not.toMatch(/recordModelPrediction\(\s*'quote_win'/);
    expect(MLMODELS).toMatch(/recordModelPrediction\('quote_win', prediction\.probability, accepted \? 1 : 0\)/);
  });

  it('the probability recorded is the model\'s own, not a constant', () => {
    const at = MLMODELS.indexOf('export async function recordQuoteWinOutcome');
    expect(at).toBeGreaterThan(-1);
    const body = MLMODELS.slice(at, MLMODELS.indexOf('\n}', at));
    expect(body).toMatch(/await predictQuoteWin\(/);
  });

  it('a dropped outcome is reported, never swallowed', () => {
    // #353: a silently dropped rejection is how the acceptance rate drifts
    // back toward 1.0 with nothing in the logs to say why.
    const at = MLMODELS.indexOf('export async function recordQuoteWinOutcome');
    const body = MLMODELS.slice(at, MLMODELS.indexOf('\n}', at));
    expect(body).toMatch(/logWarn\(/);
    expect(body).not.toMatch(/\} catch \{\s*$/m);
  });
});

describe('days-to-pay is measured, not assumed', () => {
  it('the fabricated constant and the term-derived actual are both gone', () => {
    expect(APPSTATE).not.toMatch(/const predictedDays = 14;/);
    expect(APPSTATE).not.toMatch(/const actualDays = Math\.max\(0, 14 - \(paidInv\?\.dueInDays \?\? 0\)\);/);
    // `dueInDays` describes the TERM. It must not be the basis of the actual.
    expect(APPSTATE).not.toMatch(/actualDays = [^;]*dueInDays/);
  });

  it('the interval runs from issue to payment', () => {
    expect(APPSTATE).toMatch(/const issuedAtIso = paidInv\?\.sentAt \?\? paidInv\?\.createdAt;/);
    expect(APPSTATE).toMatch(/const actualDays = Math\.max\(0, Math\.round\(\(Date\.now\(\) - issuedAtMs\) \/ 86_400_000\)\);/);
  });

  it('an invoice with no issue date records nothing rather than a guess', () => {
    // The repo's own rule for an unknown input: skip, never default. A
    // fabricated 0 or 14 here moves personalBaseDSO for everyone.
    expect(APPSTATE).toMatch(/if \(Number\.isFinite\(issuedAtMs\)\) \{/);
  });

  it('the predicted value is the predictor\'s output', () => {
    expect(APPSTATE).toMatch(/const prediction = await ml\.predictPaymentTiming\(\{/);
    expect(APPSTATE).toMatch(/ml\.recordModelPrediction\('payment', prediction\.predictedDays, actualDays\)/);
  });
});

describe('a priced line knows which quote it belongs to', () => {
  it('the collector accepts and writes quote_id', () => {
    expect(COLLECTOR).toMatch(/quoteId\?: string;/);
    expect(COLLECTOR).toMatch(/if \(data\.quoteId !== undefined\) row\.quote_id = data\.quoteId;/);
  });

  it('the quote path passes the document number, which is the quote id', () => {
    // AppState stamps `id: docNumber` on the Quote, and every outcome writer
    // keys on that same value — `.eq('quote_id', id)`. Threading anything else
    // (a temp id, a row uuid) silently matches nothing.
    const at = APPSTATE.indexOf('recordPricingData(getCurrentUserId(), {');
    expect(at).toBeGreaterThan(-1);
    const body = APPSTATE.slice(at, APPSTATE.indexOf('});', at));
    expect(body).toMatch(/quoteId: docNumber,/);
  });

  it('the quote still carries the document number as its id', () => {
    // If this ever stops being true, `quoteId: docNumber` stops matching the
    // outcome writers and this whole loop silently breaks again.
    expect(APPSTATE).toMatch(/const newQuote: Quote = \{\s*\n\s*id: docNumber,/);
  });

  it('every outcome writer keys on the field the insert now sets', () => {
    expect(COLLECTOR).toMatch(/\.eq\('quote_id', quoteId\)/);
    expect(APPSTATE).toMatch(/\.eq\('quote_id', id\)/);
  });
});

describe('the acceptance rate cannot reach 1.0 from a mixed record', () => {
  // The arithmetic the static guards above exist to protect. `calibrateModels`
  // computes `personalAcceptanceRate` as the mean of `actual` over the last N
  // quote_win points, so recording only wins is mathematically pinned to 1.
  const acceptanceRate = (points: { actual: number }[]) =>
    points.reduce((s, p) => s + p.actual, 0) / points.length;

  it('ten wins and nothing else reports a 100% win rate', () => {
    const winsOnly = Array.from({ length: 10 }, () => ({ actual: 1 }));
    expect(acceptanceRate(winsOnly)).toBe(1);
  });

  it('the same ten quotes, six of them lost, report 40%', () => {
    const mixed = [
      ...Array.from({ length: 4 }, () => ({ actual: 1 })),
      ...Array.from({ length: 6 }, () => ({ actual: 0 })),
    ];
    expect(acceptanceRate(mixed)).toBeCloseTo(0.4, 5);
  });
});
