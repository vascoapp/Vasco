/**
 * @jest-environment node
 */
// Edge functions run where nobody is looking: no screen, no user, no retry by
// hand. supabase-js RESOLVES with `{ error }` instead of throwing, so an
// unread result there is a write that can fail in silence forever.
//
// Two of them did (sweep 2026-09-18):
//
//  • `mollie-webhook` consumed a referral credit, then extended the paid
//    period with an UNCHECKED update inside a try/catch whose sole purpose was
//    to hand the credits back. Nothing could throw, so `restoreCredits` could
//    never run: the credits were gone and the period was never extended. Its
//    `select` was unchecked too, and a failed read looks exactly like "no
//    current period" — which restarts the term from today and quietly shortens
//    what the customer already paid for.
//
//  • `send-invoice` marked the document `sent` with an unchecked update AFTER
//    the email had already left. The invoice stayed a draft, the dunning clock
//    never started, and the contractor was told it went out — so the likely
//    next step was sending the same customer a second copy.
//
// The email is irreversible, so that one reports the split state (200 +
// `statusUpdated: false`) rather than failing the call.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const read = (p: string) =>
  stripComments(fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8'));

const MOLLIE = read('supabase/functions/mollie-webhook/index.ts');
const SEND = read('supabase/functions/send-invoice/index.ts');

describe('mollie-webhook can actually compensate a failed extension', () => {
  const at = MOLLIE.indexOf('const { monthsApplied, consumed } = await redeemCredits');
  const block = MOLLIE.slice(at, MOLLIE.indexOf('credits restored', at));

  it('the credit-redemption block is where we think it is', () => {
    expect(at).toBeGreaterThan(-1);
    expect(block).toContain('current_period_ends_at');
  });

  it('a refused period extension throws, so the credits are restored', () => {
    expect(block).toMatch(/const \{ error: extendErr \} = await admin/);
    expect(block).toMatch(/if \(extendErr\) throw new Error\(/);
  });

  it('a failed READ is not mistaken for "no current period"', () => {
    expect(block).toMatch(/const \{ data: sub, error: readErr \} = await admin/);
    expect(block).toMatch(/if \(readErr\) throw new Error\(/);
    // The `new Date()` fallback is only for a genuinely absent row.
    expect(block).toMatch(/sub\?\.current_period_ends_at \? new Date\(sub\.current_period_ends_at\) : new Date\(\)/);
  });

  it('the compensation is still wired to the catch', () => {
    expect(MOLLIE).toMatch(/await restoreCredits\(supabaseUrl2, supabaseServiceKey2, consumed\.map\(/);
  });
});

describe('send-invoice tells the truth about a status it could not write', () => {
  // Anchored on CODE, never on a comment: `stripComments` deletes comments,
  // so a comment anchor silently yields an empty block and a green suite.
  const at = SEND.indexOf(".from('documents')");
  const block = SEND.slice(Math.max(0, at - 300));

  it('reads the update result', () => {
    expect(at).toBeGreaterThan(-1);
    expect(block).toMatch(/const \{ error: statusError \} = await admin/);
  });

  it('still returns 200 — the email is already gone', () => {
    // A 502 here would read as "not sent" and invite a duplicate send to the
    // customer, which is the worse of the two failures.
    const response = block.slice(block.indexOf('return new Response'));
    expect(response).toMatch(/status: 200/);
    expect(response).toMatch(/ok: true/);
  });

  it('reports the split state instead of hiding it', () => {
    expect(block).toMatch(/statusUpdated: !statusError/);
    expect(block).toMatch(/warning: `Email sent, but the invoice status was not recorded/);
    expect(block).toMatch(/console\.error\(`send-invoice: email delivered but status not recorded/);
  });
});

describe('the app surfaces the split state to the contractor', () => {
  const SCREEN = read('app/invoices/[id].tsx');
  const SERVICE = read('src/services/sendInvoiceService.ts');

  it('the wrapper passes the flag through', () => {
    expect(SERVICE).toMatch(/statusUpdated\?: boolean;/);
    // The whole payload is returned, so nothing strips the new fields.
    expect(SERVICE).toMatch(/return payload;/);
  });

  it('"sent" and "sent but not recorded" are different alerts', () => {
    expect(SCREEN).toMatch(/if \(result\.ok && result\.statusUpdated === false\) \{/);
    expect(SCREEN).toMatch(/invoices\.sentNotRecordedTitle/);
    expect(SCREEN).toMatch(/invoices\.sentNotRecordedDesc/);
  });

  it('every locale can say it', () => {
    for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
      const dict = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${loc}.json`), 'utf8'),
      );
      expect({ loc, title: typeof dict.invoices?.sentNotRecordedTitle })
        .toEqual({ loc, title: 'string' });
      expect(dict.invoices.sentNotRecordedDesc).toContain('{{email}}');
    }
  });
});
