/**
 * @jest-environment node
 */
// A client-side store must be in THREE places or it is not persisted:
// the `useState` initialiser, a persist `useEffect`, and the hydrate list in
// the mount effect. `lineItems` was in the first only, so every quote and
// invoice a contractor created reopened with no lines and recomputed its own
// total to € 0,00 (learnings #205). That rule is in CLAUDE.md and has never
// had a guard — this is it.
//
// Since 2026-09-18 there is a FOURTH place, for the shipping build: `CACHE_KEYS`,
// the list production hydrates from and the list a change of account wipes. A
// key missing from it is one contractor's data left on disk for the next
// account to read (#348's neighbour).
//
// The three lists must name exactly the same stores. Anything in one and not
// the others is the bug this catches.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

const SRC = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../AppState.tsx'), 'utf8'),
);

/** `AsyncStorage.setItem('@vasco_x', …)` inside a persist effect. */
const persisted = new Set(
  [...SRC.matchAll(/AsyncStorage\.setItem\('(@vasco_[a-z_]+)', JSON\.stringify\(/g)].map((m) => m[1]),
);

/** Read back on mount: the `[key, setter]` pairs plus the two singles. */
const hydrated = new Set([
  ...[...SRC.matchAll(/\['(@vasco_[a-z_]+)', set[A-Z]\w+\]/g)].map((m) => m[1]),
  ...[...SRC.matchAll(/AsyncStorage\.getItem\('(@vasco_(?:line_items|business_profile))'\)/g)].map((m) => m[1]),
]);

/** The production cache list — hydrate source AND what an account switch drops. */
const cacheKeys = new Set(
  [...SRC.slice(SRC.indexOf('const CACHE_KEYS'), SRC.indexOf('const CACHE_OWNER_KEY'))
    .matchAll(/'(@vasco_[a-z_]+)'/g)].map((m) => m[1]),
);

const sorted = (s: Set<string>) => [...s].sort();

describe('the three lists name the same stores', () => {
  it('found all three, and they are not empty', () => {
    // Pinned: a regex that stops matching would otherwise report agreement
    // between three empty sets.
    expect(persisted.size).toBeGreaterThanOrEqual(9);
    expect(hydrated.size).toBeGreaterThanOrEqual(9);
    expect(cacheKeys.size).toBeGreaterThanOrEqual(9);
  });

  it('everything persisted is hydrated back', () => {
    // The `lineItems` shape: written on every change, read on no launch.
    expect(sorted(persisted)).toEqual(sorted(hydrated));
  });

  it('everything persisted is owned by the account that wrote it', () => {
    // A key absent from CACHE_KEYS is not dropped when a different contractor
    // signs in on the same device.
    expect(sorted(persisted)).toEqual(sorted(cacheKeys));
  });
});

describe('a store that is cleared is a store that exists', () => {
  it('the seed-reset list names only real stores', () => {
    // `@vasco_decision_trackers` is cleared on a seed-version bump but is
    // neither persisted nor hydrated: either it is a leftover from a store
    // that was removed, or a store that was never wired up. Naming it here
    // stops the list from quietly growing more of them.
    const block = SRC.slice(SRC.indexOf("const storedVersion"), SRC.indexOf("setItem('@vasco_seed_version'"));
    const cleared = new Set([...block.matchAll(/'(@vasco_[a-z_]+)'/g)].map((m) => m[1]));
    cleared.delete('@vasco_seed_version');
    const orphans = [...cleared].filter((k) => !persisted.has(k));
    expect(orphans).toEqual(['@vasco_decision_trackers']);
  });
});
