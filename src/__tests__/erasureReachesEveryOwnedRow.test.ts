/**
 * The GDPR erasure worker (drain-account-deletions) names only tables and
 * columns production has.
 *
 * Its list deleted `customer_questions`, `decision_submissions` and
 * `customer_interactions` by `user_id` — none has that column. Each run
 * errored, rolled the request back to `pending` and retried the next night,
 * forever: no erasure could ever be recorded as done (review 2026-09-24,
 * checked against src/test-utils/schema.snapshot.json).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const SNAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/test-utils/schema.snapshot.json'), 'utf8')).tables as Record<string, Record<string, unknown>>;
const SRC = fs.readFileSync(path.join(ROOT, 'supabase/functions/drain-account-deletions/index.ts'), 'utf8');

/** The array literal of `const NAME = [ … ]` (ends at `]` + `;` or `as const`). */
const listOf = (name: string) => {
  const m = new RegExp(`const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\](?:\\s*as const)?;`).exec(SRC);
  if (!m) throw new Error(`no ${name} in drain-account-deletions`);
  return m[1];
};

describe('the erasure worker names live tables and columns', () => {
  it('every hard-delete table exists and has user_id', () => {
    const tables = [...listOf('HARD_DELETE_TABLES').matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(5);
    const bad = tables.filter((t) => !SNAP[t] || !('user_id' in SNAP[t]));
    expect(bad).toEqual([]);
  });

  it('every anonymised table and column exists', () => {
    const bad: string[] = [];
    for (const m of listOf('ANONYMISE_TABLES').matchAll(/table: '(\w+)', nullColumns: \[([^\]]*)\]/g)) {
      const t = m[1];
      if (!SNAP[t] || !('user_id' in SNAP[t])) bad.push(t);
      for (const c of [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1])) if (!SNAP[t]?.[c]) bad.push(`${t}.${c}`);
    }
    expect(bad).toEqual([]);
  });

  it('every delete/select/in on a named table uses a live column', () => {
    const bad: string[] = [];
    for (const m of SRC.matchAll(/\.from\('(\w+)'\)[^;]*?\.(?:eq|in)\('(\w+)'/g)) {
      if (!SNAP[m[1]]) bad.push(`TABLE ${m[1]}`);
      else if (!(m[2] in SNAP[m[1]])) bad.push(`${m[1]}.${m[2]}`);
    }
    expect(bad).toEqual([]);
  });
});

// deleteUser cascades to the request row itself (FK ON DELETE CASCADE), so
// running it after a failed step lost the retry for good.
it('the auth user is deleted only when every earlier step landed', () => {
  expect(SRC).toMatch(/if \(errors\.length === 0\) \{\s*const \{ error: userErr \} = await admin\.auth\.admin\.deleteUser/);
});
