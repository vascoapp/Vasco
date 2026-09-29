import { wasShareDismissed, SHARE_DISMISSED } from '../shareOutcome';

describe('wasShareDismissed', () => {
  it('is true only for an explicit dismissal', () => {
    expect(wasShareDismissed({ action: 'dismissedAction' })).toBe(true);
    expect(wasShareDismissed({ action: SHARE_DISMISSED })).toBe(true);
  });

  it('is false for a completed share', () => {
    expect(wasShareDismissed({ action: 'sharedAction' })).toBe(false);
    expect(wasShareDismissed({ action: 'sharedAction', activityType: 'com.apple.UIKit.activity.Mail' })).toBe(false);
  });

  /**
   * The trap this helper exists to avoid. A first version compared against
   * `Share.dismissedAction`; under a mock that leaves the constant undefined,
   * `undefined === undefined` reads EVERY share as dismissed — every send in
   * the app silently stops recording, all at once. Absence of an `action` is
   * absence of evidence, not evidence of dismissal.
   */
  it('treats a missing or malformed result as NOT dismissed', () => {
    expect(wasShareDismissed({})).toBe(false);
    expect(wasShareDismissed(undefined)).toBe(false);
    expect(wasShareDismissed(null)).toBe(false);
    expect(wasShareDismissed({ action: undefined })).toBe(false);
    expect(wasShareDismissed('dismissedAction')).toBe(false); // a bare string is not a result
  });

  it('pins the constant to React Native\'s own value', () => {
    // RN: `static dismissedAction: 'dismissedAction' = 'dismissedAction'`
    expect(SHARE_DISMISSED).toBe('dismissedAction');
  });
});

// ---------------------------------------------------------------------------
// Android never reports a dismissal (RN docs: "always resolved with
// Share.sharedAction", as soon as the chooser opens). Aannemer walk
// 2026-09-29: a backed-out share advanced the reminder queue and submitted a
// purchase order. A claim waits for iOS's word; a record asks on Android.
// ---------------------------------------------------------------------------
import { Alert, Platform } from 'react-native';
import { shareOutcome, confirmShareSent } from '../shareOutcome';

describe('shareOutcome / confirmShareSent', () => {
  const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  const realOS = Platform.OS;
  afterEach(() => { setOS(realOS); jest.restoreAllMocks(); });

  it('iOS: the sheet is the answer, nobody is asked', async () => {
    setOS('ios');
    const ask = jest.spyOn(Alert, 'alert');
    expect(shareOutcome({ action: 'sharedAction' })).toBe('shared');
    expect(await confirmShareSent({ action: 'sharedAction' })).toBe(true);
    expect(await confirmShareSent({ action: 'dismissedAction' })).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it('Android: a "shared" result is unknown, so a claim is withheld', () => {
    setOS('android');
    expect(shareOutcome({ action: 'sharedAction' })).toBe('unknown');
  });

  it('Android: a record waits for the contractor — yes records, not-yet does not', async () => {
    setOS('android');
    const pick = (i: number) => jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, buttons) => { buttons?.[i]?.onPress?.(); });
    pick(1);
    expect(await confirmShareSent({ action: 'sharedAction' })).toBe(true);
    jest.restoreAllMocks();
    pick(0);
    expect(await confirmShareSent({ action: 'sharedAction' })).toBe(false);
  });

  it('Android: dismissing the question is "not yet"', async () => {
    setOS('android');
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _b, _buttons, opts) => { (opts as any)?.onDismiss?.(); });
    expect(await confirmShareSent({ action: 'sharedAction' })).toBe(false);
  });
});

