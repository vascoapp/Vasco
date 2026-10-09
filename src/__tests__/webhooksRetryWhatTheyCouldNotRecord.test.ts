/**
 * @jest-environment node
 */
// Sweep A7: a payment webhook that cannot RECORD a payment must ask to be
// delivered again — before anything irreversible happened. Every such failure
// answered 200 (Mollie/Stripe only retry on non-2xx), so an invoice paid while
// the database blinked was never marked paid, and a Stripe subscription whose
// sync failed kept its idempotency claim: Stripe's retry was a "replay" and a
// paying customer stayed on Free.
//
// The other half of the rule stays (#352, anIrreversibleStepRecordsItself):
// once the receipt / push went out, a failure is REPORTED, never a non-2xx.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const after = (src: string, anchor: string, len = 400) => {
  const i = src.indexOf(anchor);
  expect(i).toBeGreaterThan(-1);
  return src.slice(i, i + len);
};

describe.each(['mollie-webhook', 'stripe-webhook'])('%s', (fn) => {
  const SRC = read(`supabase/functions/${fn}/index.ts`);

  it('a 503 helper exists and is a non-2xx', () => {
    expect(SRC).toMatch(/function retryLater\(why: string\): Response \{[\s\S]*?status: 503/);
  });

  it('an invoice the database could not mark paid is retried (if transient)', () => {
    expect(after(SRC, 'if (updateError) {')).toMatch(/return failRecording\('DB update failed', updateError\)/);
  });

  it('a tracker deposit the database could not mark paid is retried (if transient)', () => {
    expect(after(SRC, 'if (trackerErr) {')).toMatch(/return failRecording\('Tracker update failed', trackerErr\)/);
  });

  it('a permanent DB error is answered 200 + reported, never a retry storm', () => {
    const fn = after(SRC, 'function failRecording(', 500);
    expect(fn).toMatch(/if \(isPermanentDbError\(error\)\)[\s\S]*?status: 200/);
    expect(fn).toMatch(/return retryLater\(why\)/);
  });

  it('the invoice is found by number + contractor, and a zero-row match is not success', () => {
    // Platform payments: number + the contractor in the metadata. Connected-
    // account payments (Stripe Connect): number + the account's OWNER.
    expect(SRC).toMatch(/const lookup = (?:connectedOwner\s*\? invoiceLookup\(invoiceId, connectedOwner\)\s*: )?invoiceLookup\(invoiceId, \w+\.metadata\?\.userId\)/);
    expect(SRC).not.toMatch(/\.eq\('id', invoiceId\)/);
    expect(after(SRC, 'if (!invoiceRowId) {')).toMatch(/return retryLater\('Invoice not found'\)/);
    expect(SRC).toMatch(/dispatchPaidSideEffects\(supabaseUrl, supabaseServiceKey, invoiceRowId, paidAt\)/);
  });

  it('nothing asks for a retry AFTER the receipt / push went out', () => {
    // The invoice branch, from the side effects to where it ends: the next
    // branch (mollie: the tracker deposit, mutually exclusive) or the response.
    const tail = SRC.slice(SRC.indexOf('dispatchPaidSideEffects(supabaseUrl'));
    const ends = [tail.indexOf("if (payment.status === 'paid' && trackerAccessCode)"), tail.indexOf('return new Response')]
      .filter((i) => i > -1);
    expect(tail.slice(0, Math.min(...ends))).not.toMatch(/retryLater\(|failRecording\(/);
  });
});

describe('stripe-webhook: a subscription that did not sync is delivered again', () => {
  const SRC = read('supabase/functions/stripe-webhook/index.ts');
  it('credits handed back, claim released only if OWNED and restored, THEN 503', () => {
    const block = after(SRC, 'if (subErr) {', 1600);
    const restore = block.indexOf('restored = await restoreCredits(');
    const gate = block.indexOf("if (isFirstSeeing === 'first' && restored) {");
    const release = block.indexOf("await releaseWebhookEvent(supabaseUrl0, supabaseServiceKey0, 'stripe', event.id)");
    const retry = block.indexOf("return failRecording('subscription sync failed', subErr)");
    expect(restore).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(restore);
    expect(release).toBeGreaterThan(gate);
    expect(retry).toBeGreaterThan(release);
  });
  it('past_due is an UPDATE (tier is NOT NULL; the upsert failed on every event)', () => {
    const block = after(SRC, "if (event.type === 'invoice.payment_failed') {", 3000);
    const write = block.slice(block.indexOf('const { error: upErr }'), block.indexOf('if (upErr) {'));
    expect(write).toMatch(/\.update\(\{/);
    expect(write).not.toMatch(/\.upsert\(/);
    expect(after(SRC, 'if (upErr) {')).toMatch(/return failRecording\('past_due sync failed', upErr\)/);
  });
});

describe('mollie-webhook: a failed credit extension releases only its own claim', () => {
  const SRC = read('supabase/functions/mollie-webhook/index.ts');
  it('restores credits, and releases + retries only when no invoice shares the claim', () => {
    const block = after(SRC, 'Mollie period extension failed, credits restored=', 500);
    expect(block).toMatch(/if \(!invoiceId && restored\) \{\s*await releaseWebhookEvent\([^)]*'mollie', paymentId\);\s*return retryLater\(/);
  });
});

describe('releaseWebhookEvent', () => {
  const SRC = read('supabase/functions/_shared/credit-redemption.ts');
  it('deletes exactly the claimed (provider, event) row', () => {
    const fn = after(SRC, 'export async function releaseWebhookEvent(', 600);
    expect(fn).toMatch(/\.from\('webhook_idempotency'\)\s*\.delete\(\)\s*\.eq\('provider', provider\)\s*\.eq\('event_id', eventId\)/);
  });
});

import { invoiceLookup } from '../../supabase/functions/_shared/invoiceRef';
import { isPermanentDbError } from '../../supabase/functions/_shared/dbErrors';

describe('invoiceLookup — the app sends the document NUMBER', () => {
  const U = 'aaaaaaaa-1111-4111-8111-000000000001';
  it('a uuid is the row id', () => {
    expect(invoiceLookup(U, undefined)).toEqual({ column: 'id', value: U });
  });
  it('a number is matched WITH the contractor', () => {
    expect(invoiceLookup('RE-2026-0001', U)).toEqual({ column: 'document_number', value: 'RE-2026-0001', userId: U });
  });
  it('a number without a contractor is never guessed', () => {
    expect(invoiceLookup('RE-2026-0001', undefined)).toBeNull();
    expect(invoiceLookup('RE-2026-0001', 'not-a-uuid')).toBeNull();
    expect(invoiceLookup('', U)).toBeNull();
  });
});

describe('isPermanentDbError', () => {
  it.each(['22P02', '23502', '23503', '23514', '42703', 'PGRST204'])('%s is permanent', (code) => {
    expect(isPermanentDbError({ code })).toBe(true);
  });
  it.each(['08006', '57014', '53300', 'PGRST000', undefined])('%s is worth a retry', (code) => {
    expect(isPermanentDbError({ code } as any)).toBe(false);
  });
});
