/**
 * REPO-WIDE: a cancelled share is not a send.
 *
 * `Share.share` RESOLVES with `{ action: 'dismissedAction' }` — it does not
 * throw — and `Sharing.shareAsync` returns `Promise<void>` and cannot report
 * cancellation at all. Code that awaits either and then writes state has
 * recorded something that did not happen.
 *
 * This class has now bitten four times (learnings, walk-in-the-target-language):
 *   - R71 ai.tsx, then actionExecutor + bedrijf: "Reminder sent", queue item
 *     marked done, written to the action log collections escalation reads.
 *   - facturen.tsx: alerted "Betaalherinnering verstuurd" while sending nothing.
 *   - 2026-08-27, the worst one: all three e-invoice exports in
 *     app/invoices/[id].tsx called `markEInvoiceSubmitted` + `recordHandover`
 *     unconditionally — including from the `catch` block. `einvoiceSubmitted`
 *     is what aiActionQueueService filters on to raise the mandate reminder, so
 *     a cancelled export silently switched the reminder off for good; and a
 *     FatturaPA that never reached SDI is a legal non-event.
 *
 * The rule: any file that shares must either check `dismissedAction`, or be
 * classified below as sharing something whose cancellation has no consequence.
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../src/utils/stripComments';

const ROOT = path.join(__dirname, '..');
const ROOTS = ['app', 'src'];
const SKIP = ['node_modules', '__tests__', '__screenwalk__', 'test-utils'];

/**
 * Shares whose cancellation costs nothing: the payload is a copy of data the
 * contractor already has, and no state is written on the strength of it.
 * A NEW sharing file fails until it is guarded or classified here; a stale
 * entry fails too, so this cannot rot into a blanket exemption.
 */
