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


def rg(pattern: str):
    """Ripgrep-ish search over src/ and app/ returning file:line strings."""
    try:
        out = subprocess.run(
            ["grep", "-rn", "--include=*.ts", "--include=*.tsx", "-E", pattern, "src", "app"],
            cwd=ROOT, capture_output=True, text=True, timeout=120,
        )
        return [l for l in out.stdout.splitlines() if l.strip()]
    except Exception:
        return []


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
