# Trade handover dependencies — design, and what shipped

**Status: BUILT 2026-08-10.** `src/services/projectSequenceService.ts` +
`dependsOn` on `ProjectMilestone`, surfaced on the week view and project detail.
Designed 2026-08-09; the milestone editor prerequisite flagged in red below
shipped in `0756a63` first, exactly as the suggested order says.

**One decision changed under test — decision 4, see the note beside it.** The
rest were implemented as written.

**Still not built:** trade-order templates per project type (option 3 under "How
it gets edited"). A new project still arrives with an empty milestone list; the
aannemer builds the sequence by hand once. That is the remaining gap between
"a feature people use" and "one they have to set up first".

---

## 🔴 Read this first: milestones have no write path at all

Verified while writing this design, and it changes what should be built next.

- `projects.tsx:61` creates **every** project with `milestones: []`.
- `projects/[id].tsx:271-286` renders the milestone list **read-only** — no add,
  no edit, not even a tap to mark one complete.
- `addMilestone` / `updateMilestone` / `setMilestones` — **zero hits in the
  entire codebase.**

So `ProjectMilestone.trade`, `weekNumber`, `completed` and `jobIds` are
structurally empty for every project that has ever existed, and **the week-view
staffing-gap strip shipped in `7ad78bc` can never fire for anyone.** It reads a
list that is always `[]`.

That is the same shape as Verloning reading a store nothing writes to
(learnings #133) and as `ProjectMilestone.trade` sitting unread for months
(#129) — one layer earlier.

**Consequence for this design: `dependsOn` is NOT the next thing to build.**
Adding a dependency field to a model nobody can populate would put a second
unwritable field on an unwritable model and make the dead feature bigger. The
prerequisite is a **milestone editor**. The schema below is still right; it
should land *with* or *after* that editor, never before it.

Suggested order:
1. Milestone editor (add / rename / set trade + week / mark complete) on
   project detail. **This alone switches on the week-view staffing strip that
   is already built, tested and shipped.** Highest value per unit of work on
   this thread by a wide margin.
2. Default the chain (see "How it gets edited") and add `dependsOn`.
3. Surface blocked/slipped states.

---

## The problem

A renovation runs trades in sequence: sloop → loodgieter → tegelzetter →
stucwerk. `ProjectMilestone` already carries `trade` and `weekNumber`, and the
week view reads both to flag "week 3 has arrived and no tiler is on this
project".

But **`weekNumber` is an absolute offset from project start, and nothing moves
it.** If the plumber runs four days over, the tiler's milestone still claims
week 3. The board keeps asserting a plan that reality has already left behind,
and the aannemer finds out on the Monday when a tiler arrives to a room that
isn't ready — the exact failure the week view was built to prevent, one step
downstream.

The missing fact is not a date. It is **which milestone cannot start until
which other milestone is finished.**

---

## Proposed schema change

One field on `ProjectMilestone`:

```ts
export interface ProjectMilestone {
  id: string;
  title: string;
  trade?: string;
  weekNumber: number;      // THE PLAN — never written by the engine
  completed: boolean;
  jobIds: string[];
  /**
   * Milestone ids that must be `completed` before this one can start.
   * Empty/absent = can start on its planned week. Unknown ids are ignored
   * (a deleted predecessor must not block the project forever).
   */
  dependsOn?: string[];
}
```

**No migration — verified, not assumed.** `projects.milestones` is JSONB
(migration 20260501000001) and the array round-trips whole: read at
`AppState.tsx:505` (`Array.isArray(r.milestones) ? r.milestones : []`), written
at 3632 / 3656 / 3729, typed `unknown[]` in `database.types.ts:453`. Nothing
inspects the element shape, so a new field inside a milestone needs no
migration and no mapper change — the same situation as `JobTimeEntry` on
`jobs.time_entries`. Rule #8 is satisfied by the domain type plus
`database.types.ts`.

---

## Six decisions I want signed off

**1. `weekNumber` stays the plan; the forecast is derived, never stored.**
A new pure `projectSequenceService` computes `projectedWeek` per milestone.
Writing the forecast back into `weekNumber` would destroy the plan-vs-actual
comparison that makes a slip visible at all, and a stored copy of a derived
value rots (learnings #115, `dueInDays`). Cost: recomputed on render. Fine —
it is a handful of milestones.

**2. `completed` stays the only thing that marks a predecessor done.**
Tempting alternative: derive completion from `jobIds` all being completed. That
would make **a milestone with no jobs auto-complete** — an empty set scored as a
good outcome (#120), and here it would silently unblock the whole chain behind
it. Jobs may *suggest* ("all 3 jobs done — mark rough-in complete?"); only the
aannemer asserts it.

**3. A cycle claims nothing.** `dependsOn` is a graph and a user can draw
A→B→A. Detect it, and on detection treat the milestones in the cycle as having
**no dependency** rather than throwing or looping. Same posture as
crewWeekService: no `startDate` → no gap claimed, rather than a deadline
invented. A cycle is a planning mistake to surface, not a crash.

**4. Slip propagates forward only, and only from real evidence.**
A successor moves when a predecessor is **incomplete and its planned week has
passed**. It does NOT move on a guess about how late the predecessor will be —
we do not know that. The claim is "this cannot start yet", not "this will
finish on the 14th". Anything stronger is a fabricated date on a plan the
aannemer will schedule people against (#103).

> ⚠️ **CHANGED IN IMPLEMENTATION.** The first cut carried the plan's *full*
> interval forward: `projected(m) = max(planned(m), projected(p) + plannedLag)`.
> A test written straight off this paragraph killed it. With sloop due week 1
> running one week over, a tegels milestone planned for **week 8** was reported
> as slipping to week 9 — which asserts the entire seven-week gap is serial
> work. The plan never said that, and with no durations there is nothing that
> could say it. That is precisely the fabricated date this decision forbids,
> arriving through the propagation rule rather than the input.
>
> Shipped rule: **a lower bound, not a carried lag.** One piece of evidence —
> an incomplete milestone whose week has passed cannot complete before the
> current week — plus one structural claim: a successor cannot complete in the
> same week as its predecessor *unless the plan itself put them in the same
> week* (concurrent trades). A successor with room in the plan absorbs the
> delay instead of inheriting it, so the strip stops crying wolf.
>
> This also means a milestone can be late **on its own account**, with no
> `dependsOn` at all. That is the base case everything else propagates from.

**5. This is not a Gantt engine.** No durations, no float, no critical path, no
resource levelling. One question only: *what is blocked, by what, and has my
end date moved?* Milestones are week-grained because `weekNumber` is. If we
later want day-grained sequencing that is a different, bigger change.

**6. No trade is not no dependency.** crewWeekService treats a milestone with
no `trade` as not-a-staffing-gap. Sequencing is independent of that — an
untraded milestone ("vergunning afgegeven") is a perfectly good predecessor.
The two rules must not be conflated.

---

## What surfaces, and where

- **Week view** (`drag-schedule?view=week`) — the staffing strip gains a
  blocked state: *"Tegelzetten — wacht op Loodgieterswerk"*. Today the strip
  says nobody of that trade is booked; this says booking one would not help.
- **Project detail** — milestones list shows the wacht-op relation and any
  projected slip against the plan.
- **Copy already exists**: `schedule.siteHop` precedent shows the pattern; new
  keys `sequence.waitingOn` / `sequence.slipped` ×6.

⚠️ **Whatever is added must re-check the aggregates on those screens.** Adding a
dimension leaves every existing total measuring the old one (#127 — the crew
board's "9u/10u" above lanes reading 5/10 and 4/10).

---

## How it gets edited

This is the part that decides whether the feature is real, and it is why the
milestone editor has to come first (see the red section at the top).

Once milestones can be created, `dependsOn` needs a source:

1. **Infer a default chain from `weekNumber` order** — each milestone depends
   on the one before it. Zero extra UI, matches how a renovation actually runs,
   and the aannemer only edits the exceptions.
2. A dependency picker in project detail (real UI work, allows a non-linear
   graph).
3. Trade-order templates per project type (sloop→loodgieter→tegelzetter→
   stucwerk as shipped content), applied when a project is created — this also
   solves the "empty milestone list" problem at the same time.

**Recommendation: (3) to seed, (1) to default the links, (2) only if someone
asks.** A badkamer and a keuken have a known trade order; shipping that as
content means a new project arrives with a usable plan instead of an empty
list, which is the difference between a feature people use and one they have to
build by hand before it does anything.

⚠️ Shipped templates are **content, not demo data** — `f5105a2` is the
precedent: `BUILTIN_TEMPLATES` told a day-one contractor "34× gebruikt" about
their own past behaviour. Ship the trade ORDER, never usage statistics.

---

## Test plan

Pure service → unit tests, in the shape of `crewWeekService`/`payrollService`:
- a milestone with a completed predecessor is not blocked
- an incomplete predecessor whose week has passed blocks its successor
- an incomplete predecessor whose week has NOT passed does not block
- slip propagates through a chain of three
- a cycle claims no dependency instead of hanging
- an unknown/deleted predecessor id is ignored, not treated as blocking
- a milestone with no trade can still be a predecessor
- `weekNumber` is never mutated

Plus a `__screenwalk__` test that the week view renders the blocked state, in
both postures.

---

## Estimate

Schema + service + tests: small. Surfacing on two screens + 6 locales: medium.
The milestone-editing decision above is what actually sets the size.
