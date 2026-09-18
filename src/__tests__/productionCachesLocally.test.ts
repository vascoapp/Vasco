/**
 * @jest-environment node
 */
// DECIDED 2026-09-18 (user): a shipping build caches the contractor's data
// locally, like the demo build always has.
//
// Hydrate and every persist effect were gated on `useSeedData` (= DEMO_MODE),
// so production started EMPTY on every cold start — a contractor in a basement
// or a new-build saw nothing until the network returned, and a job created
// offline lived only in memory plus the write queue (#339 S-H2). That also
// falsified the "#337 saves locally and the healer sends it later" claim.
//
// Static, because the alternative is mounting the whole provider: what matters
// is WHICH condition guards each effect, and that the account boundary exists.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const SRC = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../state/AppState.tsx'), 'utf8'),
);

describe('the shipping build keeps a local cache', () => {
  it('no persist effect is gated on DEMO_MODE any more', () => {
    expect(SRC).not.toMatch(/if \(useSeedData && persistReady\)/);
    // …and there are still plenty of them, so the check is not vacuous.
    const persists = SRC.match(/if \(persistReady\) \{/g) ?? [];
    expect(persists.length).toBeGreaterThanOrEqual(8);
  });

  it('production hydrates from the cache', () => {
    const at = SRC.indexOf('const hydrateFor');
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf('void hydrateFor(', at));
    expect(body).toMatch(/@vasco_jobs/);
    expect(body).toMatch(/@vasco_line_items/);
    expect(body).toMatch(/setPersistReady\(true\)/);
  });
});

describe('the cache belongs to one account', () => {
  const at = SRC.indexOf('const hydrateFor');
  const body = SRC.slice(at, SRC.indexOf('void hydrateFor(', at));

  it('does not read anything before it knows who is signed in', () => {
    // The guard that matters: no user id, no hydrate. Reading the cache while
    // the session is still restoring could put one contractor's invoices on
    // another's screen for that moment.
    expect(body).toMatch(/if \(!alive \|\| !userId \|\| hydratedFor === userId\) return;/);
  });

  it('re-checks ownership when a DIFFERENT account signs in mid-session', () => {
    // `hydrated.current` alone would skip the check on an in-process switch and
    // leave the previous contractor's books on disk under the new session.
    expect(body).toMatch(/hydratedFor = userId;/);
  });

  it('drops the cache when the owner is someone else', () => {
    expect(body).toMatch(/owner && owner !== userId/);
    expect(body).toMatch(/multiRemove\(CACHE_KEYS\)/);
  });

  it('stamps the owner so the next launch can tell', () => {
    expect(body).toMatch(/setItem\(CACHE_OWNER_KEY, userId\)/);
  });

  it('lists every cached store as owned, so none is left behind on a switch', () => {
    const keysBlock = SRC.slice(SRC.indexOf('const CACHE_KEYS'), SRC.indexOf('const CACHE_OWNER_KEY'));
    for (const key of ['@vasco_jobs', '@vasco_invoices', '@vasco_quotes', '@vasco_customers',
      '@vasco_projects', '@vasco_leads', '@vasco_workers', '@vasco_line_items',
      '@vasco_business_profile']) {
      expect(keysBlock).toContain(key);
    }
  });

  it('every key the production hydrate READS is one it would also drop', () => {
    const read = new Set([...body.matchAll(/'(@vasco_[a-z_]+)'/g)].map((m) => m[1]));
    const owned = new Set(
      [...SRC.slice(SRC.indexOf('const CACHE_KEYS'), SRC.indexOf('const CACHE_OWNER_KEY')).matchAll(/'(@vasco_[a-z_]+)'/g)]
        .map((m) => m[1]),
    );
    for (const key of read) expect({ key, owned: owned.has(key) }).toEqual({ key, owned: true });
  });
});
