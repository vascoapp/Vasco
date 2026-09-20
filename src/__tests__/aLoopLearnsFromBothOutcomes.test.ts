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

describe('calibrationIdsAreRealGeneratorIds', () => {
  // A registry of ids keyed on an open set rots silently in both directions
  // (#163/#171). Stage 7 of the ingestion bridge looked up
  // `supplierPricingGenerator` / `materialCostGenerator` /
  // `quotePricingGenerator` — camelCase names no generator has ever logged —
  // so it resolved nothing on every scan, which is what left every
  // `calibration_entries` row unresolved and pinned every score to 0.5.
  const { PRICE_PREDICTION_GENERATORS } = require('../ingestion/intelligenceBridge');

  // Every id any generator actually passes to `logPrediction`.
  const loggedIds = (() => {
    const ids = new Set<string>();
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) { if (name !== '__tests__') walk(full); continue; }
        if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
        const src = stripComments(fs.readFileSync(full, 'utf8'));
        for (const m of src.matchAll(/generatorId:\s*'([^']+)'/g)) ids.add(m[1]);
      }
    };
    walk(path.join(ROOT, 'src'));
    return ids;
  })();

  it('the corpus of logged ids is non-empty (the scan itself works)', () => {
    // Without this, an extractor that silently matches nothing would make
    // every assertion below vacuous.
    expect(loggedIds.size).toBeGreaterThan(20);
  });

  it.each([...PRICE_PREDICTION_GENERATORS])('%s is an id a generator really logs', (id) => {
    expect({ id, logged: loggedIds.has(id as string) }).toEqual({ id, logged: true });
  });

  it('the camelCase names that could never match are gone', () => {
    const SRC = read('src/ingestion/intelligenceBridge.ts');
    for (const dead of ['supplierPricingGenerator', 'materialCostGenerator', 'quotePricingGenerator']) {
      expect({ dead, present: SRC.includes(dead) }).toEqual({ dead, present: false });
    }
  });
});

