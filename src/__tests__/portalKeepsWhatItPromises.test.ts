/**
 * @jest-environment node
 */
// The customer portal (`admin/src/app/customer/[code]`) is the CUSTOMER's half
// of the product: no login, a browser, usually a phone on site. Two claims it
// makes had nothing behind them (sweep 2026-09-18):
//
//  1. The acknowledgement signature — a contract confirmation — discarded the
//     RPC result inside `try/catch`. supabase-js RESOLVES with `{ error }`, and
//     `write_signature_via_portal` RAISES on an expired or unknown access code,
//     so a refusal rendered "Signed — thank you!" for a signature that existed
//     nowhere: not on the server, and (the portal had no storage at all) not on
//     the customer's device either.
//  2. Every failed write toasted `savedLocal` — "we'll send it when you're back
//     online" — and nothing kept it or ever re-sent it.
//
// `admin/src/lib/portalOutbox.ts` is what makes sentence 2 true, and the
// signature now distinguishes sent from queued. This guard is static because
// the page is a Next client component outside this jest project's module
// graph; what matters is which VALUE each branch is taken on.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const PAGE = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../../admin/src/app/customer/[code]/page.tsx'), 'utf8'),
);
const OUTBOX = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../../admin/src/lib/portalOutbox.ts'), 'utf8'),
);

describe('the signature is only called signed when it landed', () => {
  const at = PAGE.indexOf('onSign={async (name, svg)');
  const handler = PAGE.slice(at, PAGE.indexOf('}} />', at));

  it('exists', () => expect(at).toBeGreaterThan(-1));

  it('reads the RPC error instead of swallowing it', () => {
    expect(handler).toMatch(/const \{ error \} = await sb\.rpc\('write_signature_via_portal'/);
    expect(handler).toMatch(/delivered = !error/);
  });

  it('shows the thank-you only on the delivered branch', () => {
    const thanks = handler.indexOf('showToast(t.signed)');
    expect(thanks).toBeGreaterThan(-1);
    // …and that call sits inside `if (delivered)`, not after the await.
    expect(handler.slice(0, thanks)).toMatch(/if \(delivered\) \{[^}]*$/);
  });

  it('keeps a refused signature instead of dropping it', () => {
    expect(handler).toMatch(/queueWrite\(\{\s*\n?\s*kind: 'signature'/);
    expect(handler).toMatch(/setSigned\('queued'\)/);
    expect(handler).toMatch(/showToast\(t\.signedLocal\)/);
  });

  it('says plainly when not even the device kept it', () => {
    expect(handler).toMatch(/showToast\(t\.notSaved\)/);
  });

  it('a signature queued on an earlier visit is not asked for twice', () => {
    // The pad renders on `!signed`, and `signed` is component state — a reload
    // would have shown an empty pad over a signature already waiting to send,
    // and the RPC INSERTs unconditionally.
    expect(PAGE).toMatch(/const hadSignature = !!code && hasPendingSignature\(code\)/);
    expect(PAGE).toMatch(/if \(hadSignature\) setSigned\(prev => prev \|\| 'queued'\)/);
    expect(PAGE).toMatch(/if \(res\.signatures > 0\) setSigned\('sent'\)/);
    expect(OUTBOX).toMatch(/export function hasPendingSignature/);
  });

  it('the banner tells the two apart', () => {
    // A queued signature must not render the green "✓ thank you".
    expect(PAGE).toMatch(/signed === 'sent' \? `✓ \$\{t\.signed\}` : `⏳ \$\{t\.signedLocal\}`/);
    expect(PAGE).toMatch(/useState<false \| 'sent' \| 'queued'>/);
  });

  it('releases the pad so a failed signature can be retried', () => {
    expect(PAGE).toMatch(/try \{ await onSign\(name\.trim\(\), path\); \} finally \{ setSaving\(false\); \}/);
  });
});

describe('a decision the backend refused is queued, not just announced', () => {
  const at = PAGE.indexOf('const submit = useCallback');
  const body = PAGE.slice(at, PAGE.indexOf('const uploadPhotos', at));

  it('enqueues before promising a later send', () => {
    expect(body).toMatch(/const kept = queueWrite\(\{/);
    expect(body).toMatch(/showToast\(kept \? t\.savedLocal : t\.notSaved\)/);
    // The success toast is on its own branch and returns.
    expect(body).toMatch(/if \(ok\) \{ showToast\(t\.saved\); return; \}/);
  });

  it('a photo answer that uploaded nothing is NOT called saved', () => {
    const up = PAGE.slice(PAGE.indexOf('const uploadPhotos'), PAGE.indexOf('const sendQuestion'));
    // A File cannot go in a localStorage outbox, so there is nothing to send
    // later — the old code said there was.
    expect(up).toMatch(/showToast\(t\.notSaved\)/);
    expect(up).not.toMatch(/showToast\(t\.savedLocal\)/);
  });
});

describe('the outbox is actually drained', () => {
  it('the page flushes on load and when the connection returns', () => {
    expect(PAGE).toMatch(/const res = await flushOutbox\(getSupabase\(\)\)/);
    expect(PAGE).toMatch(/addEventListener\('online', onOnline\)/);
    expect(PAGE).toMatch(/removeEventListener\('online', onOnline\)/);
  });

  it('an entry leaves the queue only when the backend accepted it', () => {
    const send = OUTBOX.slice(OUTBOX.indexOf('async function send'), OUTBOX.indexOf('export async function flush'));
    expect(send).toMatch(/const \{ error \} = await sb\s*\n?\s*\.from\('decision_submissions'\)/);
    expect(send).toMatch(/if \(error\) return false/);
    expect(send).toMatch(/return !error/);
    const flush = OUTBOX.slice(OUTBOX.indexOf('export async function flush'));
    expect(flush).toMatch(/if \(ok\) \{\s*\n\s*delivered \+= 1;/);
    expect(flush).toMatch(/if \(entry\.kind === 'signature'\) signatures \+= 1;/);
    expect(flush).toMatch(/keep\.push\(\{ \.\.\.entry, attempts \}\)/);
  });

  it('gives up rather than retrying a revoked code forever', () => {
    expect(OUTBOX).toMatch(/attempts < MAX_ATTEMPTS/);
    expect(OUTBOX).toMatch(/MAX_AGE_MS/);
  });

  it('reports honestly when localStorage itself refused', () => {
    const enq = OUTBOX.slice(OUTBOX.indexOf('export function enqueue'), OUTBOX.indexOf('export function pending'));
    // Quota/private-mode: setItem throws, and saying "we kept it" would be the
    // same lie one layer down.
    expect(enq).toMatch(/return read\(\)\.some\(\(e\) => e\.id === full\.id\)/);
  });

  it('replaying a decision cannot double-submit it', () => {
    expect(OUTBOX).toMatch(/onConflict: 'tracker_id,item_id,submitted_by'/);
  });
});

describe('the new copy exists in all six portal languages', () => {
  const LANGS = ['en', 'nl', 'de', 'fr', 'es', 'it'];
  it.each(LANGS)('%s has notSaved and signedLocal', (lang) => {
    const line = PAGE.split('\n').find((l) => l.startsWith(`  ${lang}: {`)) ?? '';
    expect({ lang, notSaved: /notSaved: ['"]/.test(line) }).toEqual({ lang, notSaved: true });
    expect({ lang, signedLocal: /signedLocal: ['"]/.test(line) }).toEqual({ lang, signedLocal: true });
    // …and not left in English for a market that does not read it.
    if (lang !== 'en') expect(line).not.toContain("notSaved: 'Not sent —");
  });
});
