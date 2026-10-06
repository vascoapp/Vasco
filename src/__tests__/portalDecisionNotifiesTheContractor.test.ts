/**
 * Every customer page that DECIDES a quote tells the contractor (W119).
 *
 * IT walk 2026-10-06: the customer accepted in the portal and read "your
 * tradesperson has been notified" — nothing notified anyone. The job and the
 * outcome event are now written by the RPC itself (migration 20261006000001,
 * live-proven by `npm run check:quote-decision`); the push is the
 * `quote-decided` edge function, which these pages must call after a decision.
 *
 * Same file: a decide callback that reads `withdrawalAck` must list it as a
 * dependency. /accept/[token] listed only [token, reason], so a French
 * customer who ticked the box still sent `false` and was refused.
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

const deciders = files(path.join(ROOT, 'admin/src/app'))
  .map((f) => ({ f: path.relative(ROOT, f), src: stripComments(fs.readFileSync(f, 'utf8')) }))
  .filter(({ src }) => /rpc\(\s*'decide_acceptance_link'/.test(src));

it('finds both decision pages', () => {
  expect(deciders.map((d) => d.f).sort()).toEqual(['admin/src/app/accept/[token]/page.tsx', 'admin/src/app/quote/[id]/page.tsx']);
});

it.each(deciders.map((d) => [d.f, d.src]))('%s notifies the contractor after a decision', (_f, src) => {
  const call = src.indexOf("rpc('decide_acceptance_link'");
  const notify = src.indexOf('notifyContractor(', call);
  expect(notify).toBeGreaterThan(call);
  // …after the "already decided" exit, so only a decision THIS call made pushes.
  expect(notify).toBeGreaterThan(src.indexOf("setPhase('alreadyDecided')", call));
});

it.each(deciders.map((d) => [d.f, d.src]))('%s: the decide callback depends on everything it sends', (_f, src) => {
  const start = src.lastIndexOf('useCallback(', src.indexOf("rpc('decide_acceptance_link'"));
  const deps = src.slice(start).match(/\},\s*\[([^\]]*)\]\s*\)/)?.[1] ?? '';
  expect(deps).toMatch(/\bwithdrawalAck\b/);
  expect(deps).toMatch(/\breason\b/);
});
