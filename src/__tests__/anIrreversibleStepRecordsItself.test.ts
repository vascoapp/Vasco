/**
 * @jest-environment node
 */
// Sweep of the "write whose failure nobody can see" class, 2026-09-19, after
// three instances of it turned up by hand. supabase-js RESOLVES with
// `{ error }`, so an unread result is a failure that leaves no trace anywhere
// — and in every case below something IRREVERSIBLE happened first.
//
// The rule that decides the fix: **after an irreversible step, a failure is
// reported, never re-thrown as a non-2xx.** A webhook or a supplier API that
// sees an error retries, and a retry after "the order was already placed" or
// "the email already went" causes the second, worse failure. So these return
// success with the truth attached, exactly like `send-invoice` does.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('stripe-webhook can hand the credits back', () => {
  const SRC = read('supabase/functions/stripe-webhook/index.ts');

  it('the compensation sits where the failure is', () => {
    // It used to live in a catch around `new Date()` arithmetic, which cannot
    // throw — while the write that decides whether the extension exists was
    // fifteen lines lower and only logged. Identical to the mollie bug.
    expect(SRC).toMatch(/let consumedCreditIds: string\[\] = \[\];/);
    const after = SRC.slice(SRC.indexOf('const { error: subErr }'));
    expect(after).toMatch(/if \(subErr\) \{/);
    expect(after).toMatch(/await restoreCredits\(supabaseUrl0, supabaseServiceKey0, consumedCreditIds\)/);
  });

  it('no compensation is left inside a catch that only wraps date maths', () => {
    const redeem = SRC.slice(SRC.indexOf('if (monthsApplied > 0)'), SRC.indexOf('const { error: subErr }'));
    expect(redeem).not.toMatch(/restoreCredits/);
    expect(redeem).not.toMatch(/try \{/);
  });
});

describe('an irreversible external step reports what it could not record', () => {
  it('place-supplier-order: the order is placed, so it stays 200 and says so', () => {
    const SRC = read('supabase/functions/place-supplier-order/index.ts');
    expect(SRC).toMatch(/const \{ error: linkErr \} = await admin/);
    expect(SRC).toMatch(/recorded: !linkErr/);
    // A non-2xx would make the caller submit a SECOND real order.
    const response = SRC.slice(SRC.indexOf('recorded: !linkErr'));
    expect(response).toMatch(/status: 200/);
  });

  it('churn-winback: the suppression row is the only thing stopping a repeat', () => {
    const SRC = read('supabase/functions/churn-winback-email/index.ts');
    expect(SRC).toMatch(/const \{ error: logErr \} = await admin\.from\('churn_winback_log'\)/);
    expect(SRC).toMatch(/suppressionFailures \+= 1/);
    // Surfaced in the response, not only in a log line nobody reads.
    expect(SRC).toMatch(/return json\(\{\s*\n?\s*suppressionFailures,/);
  });

  it('drain-account-deletions: both finalisation writes are read', () => {
    const SRC = read('supabase/functions/drain-account-deletions/index.ts');
    // Success path: the GDPR completion record.
    expect(SRC).toMatch(/const \{ data: doneRows, error: doneErr \} = await admin/);
    // Failure path: the lock rollback that makes the next tick retry at all.
    expect(SRC).toMatch(/const \{ error: rollbackErr \} = await admin/);
    expect(SRC).toMatch(/STRANDED in processing/);
  });
});

describe('a delete that says "cannot be undone" verifies both halves', () => {
  const SRC = read('src/services/jobPhotoService.ts');

  it('checks the row AND the stored bytes', () => {
    const fn = SRC.slice(SRC.indexOf('export async function deleteJobPhoto'));
    expect(fn).toMatch(/const \{ error: rowErr \}/);
    expect(fn).toMatch(/const \{ error: storageErr \}/);
    // `return true` must not be reachable with either error set.
    expect(fn).toMatch(/if \(rowErr\) \{[\s\S]*?return false;/);
    expect(fn).toMatch(/if \(storageErr\) \{[\s\S]*?return false;/);
  });

  it('the screen tells the contractor when it did not happen', () => {
    const SCREEN = read('app/contractor/job/[id]/photos.tsx');
    expect(SCREEN).toMatch(/const deleted = await deleteJobPhoto\(/);
    expect(SCREEN).toMatch(/if \(!deleted\) \{/);
    expect(SCREEN).toMatch(/jobs\.photos\.deleteFailedTitle/);
  });

  it('every locale can say it', () => {
    for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
      const dict = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8'));
      expect({ loc, has: typeof dict.jobs?.photos?.deleteFailedTitle })
        .toEqual({ loc, has: 'string' });
    }
  });
});

describe('a scanned supplier invoice is not left on one phone', () => {
  const SRC = read('src/services/invoiceScanService.ts');

  it('the insert is checked and a failure is queued for real', () => {
    expect(SRC).toMatch(/const \{ error \} = await \(supabase\.from\('scanned_invoices'/);
    expect(SRC).toMatch(/if \(error\) await queueIt\(\)/);
    expect(SRC).toMatch(/queueWrite\(\{ table: 'scanned_invoices', op: 'insert', payload: row \}\)/);
  });

  it('the promise in the comment now has machinery behind it', () => {
    // The old comment said the offline queue would pick it up; the file had no
    // `queueWrite` at all. Same shape as the portal's `savedLocal` (#348).
    expect(SRC).toMatch(/import\('\.\/offlineWriteQueue'\)/);
  });
});
