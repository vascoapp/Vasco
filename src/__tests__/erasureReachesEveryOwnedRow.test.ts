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

  // ON DELETE SET NULL survives the auth cascade: without an explicit delete
  // the row stays, content and all, while every copy says "erased".
  it('every table whose auth-user FK is SET NULL is hard-deleted', () => {
    const fks = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/test-utils/schema.snapshot.json'), 'utf8')).authUserFks as Record<string, string[]>;
    expect(Object.keys(fks).length).toBeGreaterThan(20);
    const tables = new Set([...listOf('HARD_DELETE_TABLES').matchAll(/'(\w+)'/g)].map((m) => m[1]));
    for (const m of SRC.matchAll(/\.from\('(\w+)'\)\.delete\(\)/g)) tables.add(m[1]);
    const kept = Object.entries(fks).filter(([t, a]) => a.some((x) => x !== 'CASCADE') && !tables.has(t) && t !== 'account_deletion_requests').map(([t]) => t);
    expect(kept).toEqual([]);
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

// EXPORT, THEN DELETE (user's decision 2026-09-24): Vasco keeps nothing but a
// minimal record that the erasure happened. That record used to cascade away
// with the user (migration 20260924000002).
describe('export, then delete', () => {
  const MIG = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260924000002_erasure_record_survives.sql'), 'utf8');

  it('only the erasure record stops cascading — everything else still goes with the user', () => {
    expect(MIG).toContain('drop constraint if exists account_deletion_requests_user_id_fkey');
    for (const fk of ['documents_user_id_fkey', 'line_items_user_id_fkey', 'gobd_audit_log_user_id_fkey']) {
      expect(MIG).not.toContain(fk);
    }
    expect(SRC).not.toMatch(/ANONYMISE_TABLES|retain_until/);
  });

  it('the record is minimal: the free-text reason is cleared, and it ages out after 3 years', () => {
    expect(SRC).toMatch(/status: 'done'[\s\S]{0,300}reason: null/);
    expect(SRC).toMatch(/3 \* 365 \* 86_400_000[\s\S]{0,200}\.delete\(\)\.eq\('status', 'done'\)\.lt\('processed_at', cutoff\)/);
    // A withdrawn request has no processed_at: it ages from when it was made.
    expect(SRC).toMatch(/\.delete\(\)\.eq\('status', 'cancelled'\)\.lt\('requested_at', cutoff\)/);
  });
});

