# Convergence plan — from "find what's broken" to "prove what ships works"

Started 2026-09-24. Owner: the agent working the codebase; decisions marked 🔴 are the user's.

## Why two weeks of fixing did not converge

Learnings run from #200 to #368, and each class sweep still finds a dozen
defects. The fixes hold: about 100 decoy-proven guards stop fixed classes from
coming back. The count stays high for four reasons:

1. **Most of the app has never been proven to work.** It has ~96 screens, 50+
   services, 45 generators, 19 accounting providers and 6 markets × 6
   languages. Demo mode renders fixtures, and demo accounts have no backend
   session, so "it renders" was taken for "it works". Each sweep is the first
   real look at that code.
2. **The code fails silently by construction.** Writes use `catch {}` and
   return void; defaults like `?? 'NL'`, `'Klant'` and `'en'` fill in unknown
   values; success messages don't wait for their write. None of these crash,
   so nothing points at them.
3. **The test harness is blind to whole classes.** `jest.setup.ts` replaces
   app logic with stubs in every test:
   - the i18n module ignores the language (only 4 of 302 unit test files see
     real language);
   - `getCustomerIntelligence` always returns `null`, so no test had ever seen
     a customer context line;
   - the cohort benchmarks and scan history are empty;
   - the backend is "not configured", so no data path meets the real schema.

   A green run therefore said nothing about language, customer context, the
   pricing moat or database writes.
4. **Sweeping a shape across ~96 screens is open-ended.** Every sweep enters
   new ground, so the finding count measures how much is left unexamined, not
   whether fixes work.

## What converged means

- A sweep of the **core surface** (defined in P1) finds **0 HIGH** two weeks in a row.
- **No global test stub hides app logic.**
- The **golden path** (P2) passes nightly against the live backend, judged by
  the rows it writes and the documents it produces.
- Every defect class found has a guard that fails when the class returns.

Tracked weekly in `memory/sweep-2026-09-23-classes.md` (metrics section).

## P0 — Remove the harness's blind spots (started 2026-09-24; P0.1 + P0.3 DONE same day)

The highest leverage: one change here covers every test and every class at
once. Rule for each stub: **remove it, run the suite, triage every new
failure**:
- **(a) the test relied on the stub** → give that test its own explicit mock;
- **(b) real defect** → fix it, write a biting guard, record it.

| Stub in `jest.setup.ts` | Hides | Order |
|---|---|---|
| `src/intelligence/tradeContext` → `null` | customer context on queue cards | 1 (smallest) |
| `src/services/cohortBenchmarkService` → empty | the cross-contractor pricing moat | 2 |
| `src/services/invoiceScanService` → empty | the photo → price pipeline | 3 |
| `src/i18n/i18n` + `react-i18next` → language-blind `t` | every language defect | 4 (largest) |
| `src/lib/supabase` → "not configured" | every write against the real schema | 5 — replace with P0.3 |

- **P0.2 Silent-default inventory.** One static guard per shape, each with a
  reasoned allow-list that fails on new instances:
  - `?? 'NL'` / `|| 'NL'` in any nudge or format path;
  - a string literal in stored copy (queue cards, pushes, PDFs, inbox);
  - `catch {}` around a write;
  - `ok` read without the payload.
- **Done 2026-09-24.** Real i18n found a live defect straight away: Dutch
  customers got legacy automation texts, and the appointment SMS was just
  "Morgen". The fake backend (`src/test-utils/fakeSupabase.ts`, schema
  snapshot of 92 tables / 1,105 columns, `npm run schema:snapshot`) is now
  the global default: configured, nobody signed in. Every update mapper is
  checked against the live columns. **Next:** run the screen-walk flows on
  the fake with a signed-in contractor, so AppState's inline create payloads
  hit the schema too.
- **P0.3 Fake backend for unit tests.** An in-memory PostgREST fake that
  enforces what production enforces:
  - `max_rows = 1000`;
  - column names from a snapshot of the LIVE schema, so unknown columns are rejected;
  - NOT NULL columns;
  - rows owned by the signed-in user.

  With it, data-path tests stop passing on mocks that accept anything.

## P1 — Shrink the surface

- **P1.1 Reachability map.** Starting from the tab layouts in the production
  posture (`DEMO_MODE` off, roles contractor and aannemer), follow
  `router.push` / `Link` / `href` to a graph. List every screen, component and
  service no contractor can reach. Known examples:
  - the `(tabs)` dashboards, which `_layout` redirects everyone away from;
  - `HandoverPackBuilder` and its invented URLs;
  - `documentVaultService.createShareLink`;
  - `reputationService.requestReview`;
  - the `predictiveMaintenanceService` fixtures.
- **P1.1 DONE 2026-09-24** — docs/P1_REACHABILITY.md.
- **P1.2 🔴 Delete or quarantine.** You decide from one list. Every deletion
  removes future findings for good.
- **P1.3 Gate what is reachable but not ready** for the beachhead market (DE).

## P2 — Prove the core path by its outcomes

- **P2.1 Golden path, nightly, against the live backend**, with a real German
  test account:
  1. customer
  2. quote (PDF text)
  3. anonymous portal acceptance
  4. job + hours + materials
  5. invoice (PDF text + XRechnung validated)
  6. payment webhook → paid
  7. dunning
  8. VAT export

  Each step asserts the **database rows and the artefact**, never the screen.
  It extends `smoke:golden` / `smoke:customer` and reports to the watchdog.
- **P2.2** The same for NL, then FR/ES/IT once P2.1 is stable.

## P3 — Sweep only what remains, ordered by reach × harm

Sweep only on the core surface, money/legal/customer-facing first.
- Each finding gets a guard.
- Each sweep records its count, which is the convergence metric.
- No sweep of code P1 has removed.

## Queue (user's list from 2026-09-24, fitted into the plan)

- DATANORM duplicate check → server-side (removes up to ~3 MB per supplier
  from Android's ~6 MB store). Do it with P0.3's fake backend, which can test it.
- Licenses screen writes over the list before hydrate (D4b) — small; together
  with the P0.2 "seed-once form" guard.
- Share checks in the constant form (5 files) → `wasShareDismissed`; the
  100k-row silent stop; Android never reports a dismissed share (document it,
  do not fake it).
- Mollie deposit description hardcoded Dutch.
- Rest of the sweep tracker: C5–C7, B5, B7, D5, D6, E5–E9, A1b, A5–A7 —
  re-ranked after P1 removes what is unreachable.

## Metrics (update weekly)

| Date | Global app-logic stubs | Unit files with real i18n | Unreachable files | HIGH found in core-surface sweep |
|---|---|---|---|---|
| 2026-09-24 | 5 | 4 / 302 | not measured | — |
| 2026-09-24 (eve) | 0 (tradeContext, cohort, scan, i18n removed; backend = fake with live schema) | all (real i18n global) | 243 files / 88k lines (30%) — `npm run audit:reach`, docs/P1_REACHABILITY.md | 7 dead prod paths found by the new net, all fixed |
