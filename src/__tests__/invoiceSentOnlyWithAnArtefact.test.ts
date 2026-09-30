// An invoice becomes SENT only when something reached the customer: a
// delivered email, or a share the contractor confirmed. Three screens marked
// it on a tap — the invoice screen's "Mark as sent" (every status, before the
// email), the quote→invoice "Mark sent", Geld's paper plane (W9) — and each
// started a payment clock on a document nobody had (2026-09-30).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const dormant = new Set(require('../config/dormant.files.json').files as string[]);
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
  return /\.tsx?$/.test(e.name) ? [path.relative(ROOT, p)] : [];
});

// Each allowed call, with the proof that precedes it on the same line.
const ALLOWED: Record<string, RegExp[]> = {
  'app/invoices/[id].tsx': [
    /if \(result\.ok && firstSend\) markInvoiceSent\(/,           // the email was delivered
    /\(await askWasSent\(\)\)\) markInvoiceSent\(/,                 // the contractor confirmed the share
  ],
};

it('only calls markInvoiceSent behind a delivered email or a confirmed share', () => {
  const offenders: string[] = [];
  for (const f of walk(path.join(ROOT, 'app')).concat(walk(path.join(ROOT, 'src/components')))) {
    if (dormant.has(f)) continue;
    const lines = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (!/\bmarkInvoiceSent\(/.test(line)) return;
      if ((ALLOWED[f] ?? []).some((re) => re.test(line))) return;
      offenders.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(offenders).toEqual([]);
});

it('the allowed calls still exist (a refactor must move this list with it)', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'app/invoices/[id].tsx'), 'utf8'));
  for (const re of ALLOWED['app/invoices/[id].tsx']) expect(src).toMatch(re);
});
