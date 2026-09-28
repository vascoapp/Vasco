// =============================================================================
// Every row, page by page — the edge-function twin of src/lib/dataProvider.ts
// `selectAllPages`.
// =============================================================================
// Production PostgREST caps EVERY response at max_rows = 1000, whatever
// `.limit()` asks for, and says nothing: `.limit(50000)` returned the first
// 1000 rows in no particular order, so the cohort models trained on an
// arbitrary sample (sweep C5–C7, 2026-09-25). Pages are ordered by a unique
// column so no row is skipped or repeated between them.
// =============================================================================

const PAGE_SIZE = 1000;

/**
 * `build` returns a fresh query WITHOUT range/limit; it is ordered here by
 * `orderBy` (must be unique, e.g. `id`). Throws the first PostgREST error —
 * a partial read must not pass for the whole table.
 */
export async function selectAllPages<T>(
  build: () => any,
  orderBy = 'id',
  maxRows = 200_000,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await build().order(orderBy, { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
