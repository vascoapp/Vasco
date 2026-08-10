#!/usr/bin/env python3
"""
Find optional domain fields that NOTHING in production ever writes.

The learnings #109 class: `x?: T` is declared, mapped, read and filtered on —
but only fixtures ever populate it, so the filter matches nothing for real users
while the demo looks perfect. Hit three times in two days (Job.trade,
Job.completedAt, job.address), so it gets a script.

Method, per field:
  WRITE  = `field:` appearing in an object literal, or `updates.field`, in a file
           that is NOT a fixture/seed/test/mapper.
  READ   = `.field` referenced anywhere in src/ or app/ outside its own type file.

A field with reads and no real writes is a candidate. Mappers are excluded from
"writes" deliberately: `completedAt: row.completed_at` is hydration FROM the
database, so it proves the column round-trips, not that anything ever captures a
value. That distinction is exactly what hid Job.completedAt for months.

Output is a candidate list to verify by hand — the script cannot see dynamic
writes (spread objects, `...patch`), so it over-reports rather than under.
"""
import re
import subprocess
from pathlib import Path

ROOT = Path("/Users/merle/Library/CloudStorage/GoogleDrive-ccollect.ai@gmail.com/Mijn Drive/Vasco/VascoApp")

# Core entities a contractor actually touches. Deliberately not every type in the
# repo: compliance/enterprise types are prototypes (see learnings #107 addendum)
# and would drown the signal.
TYPE_FILES = [
    "src/domain/jobs.ts",
    "src/domain/customers.ts",
    "src/domain/documents.ts",
    "src/domain/business.ts",
    "src/types/project.ts",
    "src/domain/lineItems.ts",
]

FIXTURE_HINT = re.compile(r"(mock|seed|fixture|__tests__|\.test\.|\.spec\.|/data/|demo)", re.I)
MAPPER_HINT = re.compile(r"(mappers\.ts|database\.types\.ts|dataProvider\.ts|cloudSync|syncService)", re.I)

# Fields whose absence is meaningless to check.
SKIP = {"id", "createdAt", "updatedAt", "status", "name", "title"}


def optional_fields(path: Path):
    """Optional field names declared in a type/interface file."""
    text = path.read_text()
    # `  foo?: Bar;` — one per line, which is how this codebase writes them.
    return sorted({m.group(1) for m in re.finditer(r"^\s{2}(\w+)\?:", text, re.M)} - SKIP)


# The repo lives on a network-backed mount, so each grep is expensive and the
# two passes below ask for the same reads. Memoised on (pattern, dirs).
_RG_CACHE = {}


def rg_in(pattern: str, dirs=("src", "app")):
    """Ripgrep-ish search over the given directories, returning file:line strings."""
    key = (pattern, tuple(dirs))
    if key in _RG_CACHE:
        return _RG_CACHE[key]
    try:
        out = subprocess.run(
            ["grep", "-rn", "--include=*.ts", "--include=*.tsx", "-E", pattern, *dirs],
            cwd=ROOT, capture_output=True, text=True, timeout=120,
        )
        hits = [l for l in out.stdout.splitlines() if l.strip()]
    except Exception:
        hits = []
    _RG_CACHE[key] = hits
    return hits


def rg(pattern: str):
    """Ripgrep-ish search over src/ and app/ returning file:line strings."""
    return rg_in(pattern, ("src", "app"))


def classify(hits, own_type_file):
    real, fixture, mapper = [], [], []
    for h in hits:
        f = h.split(":", 1)[0]
        if f == own_type_file:
            continue
        if MAPPER_HINT.search(f):
            mapper.append(h)
        elif FIXTURE_HINT.search(f):
            fixture.append(h)
        else:
            real.append(h)
    return real, fixture, mapper


print("=" * 78)
print("OPTIONAL FIELDS WITH NO PRODUCTION WRITE PATH")
print("=" * 78)

for tf in TYPE_FILES:
    path = ROOT / tf
    if not path.exists():
        print(f"\n-- {tf}: MISSING")
        continue

    fields = optional_fields(path)
    print(f"\n### {tf}  ({len(fields)} optional fields)")

    for field in fields:
        # Writes: `field:` in an object literal, or `updates.field` / `patch.field`
        writes = rg(rf"(^|[^.\w])({field}):\s|\b(updates|patch|extra)\.{field}\b")
        w_real, w_fix, w_map = classify(writes, tf)

        # Reads: any `.field` access
        reads = rg(rf"\.{field}\b")
        r_real, r_fix, r_map = classify(reads, tf)

        if not r_real:
            continue  # nothing depends on it; not a live-data bug

        if not w_real:
            print(f"\n  🔴 {field}")
            print(f"     reads (real code): {len(r_real)}   writes: NONE outside fixtures/mappers")
            print(f"     fixture writes: {len(w_fix)}  mapper writes: {len(w_map)}")
            for h in r_real[:3]:
                print(f"       read → {h[:120]}")
        elif len(w_real) <= 2:
            print(f"\n  🟡 {field}  (only {len(w_real)} write site(s) — check they are reachable)")
            for h in w_real[:3]:
                print(f"       write → {h[:120]}")


