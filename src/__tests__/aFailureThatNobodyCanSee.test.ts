/**
 * @jest-environment node
 */
// Batch 2 of the "unchecked write" sweep (#353). Where batch 1 was about
// irreversible steps, these are the quieter half: a write whose failure costs
// something specific and leaves no trace at all.
//
// The one that matters most is not an unchecked write but an AMBIGUOUS one:
// `claimWebhookEvent` returned the same `false` for "already processed" and
// "the claim itself failed", and every caller read that as a replay — so one
// bad INSERT permanently skipped a customer's paid receipt.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the webhook claim says which of the three things happened', () => {
  const SHARED = read('supabase/functions/_shared/credit-redemption.ts');

  it('returns a tri-state, not a boolean', () => {
    expect(SHARED).toMatch(/export type WebhookClaim = 'first' \| 'duplicate' \| 'unknown';/);
    expect(SHARED).toMatch(/if \(\(error as any\)\.code === '23505'\) return 'duplicate';/);
    expect(SHARED).toMatch(/return 'unknown';/);
  });

  it('money skips on unknown; notifications do not', () => {
    // Consuming credits twice takes months the customer paid for, so those
    // sites demand 'first'. A receipt that never arrives is worse than one
    // that arrives twice, so those sites only stop on a CONFIRMED duplicate.
    for (const rel of ['supabase/functions/mollie-webhook/index.ts', 'supabase/functions/stripe-webhook/index.ts']) {
      const src = read(rel);
      expect({ rel, money: /isFirstSeeing === 'first'/.test(src) }).toEqual({ rel, money: true });
      expect({ rel, notify: /isFirstSeeingPaid !== 'duplicate'/.test(src) }).toEqual({ rel, notify: true });
      // No site may test the value for truthiness — every outcome is a
      // non-empty string, so `if (claim)` is always true and duplicates would
      // be re-processed. This is the mistake the change itself nearly made.
      expect({ rel, truthy: /if \(isFirstSeeing\w*\) \{/.test(src) }).toEqual({ rel, truthy: false });
    }
  });
});

describe('a side effect that fires once per payment says when it did not', () => {
  const SRC = read('supabase/functions/_shared/paid-side-effects.ts');

  it('the DSO training row is checked', () => {
    expect(SRC).toMatch(/const \{ error: outcomeErr \} = await admin\.from\('invoice_outcomes'\)/);
    expect(SRC).toMatch(/if \(outcomeErr\)/);
  });

  it('a non-2xx from the receipt or push call is not read as success', () => {
    // `fetch` only rejects on a transport failure — a 500 from Resend is a
    // perfectly fine Response, so the old bare `catch {}` saw nothing.
    // The "receipt" went through send-invoice, which 401s on a service key and
    // would, if its auth were "fixed", email an invoice and re-mark the PAID
    // invoice as sent. It must not come back until a real receipt exists.
    expect(SRC).not.toMatch(/functions\/v1\/send-invoice/);
    expect(SRC).toMatch(/const pushRes = await fetch\(/);
    // HTTP status AND the body: `{ ok: true, sent: 0 }` is no delivery (B4).
    expect(SRC).toMatch(/if \(!pushRes\.ok \|\| !outcome\.delivered\)/);
    expect(SRC).not.toMatch(/\} catch \{\}/);
  });
});