// Repo guard: nothing decides "it went out" from the raw dismissal signal.
describe('no live code trusts the raw dismissal signal', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('../stripComments');
  const manifest = require('../../config/dormant.files.json');
  const ROOT = path.resolve(__dirname, '../../..');
  const dormant = new Set<string>(manifest.files);
  // Uses it only to skip its OWN "Did you file it?" question — which Android
  // therefore always shows. That is the correct direction.
  const ALLOWED = new Set(['app/invoices/[id].tsx', 'src/utils/shareOutcome.ts']);
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e: any) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

  it('uses shareOutcome / confirmShareSent instead', () => {
    const hits = ['app', 'src'].flatMap((d) => walk(path.join(ROOT, d)))
      .map((f: string) => path.relative(ROOT, f))
      .filter((f: string) => !dormant.has(f) && !ALLOWED.has(f))
      .filter((f: string) => /\bdismissedAction\b|wasShareDismissed\(/.test(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
    expect(hits).toEqual([]);
  });
});

// Review 2026-09-29: a file-level "uses shareOutcome" check cannot tell a
// claim from a record — `if (shareOutcome(res) !== 'dismissed') markSent()`
// is the Android bug again and would pass. So: every use compares with
// 'shared', and none is followed by something that RECORDS.
describe('shareOutcome gates claims only', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('../stripComments');
  const manifest = require('../../config/dormant.files.json');
  const ROOT = path.resolve(__dirname, '../../..');
  const dormant = new Set<string>(manifest.files);
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e: any) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
  const RECORD = /\bmark[A-Z]\w*\(|\bsubmit\(|executed:\s*true|\bstatus:|set\w*Sent\(|\bdelivered\s*=\s*true|updateStatus\(|recordOutcome\(/;
  const uses = ['app', 'src'].flatMap((d) => walk(path.join(ROOT, d)))
    .map((f: string) => path.relative(ROOT, f))
    .filter((f: string) => !dormant.has(f) && f !== 'src/utils/shareOutcome.ts')
    .flatMap((f: string) => {
      const lines = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n');
      return lines.flatMap((l: string, i: number) => (/\bshareOutcome\(/.test(l) && !/import/.test(l)
        ? [{ at: `${f}:${i + 1}`, line: l, after: lines.slice(i, i + 4).join('\n') }] : []));
    });

  it('finds the claim sites it guards', () => { expect(uses.length).toBeGreaterThanOrEqual(4); });

  it('compares only with "shared"', () => {
    expect(uses.filter((u: any) => !/shareOutcome\([^)]*\)\s*[!=]==\s*'shared'/.test(u.line)).map((u: any) => u.at)).toEqual([]);
  });

  it('is never followed by a record', () => {
    expect(uses.filter((u: any) => RECORD.test(u.after)).map((u: any) => u.at)).toEqual([]);
  });
});

// Review 2026-09-29 (second pass): two ways a claim could creep back.
describe('claims wait for the send', () => {
  const fs = require('fs');
  const path = require('path');
  const { stripComments } = require('../stripComments');
  const ROOT = path.resolve(__dirname, '../../..');
  const read = (f: string) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));

  // askIfUnknown:false trades the question for the platform's word — fine for
  // a caller that does not record, the Android bug again for one that does.
  it('askIfUnknown:false is only used where the result is not recorded unguarded', () => {
    const src = read('app/quotes/[id].tsx');
    const at = src.indexOf('askIfUnknown');
    expect(at).toBeGreaterThan(-1);
    const after = src.slice(at, at + 200);
    expect(after).toMatch(/if \(statusCanChange && fallback\.shared\) markQuoteSent/);
  });

  // An approve handler buzzed success BEFORE the executor ran, so a card the
  // contractor then answered "not yet" for had already claimed success.
  it.each(['app/(contractor)/index.tsx', 'app/(contractor)/geld.tsx'])(
    '%s buzzes success only for an executed action', (f) => {
      const src = read(f);
      const at = src.indexOf('executeApprovedQueueItem(');
      expect(at).toBeGreaterThan(-1);
      const before = src.slice(Math.max(0, at - 500), at);
      expect(before.lastIndexOf('aiQueue.approve(')).toBeGreaterThan(-1);
      // From the handler's start — Geld buzzed before approve() itself.
      const handler = before.slice(before.lastIndexOf('async'));
      expect(handler).not.toMatch(/hapticSuccess\(\)/);
      expect(src.slice(at, at + 200)).toMatch(/if \(r\.executed\) hapticSuccess\(\)/);
    },
  );
});
