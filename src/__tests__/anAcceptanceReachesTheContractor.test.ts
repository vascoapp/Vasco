/**
 * @jest-environment node
 */
// The customer portal (`/quote/<id>?t=<hmac>` → app/contractor/customer-view)
// is where a customer ACCEPTS a quote. That acceptance is a contract, and the
// row it writes into `customer_interactions` is the ONLY channel to the
// contractor — `customerInteractionWatcher` subscribes to INSERTs on it.
//
// supabase-js RESOLVES with `{ error }` rather than throwing, so the old
// `try { await insert(...) } catch {}` read an RLS refusal, the rate-limit
// trigger or a constraint violation as success. The customer saw "Quote
// accepted! — they will be in touch shortly" for a contract that existed only
// on their own phone (sweep 2026-09-18).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const SRC = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../../app/contractor/customer-view.tsx'), 'utf8'),
);

describe('the portal knows whether the contractor heard', () => {
  it('reads the insert error instead of swallowing it', () => {
    const at = SRC.indexOf('async function recordInteraction');
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf('\n}', SRC.indexOf('return { delivered', at)));
    expect(body).toMatch(/const \{ error \} = await/);
    expect(body).toMatch(/delivered = !error/);
    // The local copy is on the CUSTOMER's device and nobody else reads it, so
    // it can never stand in for delivery.
    expect(body).toMatch(/storedLocally/);
    expect(body).not.toMatch(/delivered = storedLocally/);
  });

  it('accepting claims contact only when a channel landed', () => {
    const at = SRC.indexOf('const outcome = await recordInteraction');
    expect(at).toBeGreaterThan(-1);
    const handler = SRC.slice(at, SRC.indexOf('setAccepted(true)', at) + 20);
    expect(handler).toMatch(/jobCreated = true/);
    expect(handler).toMatch(/setAcceptReachedContractor\(outcome\.delivered \|\| jobCreated\)/);
  });

  it('the success screen says so when nothing reached them', () => {
    expect(SRC).toMatch(/acceptReachedContractor\s*\n?\s*\?\s*t\('customerView\.acceptedDesc'/);
    expect(SRC).toMatch(/customerView\.acceptedNotDeliveredDesc/);
  });

  it('a change request that was refused does not report itself as sent', () => {
    const at = SRC.indexOf('const handleChangeRequest');
    expect(at).toBeGreaterThan(-1);
    const handler = SRC.slice(at, SRC.indexOf('\n  };', at));
    expect(handler).toMatch(/await recordInteraction/);
    expect(handler).toMatch(/if \(outcome\.delivered\)/);
    expect(handler).toMatch(/customerView\.notSentDesc/);
    // …and the typed text survives a failure.
    const failureBranch = handler.slice(handler.indexOf('customerView.notSentTitle'));
    expect(failureBranch).not.toMatch(/setChangeMessage\(''\)/);
  });
});

describe('the strings exist in every shipped language', () => {
  const LOCALES = ['de', 'en', 'nl', 'fr', 'es', 'it'];
  it.each(LOCALES)('%s has the not-delivered copy', (loc) => {
    const dict = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${loc}.json`), 'utf8'),
    );
    expect(typeof dict.customerView?.notSentDesc).toBe('string');
    expect(typeof dict.customerView?.acceptedNotDeliveredDesc).toBe('string');
    // The business name is interpolated, not hardcoded.
    expect(dict.customerView.acceptedNotDeliveredDesc).toContain('{{business}}');
  });
});
