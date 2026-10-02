/**
 * A view created (or dropped and re-created) in `public` picks up the
 * project's DEFAULT privileges — on Supabase, authenticated gets SELECT,
 * INSERT, UPDATE and DELETE. A view runs with its OWNER's rights, so RLS on
 * the table behind it does not apply: 20261002000001 re-created
 * price_references (every contractor's purchase prices, per user) and for a
 * few minutes any signed-in contractor could have read them all
 * (20261002000002 restored owner-only).
 *
 * Rule: every migration from 2026-10-02 on that CREATEs a view or
 * materialized view states its privileges — a GRANT or REVOKE on that view
 * in the same migration or a later one.
 */
import fs from 'fs';
import path from 'path';

const DIR = path.resolve(__dirname, '../../supabase/migrations');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const strip = (s: string) => s.replace(/--[^\n]*/g, '');

it('every view created since 2026-10-02 has its privileges stated', () => {
  const missing: string[] = [];
  files.forEach((f, i) => {
    if (f < '20261002') return;
    const sql = strip(fs.readFileSync(path.join(DIR, f), 'utf8'));
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?/gi)) {
      const view = m[1];
      const said = files.slice(i).some((g) =>
        new RegExp(`(grant|revoke)[^;]*\\bon\\s+(?:table\\s+)?(?:public\\.)?"?${view}"?\\b`, 'i').test(strip(fs.readFileSync(path.join(DIR, g), 'utf8'))));
      if (!said) missing.push(`${f}: ${view}`);
    }
  });
  expect(missing).toEqual([]);
});

it('finds the views it is meant to check', () => {
  const sql = fs.readFileSync(path.join(DIR, '20261002000001_money_columns_numeric.sql'), 'utf8');
  expect((sql.match(/create\s+(materialized\s+)?view/gi) ?? []).length).toBe(3);
});