// `customerQuoteAcceptanceService.ts` left this list with it: it now
// reports `shared` from the share result, which is what the caller marks the
// quote sent on.
// `app/quotes/[id].tsx` left this list on 2026-09-16: sharing the quote now
// DOES have a consequence — it marks the quote sent — so the share result is
// read (#339). The banner used to mark it sent before sharing anything.
const NO_CONSEQUENCE: Record<string, string> = {
  // ── Exports: a copy of data the contractor is already looking at. ──────────
  'app/contractor/reports.tsx': 'CSV/PDF of a report already on screen. No state write.',
  'app/contractor/vat-and-audit.tsx': 'Audit-trail dump. The only Alert is in the catch (an error path).',
  'app/contractor/vat-prep.tsx': 'VAT-prep export. Alert is the catch branch.',
  'app/(contractor)/besparen.tsx': 'Shares a savings summary already on screen.',
  'app/contractor/payroll.tsx': 'Payroll export. Alert is the catch branch.',
  'app/(contractor)/geld.tsx': 'Shares a summary; nothing follows the await.',
  'app/contractor/accountant-access.tsx': 'Shares the accountant link; nothing follows the await.',
  'app/contractor/message-templates.tsx': 'Shares a template body for the contractor to reuse.',
  'app/contractor/repeat-work.tsx': 'Shares a maintenance list. Alert is the catch branch.',
  'app/contractor/referrals.tsx': 'Shares a referral link; the `refresh()` after it re-reads state rather than asserting a send.',
  'src/services/budgetPdfService.ts': 'PDF generator — hands the file over, records nothing.',
  'src/services/invoicePdfService.ts': 'PDF generator — records nothing.',
  'src/services/quotePdfService.ts': 'PDF generator — records nothing.',
  'src/services/financialReportService.ts': 'Report generator — records nothing.',
  'src/services/vatPrepExportService.ts': 'Export generator — records nothing.',
  'src/services/dataExportService.ts': 'GDPR data export — records nothing.',
  'src/services/receiptShareService.ts': 'Receipt image share — records nothing.',
  'src/services/calendarExportService.ts': 'ICS export. Alert is the catch branch.',
  'src/components/contractor/ShareQuoteButton.tsx': 'Only `setBusy(false)` follows — a spinner, not a claim.',
  'src/components/contractor/ShareDecisionTracker.tsx': 'Three shares; every Alert is a catch-branch fallback that shows the link so the contractor can copy it manually. `setLinkCopied` is UI feedback for the copy, not the send.',
  'src/components/shared/ErrorBoundary.tsx': 'Shares a crash report. No product state.',
  'app/contractor/material-search.tsx': 'The purchase orders are created BEFORE the share; the share is a receipt of work already done, so cancelling it must not undo them.',

  // ── Watch item, deliberately not "fixed" ──────────────────────────────────
  'src/components/shared/VascoCard.tsx':
    'Fires a "did it work?" feedback prompt on a timer after sharing, so it also asks after a dismissed sheet. It records the contractor ANSWER, not the send, so a cancelled share produces a slightly silly question rather than a false record. Left alone rather than guarded because the honest fix is to not ask at all when dismissed, and that is a UX call.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.some((s) => e.name === s) || e.name.includes('__decoy__')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if ((e.name.endsWith('.ts') || e.name.endsWith('.tsx')) && !e.name.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * Read a file, or return '' if it vanished underneath us.
 *
 * Sibling detectors write a temporary decoy file into `app/` to prove they can
 * fail, and jest runs suites in parallel — so a plain readFileSync here died
 * with ENOENT on `app/__chip_decoy__.tsx` mid-run. A detector must not be
 * coupled to another suite's scratch files.
 */
function readOrEmpty(f: string): string {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
}

const SHARES = /\b(Share\.share|RNShare\.share|Sharing\.shareAsync)\s*\(/;
// `await Share.share(` whose result is NOT assigned (no `=` just before).
const BARE_SHARE = /(?<![=(,]\s*)(?<![=(,])\bawait\s+(?:Share|RNShare)\.share\s*\(/g;

/** Index just past the `)` that closes the `(` at `open`. */
function callEnd(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i + 1;
    else if (c === '`' || c === "'" || c === '"') {
      // skip a string literal (template ${} nesting is rare in share args and
      // balanced parens inside it are harmless to the depth count)
      const q = c;
      for (i++; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++;
    }
  }
  return src.length;
}

describe('a cancelled share is not a send', () => {
  const files = ROOTS.flatMap((r) => walk(path.join(ROOT, r)));
  const sharing = files
    .filter((f) => SHARES.test(readOrEmpty(f)))
    .map((f) => path.relative(ROOT, f));

  // Guarded = checks the outcome, either through the shared helper (preferred,
  // src/utils/shareOutcome.ts) or by naming the constant directly.
  const unguarded = sharing.filter((f) => {
    const src = readOrEmpty(path.join(ROOT, f));
    return !src.includes('wasShareDismissed') && !src.includes('dismissedAction');
  });

  it('has no unguarded, unclassified share', () => {
    expect(unguarded.filter((f) => !(f in NO_CONSEQUENCE))).toEqual([]);
  });

  // Per CALL SITE, not per file (sweep 2026-09-23, B3). facturen.tsx checked
  // `dismissedAction` on two of its shares, so the file-level test above
  // passed — while its bulk reminder loop awaited a bare `Share.share` and
  // counted every backed-out sheet as "sent", and job/[id].tsx logged
  // "Sign-off link sent" the same way. A bare `await Share.share(…)` is only
  // safe as the LAST statement of its block: nothing can then act on it.
  it('no bare share is followed by code that could record it', () => {
    const offenders: string[] = [];
    for (const f of sharing) {
      if (f in NO_CONSEQUENCE) continue;
      const src = stripComments(readOrEmpty(path.join(ROOT, f)));
      for (const m of src.matchAll(BARE_SHARE)) {
        const end = callEnd(src, m.index! + m[0].length - 1);
        const next = src.slice(end).match(/^\s*;?\s*(\S)/)?.[1];
        if (next !== '}') offenders.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the call-site check detects the shape (decoy)', () => {
    const bad = stripComments("try { await Share.share({ message: m }); sent++; } catch {}");
    const ok = stripComments("if (x) { await Share.share({ message: `${a}` }); } else { y(); }");
    const at = (src: string) => { const m = [...src.matchAll(BARE_SHARE)][0]; return src.slice(callEnd(src, m.index! + m[0].length - 1)).match(/^\s*;?\s*(\S)/)?.[1]; };
    expect(at(bad)).toBe('s');
    expect(at(ok)).toBe('}');
  });

  it('has no stale classification', () => {
    expect(Object.keys(NO_CONSEQUENCE).filter((f) => !unguarded.includes(f))).toEqual([]);
  });

  it('keeps the e-invoice exports guarded', () => {
    // The specific regression that motivated this file: filing must never be
    // recorded straight off a share whose outcome we cannot observe.
    const src = fs.readFileSync(path.join(ROOT, 'app/invoices/[id].tsx'), 'utf8');
    expect(src).toContain('wasShareDismissed');
    // `markEInvoiceSubmitted` may appear only inside the confirmation handler,
    // never as a bare statement after an await of a share.
    const bad = /await\s+(RNShare\.share|Sharing\.shareAsync)\([^;]*\);[\s\S]{0,400}?markEInvoiceSubmitted/;
    expect(bad.test(src)).toBe(false);
  });

  it('detects the shape it is looking for', () => {
    const guardedSrc = "const r = await Share.share({}); if (r.action === Share.dismissedAction) return;";
    const unguardedSrc = "await Share.share({}); markInvoiceSent(id);";
    expect(SHARES.test(unguardedSrc)).toBe(true);
    expect(unguardedSrc.includes('dismissedAction')).toBe(false);
    expect(guardedSrc.includes('dismissedAction')).toBe(true);
  });
});