# =============================================================================
# NO SCREEN CAN SET IT  (learnings #139 / #141)
# =============================================================================
# The pass above classifies fixtures and mappers by FILE PATH, and this codebase
# keeps BOTH inside `src/state/AppState.tsx` — `SEED_PROJECTS` and the row→domain
# hydration live there. So a field written only by the seed, the read mapper and
# an `updates.x` passthrough scores as having four real write sites and is never
# reported. That is exactly how `Project.startDate` (the milestone/handover
# engine's only anchor) and `Project.retentionPercent` (the whole retentie
# surface) both stayed dead while auditing clean.
#
# The question this pass asks instead is the one that actually matters:
# CAN A USER EVER PUT A VALUE IN IT? Persistence plumbing does not count, so the
# search is restricted to `app/` — the screens.
#
#   🔴 no write under app/ at all      → no screen can set it
#   🟠 every app/ write is a literal    → the only "write" is a hardcoded
#      constant at a construction site (`retentionPercent: 0`, `milestones: []`),
#      which pins the field to that value forever
#
# Both are candidate lists to confirm by hand, same as above.

# EMPTY literals only — deliberately NOT `true`/`false`.
#
# The pattern this looks for is a field pinned to its own default at a
# construction site (`retentionPercent: 0`, `milestones: []`). A boolean literal
# is the opposite: `isRetentionRelease: true` IS the captured value, and
# treating it as a pinned constant reported a correctly-written field as one
# nothing captures.
CONST_VALUE = r"(0|0\.0|''|\"\"|``|\[\]|\{\}|null|undefined)"


def const_write_re(field: str):
    """`field: <literal>` — anchored to THIS field.

    Anchoring matters: an unanchored `:\\s*''$` also matches the else-branch of a
    ternary (`x: country === 'US' ? sanitize(x) : ''`), which reported two fully
    user-editable business-settings fields as hardcoded constants.
    """
    return re.compile(rf"\b{re.escape(field)}:\s*{CONST_VALUE}\s*[,;)}}]?\s*(//.*)?$")


def hydration_re(field: str):
    """`field: r.col` / `row.col` — hydration FROM the database, not a capture."""
    return re.compile(rf"\b{re.escape(field)}:\s*(r|row|data|dto)\b")

print()
print("=" * 78)
print("NO SCREEN CAN SET IT  (writes under app/ only)")
print("=" * 78)

for tf in TYPE_FILES:
    path = ROOT / tf
    if not path.exists():
        continue

    findings = []
    for field in optional_fields(path):
        reads = rg(rf"\.{field}\b")
        r_real, _, _ = classify(reads, tf)
        if not r_real:
            continue  # nothing reads it; the pass above owns that case

        app_writes = rg_in(rf"(^|[^.\w])({field}):\s", ("app",))
        app_writes = [h for h in app_writes if not FIXTURE_HINT.search(h.split(":", 1)[0])]

        if not app_writes:
            # No screen writes it — but plenty of fields are LEGITIMATELY
            # system-set (`paidAt`, `actualEndDate`, `retentionAmount`). Show
            # what in src/ captures a real value, so the reader can tell
            # "derived on purpose" from "nobody can ever set this" at a glance.
            hyd, const = hydration_re(field), const_write_re(field)
            src_writes = [
                h for h in rg_in(rf"(^|[^.\w])({field}):\s", ("src",))
                if not FIXTURE_HINT.search(h.split(":", 1)[0])
                and not MAPPER_HINT.search(h.split(":", 1)[0])
                and not hyd.search(h)
                and not const.search(h)
            ]
            findings.append((
                "🔴" if not src_writes else "🔵",
                field,
                "no screen writes it; nothing in src/ captures a value either"
                if not src_writes
                else f"no screen writes it — set only by src/ ({len(src_writes)} site(s)); confirm it is meant to be derived",
                src_writes[:2],
            ))
        else:
            const = const_write_re(field)
            literals = [h for h in app_writes if const.search(h)]
            if len(literals) == len(app_writes):
                findings.append((
                    "🟠", field,
                    f"all {len(app_writes)} app/ write(s) are hardcoded constants — pinned forever",
                    literals[:3],
                ))

    if findings:
        print(f"\n### {tf}")
        # Worst first: unreachable, then pinned-to-a-constant, then derived.
        order = {"🔴": 0, "🟠": 1, "🔵": 2}
        for icon, field, why, samples in sorted(findings, key=lambda f: order[f[0]]):
            print(f"\n  {icon} {field} — {why}")
            for h in samples:
                print(f"       → {h.strip()[:120]}")
