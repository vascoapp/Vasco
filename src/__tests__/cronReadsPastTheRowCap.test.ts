/**
 * @jest-environment node
 */
// Sweep C7: production PostgREST caps EVERY response at 1000 rows, unordered.
// The daily push digest, the pack tick and the weekly digest read their
// recipients in ONE query, so past 1000 devices / profiles the rest silently
// got nothing. They page through _shared/paging.ts selectAllPages now.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (fn: string) => stripComments(fs.readFileSync(path.join(ROOT, `supabase/functions/${fn}/index.ts`), 'utf8'));

describe.each([
  ['daily-push-digest', 'push_tokens'],
  ['pack-trigger-tick', 'push_tokens'],
  ['weekly-digest', 'business_settings'],
])('%s reads every %s row', (fn, table) => {
  const SRC = read(fn);
  it('through selectAllPages, not one capped query', () => {
    const at = SRC.indexOf(`.from('${table}')`);
    expect(at).toBeGreaterThan(-1);
    const before = SRC.slice(Math.max(0, at - 200), at);
    expect(before).toMatch(/selectAllPages</);
    // selectAllPages orders by `id`, so the select must carry it.
    expect(SRC.slice(at, at + 120)).toMatch(/\.select\('id, /);
  });
});
