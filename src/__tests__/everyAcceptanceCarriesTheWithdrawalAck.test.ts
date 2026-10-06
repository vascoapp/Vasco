/**
 * Every caller of decide_acceptance_link passes p_withdrawal_ack, and the
 * customer pages show the French withdrawal notice before accepting.
 *
 * The RPC REQUIRES the acknowledgement for a French contractor (L221-5/L221-9,
 * migration 20260831000001). The accept-only page sent it; the quote portal
 * did not — harmless while the portal link never worked, but once it did
 * (2026-10-06) EVERY French acceptance failed with withdrawal_ack_required
 * (FR walk). Live counterpart: check:portal-totals (FR without ack refused,
 * with ack accepted).
 */
import * as fs from 'fs';
import * as path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.join(__dirname, '../..');
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

it('every decide_acceptance_link call passes p_withdrawal_ack', () => {
  const callers: string[] = [];
  for (const f of [...files(path.join(ROOT, 'src')), ...files(path.join(ROOT, 'app')), ...files(path.join(ROOT, 'admin/src'))]) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/rpc(?: as any\))?\(\s*'decide_acceptance_link',\s*\{([\s\S]*?)\}\s*\)/g)) {
      callers.push(path.relative(ROOT, f));
      expect({ file: path.relative(ROOT, f), passesAck: /p_withdrawal_ack\s*:/.test(m[1]) }).toEqual({ file: path.relative(ROOT, f), passesAck: true });
    }
  }
  // The three known callers: the app, the accept-only page, the quote portal.
  expect(new Set(callers).size).toBeGreaterThanOrEqual(3);
});

it.each(['admin/src/app/quote/[id]/page.tsx', 'admin/src/app/accept/[token]/page.tsx'])('%s shows the notice and holds the accept button for a French contractor', (f) => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  expect(src).toMatch(/const needsWithdrawalNotice = \([^)]*country[^)]*\)\.toUpperCase\(\) === 'FR'/);
  expect(src).toMatch(/disabled=\{needsWithdrawalNotice && !withdrawalAck\}/);
  expect(src).toMatch(/copy\.withdrawalBody/);
});
