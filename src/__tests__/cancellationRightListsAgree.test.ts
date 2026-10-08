// The portal shows the cancellation notice for exactly the markets the
// database refuses an acceptance without it (UK walk, 2026-10-08: the UK had
// neither). Two lists in two languages — this keeps them equal.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

it('admin/src/lib/cancellationNotice.ts and the latest decide_acceptance_link agree', () => {
  const lib = fs.readFileSync(path.join(ROOT, 'admin/src/lib/cancellationNotice.ts'), 'utf8');
  const portal = (lib.match(/CANCELLATION_RIGHT_COUNTRIES = \[([^\]]*)\]/)?.[1] ?? '')
    .match(/'([A-Z]{2})'/g)!.map((s) => s.slice(1, 3)).sort();

  const dir = path.join(ROOT, 'supabase/migrations');
  const latest = fs.readdirSync(dir).sort().reverse()
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .find((sql) => /CREATE OR REPLACE FUNCTION public\.decide_acceptance_link/i.test(sql))!;
  const m = latest.match(/upper\(coalesce\(v_country, ''\)\)\s*(?:=\s*'([A-Z]{2})'|IN\s*\(([^)]*)\))/)!;
  const db = (m[1] ? [m[1]] : m[2].match(/'([A-Z]{2})'/g)!.map((s) => s.slice(1, 3))).sort();

  expect(portal).toEqual(['FR', 'UK']);
  expect(db).toEqual(portal);
});