describe('a calibration score is resolved data, not a placeholder', () => {
  const CAL = read('src/intelligence/calibration.ts');

  it('Supabase scores are preferred only when something was resolved', () => {
    // `dbScores.length > 0` returned on the first prediction ever LOGGED, and
    // an unresolved set computes rate = 0.5 for everything.
    expect(CAL).toMatch(/if \(dbScores\.some\(\(s\) => s\.resolved > 0\)\) \{/);
    expect(CAL).not.toMatch(/if \(dbScores\.length > 0\) \{/);
  });

  it('a resolution keys on the uuid the row actually has', () => {
    // The local id is `cal-<ts>-<rand>`; the column is a uuid, so the old
    // call could not match — it could not even parse.
    expect(CAL).toMatch(/remoteId\?: string;/);
    expect(CAL).toMatch(/if \(isSupabaseConfigured && entry\.remoteId\) \{/);
    expect(CAL).toMatch(/dbResolveCalibration\(entry\.remoteId,/);
    expect(CAL).not.toMatch(/dbResolveCalibration\(entryId,/);
  });

  it('the id the insert mints is captured rather than discarded', () => {
    expect(CAL).toMatch(/\.then\(async \(remoteId\) => \{/);
    expect(CAL).toMatch(/mine\.remoteId = remoteId;/);
    // Re-loaded, not the closure's stale copy — the entry list moves on.
    expect(CAL).toMatch(/const fresh = await loadStore\(\);/);
  });
});

describe('a table the cohort RPCs read has something in it', () => {
  // `get_cohort_job_duration` reads `job_duration_data`, `get_cohort_dso` reads
  // `customer_payment_patterns`, `train-extra-models` reads `job_outcomes`.
  // All three existed, were granted, were RLS'd and were READ — and none had a
  // single INSERT anywhere in src/, app/ or supabase/functions/. A field with
  // readers and no writer (#208), one level up: a whole table.
  const COLLECTOR_SRC = COLLECTOR;

  it.each([
    ['job_duration_data', /supabase\.from\('job_duration_data'\)\.insert\(/],
    ['customer_payment_patterns', /supabase\.from\('customer_payment_patterns'\)\.insert\(/],
  ])('%s has a writer', (_table, pattern) => {
    expect(COLLECTOR_SRC).toMatch(pattern);
  });

  it('job_outcomes is written from the path that has real hours and costs', () => {
    expect(APPSTATE).toMatch(/syncJobOutcome\(getCurrentUserId\(\), \{/);
    // NOT by waking `onStageTransition`, which invents a 0.6 cost ratio and a
    // 14-day due date for data it does not have.
    expect(APPSTATE).not.toMatch(/onStageTransition\(/);
  });

  it('both cohort writers are reached from a real user action', () => {
    expect(APPSTATE).toMatch(/recordJobDurationData\(getCurrentUserId\(\), \{/);
    expect(APPSTATE).toMatch(/recordCustomerPaymentPattern\(getCurrentUserId\(\), \{/);
    // …and are imported, not just referenced. A bare call to a name AppState
    // only dynamic-imports is `undefined` at runtime and tsc cannot see it
    // through the `import(...)` form.
    expect(APPSTATE).toMatch(/\n  recordJobDurationData,/);
    expect(APPSTATE).toMatch(/\n  recordCustomerPaymentPattern,/);
  });

  it('a duration row without both sides is not written at all', () => {
    // The ratio is what the RPC medians; half a row teaches nothing and
    // would drag the cohort toward whatever default filled the gap.
    expect(COLLECTOR_SRC).toMatch(
      /if \(!\(data\.estimatedHours > 0\) \|\| !\(data\.actualHours && data\.actualHours > 0\)\) return;/,
    );
  });

  it('the NOT NULL columns are all guarded before the insert', () => {
    // customer_payment_patterns has five NOT NULL columns with no default. A
    // row missing any of them can only ever fail — the half of
    // check:insertable with teeth.
    expect(COLLECTOR_SRC).toMatch(
      /if \(!data\.customerId \|\| !data\.invoiceId \|\| !data\.invoiceDate \|\| !data\.dueDate\) return;/,
    );
    expect(COLLECTOR_SRC).toMatch(/if \(!Number\.isFinite\(data\.invoiceAmount\)\) return;/);
  });

  it('the DATE columns get a date, not a timestamp', () => {
    // invoice_date / due_date / payment_date are DATE. Handing them a full
    // ISO string works by coercion today and is a silent timezone shift.
    expect(COLLECTOR_SRC).toMatch(/const asDate = \(iso: string\) => iso\.slice\(0, 10\);/);
  });
});

describe('the weekly retrain can actually save what it trained', () => {
  const RETRAIN = read('supabase/functions/weekly-retrain-models/index.ts');

  it('the RPC is called with the argument names the function declares', () => {
    // PostgREST resolves an RPC by argument NAME, so a mismatch is
    // "function not found" (PGRST202), not a coercion error. The live
    // catalogue has exactly one overload:
    //   save_quote_win_model(text, text, jsonb, integer, real)
    expect(RETRAIN).toMatch(/p_training_samples: result\.n,/);
    expect(RETRAIN).toMatch(/p_accuracy: result\.accuracy,/);
    for (const invented of ['p_bias:', 'p_feature_means:', 'p_feature_stds:', 'p_n_samples:', 'p_train_accuracy:']) {
      expect({ invented, present: RETRAIN.includes(invented) }).toEqual({ invented, present: false });
    }
  });

  it('p_weights is the whole model, which is what both sides read', () => {
    // The SQL does `p_weights->'weights'` to record feature columns, and the
    // client deserializes the same object as ModelWeights.
    expect(RETRAIN).toMatch(/p_weights: \{\s*\n\s*bias: result\.bias,/);
    for (const field of ['weights: result.weights,', 'featureMeans: result.means,', 'featureStds: result.stds,', 'nSamples: result.n,']) {
      expect({ field, present: RETRAIN.includes(field) }).toEqual({ field, present: true });
    }
  });

  it('the edge trainer and the client scorer featurize identically', () => {
    // Activating the save is only safe while these agree — a model trained on
    // one feature set and scored against another is worse than no model.
    const CLIENT = read('src/services/quoteWinModelService.ts');
    const names = ['log_amount', 'month_sin', 'month_cos', 'is_residential', 'is_commercial', 'is_small_team', 'is_medium', 'is_large'];
    const order = (src: string) =>
      names.filter((n) => src.includes(`${n}:`)).join(',');
    expect(order(RETRAIN)).toBe(names.join(','));
    expect(order(CLIENT)).toBe(names.join(','));
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