describe('the counters that gate spending and repetition are read', () => {
  it('ai-command: the rate-limit increment is the rate limit', () => {
    const SRC = read('supabase/functions/ai-command/index.ts');
    expect(SRC).toMatch(/const \{ error: limitErr \} = await admin/);
    expect(SRC).toMatch(/effectively unlimited until it recovers/);
  });

  it('push dedupe rows are checked wherever a push has already gone out', () => {
    const digest = read('supabase/functions/daily-push-digest/index.ts');
    expect(digest).toMatch(/const \{ error: logErr \} = await admin\.from\('push_notification_log'\)/);
    // Counted and surfaced — a counter nobody reads is the shape being fixed.
    expect(digest).toMatch(/dedupeFailures \+= 1/);
    expect(digest).toMatch(/sent: sentCount, dedupeFailures/);

    const packs = read('supabase/functions/pack-trigger-tick/index.ts');
    const checked = [...packs.matchAll(/const \{ error: \w+LogErr \} = await admin\.from\('push_notification_log'\)/g)];
    // All three packs: incasso, quote follow-up, job milestone.
    expect(checked.length).toBe(3);
    expect(packs).not.toMatch(/\n\s*await admin\.from\('push_notification_log'\)\.insert\(/);
  });

  it('send-push only reports tokens it actually pruned', () => {
    const SRC = read('supabase/functions/send-push/index.ts');
    expect(SRC).toMatch(/const \{ error: pruneErr \} = await admin\.from\('push_tokens'\)\.delete\(\)/);
    expect(SRC).toMatch(/else pruned = invalidTokens\.length;/);
    expect(SRC).not.toMatch(/pruned: invalidTokens\.length/);
  });
});

describe('an update branch reports failure as loudly as its insert sibling', () => {
  const SRC = read('src/lib/intelligenceDataProvider.ts');

  it('no update branch returns an id it did not verify', () => {
    // The shape: `if (existing) { await ...update(...); return existing.id; }`
    // next to an insert branch that checks. Every first write landed and
    // every later update was lost, so the graph froze at day one.
    expect(SRC).not.toMatch(/if \(existing\) \{\s*\n\s*await from\(/);
    for (const fn of ['upsertEntity', 'upsertMaterial', 'upsertSupplier']) {
      const at = SRC.indexOf(`export async function ${fn}`);
      expect({ fn, found: at > -1 }).toEqual({ fn, found: true });
      const body = SRC.slice(at, SRC.indexOf('\n}\n', at));
      expect({ fn, checked: /const \{ error: updErr \}/.test(body) }).toEqual({ fn, checked: true });
    }
  });

  it('the two void helpers check too', () => {
    const cal = SRC.slice(SRC.indexOf('export async function resolveCalibrationEntry'), SRC.indexOf('export async function getCalibrationEntriesByGenerator'));
    expect(cal).toMatch(/const \{ error \} = await from\('calibration_entries'\)/);
    const alias = SRC.slice(SRC.indexOf('export async function addMaterialAlias'), SRC.indexOf('// ── Suppliers'));
    expect(alias).toMatch(/const \{ error \} = await from\('material_catalog'\)/);
  });
});

describe('the services that had a dead catch now read the error', () => {
  it('intelligenceCapture: the failure logger can finally fire', () => {
    const SRC = read('src/services/intelligenceCaptureService.ts');
    const hits = [...SRC.matchAll(/if \(error\) await logIntelligenceWriteFailure\(/g)];
    // photo_analyses + generator_dismissals — the two the earlier fix missed.
    expect(hits.length).toBe(2);
  });

  it('push tokens: registration and logout both report', () => {
    const SRC = read('src/services/pushNotificationService.ts');
    expect(SRC).toMatch(/this device will receive no notifications/);
    expect(SRC).toMatch(/may still receive their notifications/);
  });

  it('embeddings: the old row survives a failed copy', () => {
    const SRC = read('src/services/embeddingService.ts');
    const at = SRC.indexOf('const { error: copyErr }');
    expect(at).toBeGreaterThan(-1);
    // The delete must not run when the copy failed — that produced exactly
    // the coverage gap the listener exists to prevent.
    expect(SRC.slice(at)).toMatch(/if \(copyErr\) \{[\s\S]*?return;/);
  });

  it('reason codes: the annotation failure is logged like its neighbours', () => {
    const SRC = read('src/services/reasonCodeService.ts');
    expect(SRC).toMatch(/annotation not persisted for delta/);
  });
});

// B4 (sweep 2026-09-23): send-push says `{ ok: true, sent: 0 }` when the
// contractor has no device. Callers read `ok` alone, so the push log recorded
// success and the digests counted sends that reached nobody.
describe('a push is delivered only when a device took it', () => {
  const fs = require('fs');
  const path = require('path');
  const FN = path.join(__dirname, '../../supabase/functions');
  const callers = [...fs.readdirSync(FN)].flatMap((d: string) => {
    const f = path.join(FN, d, 'index.ts');
    return fs.existsSync(f) ? [f] : [];
  }).concat([path.join(FN, '_shared/paid-side-effects.ts')])
    .filter((f: string) => !f.includes('/send-push/') && fs.readFileSync(f, 'utf8').includes('/functions/v1/send-push'));

  it('finds the callers', () => { expect(callers.length).toBeGreaterThanOrEqual(3); });

  it.each(callers.map((f: string) => [path.relative(FN, f), f]))('%s reads the outcome through pushOutcome', (_rel, f) => {
    const src = fs.readFileSync(f as string, 'utf8');
    const sends = (src.match(/\/functions\/v1\/send-push/g) ?? []).length;
    expect((src.match(/pushOutcome\(/g) ?? []).length).toBeGreaterThanOrEqual(sends);
    expect(src).not.toMatch(/\w*[sS]end\w*Json\?\.ok\b/);
  });
});
