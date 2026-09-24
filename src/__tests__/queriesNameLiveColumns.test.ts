/**
 * Every table and column a query names exists in the LIVE schema.
 *
 * PostgREST rejects the WHOLE statement for one unknown column (42703 on a
 * read, PGRST204 on a write), and this codebase mostly swallows the error, so
 * the result looks like "no rows". The first run of this scan (2026-09-24,
 * convergence plan P0.3) found, live in production:
 *   - paid-side-effects selected documents.currency → receipt email, "payment
 *     received" push and DSO training row skipped on EVERY payment;
 *   - pack-trigger-tick selected documents.number/amount/total/customer_name/
 *     country → the dunning and quote follow-up pushes never fired;
 *   - classify-customer-question read decision_submissions.user_id → every
 *     portal question stored with no contractor, invisible in the app;
 *   - calibration read/wrote predicted_at/prediction/accurate → the learning
 *     loop never stored an entry (found by the fake backend's net).
 *
 * Schema = src/test-utils/schema.snapshot.json (`npm run schema:snapshot`).
 * Static: it covers every query, reached by a test or not.
 */
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.join(__dirname, '../..');
const SNAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/test-utils/schema.snapshot.json'), 'utf8')).tables as Record<string, Record<string, unknown>>;

/** Known, each with its reason. A stale entry fails — this list only shrinks. */
const KNOWN: Record<string, string> = {
  'supabase/functions/train-extra-models/index.ts: material_price_history.user_id': 'Sweep C5 (open): train-extra-models queries columns that do not exist.',
  'supabase/functions/train-extra-models/index.ts: material_price_history.total_price': 'Sweep C5.',
  'supabase/functions/train-extra-models/index.ts: material_price_history.delivery_days': 'Sweep C5.',
  'supabase/functions/train-extra-models/index.ts: material_price_history.unit_price': 'Sweep C5.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '__tests__', '__screenwalk__', 'test-utils'].includes(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(f);
  }
  return out;
}

function splitTop(sel: string): string[] {
  const parts: string[] = []; let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** Findings in one source text (exported shape for the self-test below). */
function scan(rel: string, src: string): string[] {
  const out: string[] = [];
  // `.from('t')`, `(supabase.from as any)('t')` and a bare local `from('t')`
  // wrapper (intelligenceDataProvider) — the first version saw only the first
  // and missed three live defects (review 2026-09-24).
  const re = /(?:\.from(?:\s+as\s+any\))?|(?<![\w.$])from)\(\s*['"`](\w+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const t = m[1];
    const before = src.slice(Math.max(0, m.index - 30), m.index);
    if (/storage\s*$/.test(before)) continue; // supabase.storage.from(bucket)
    if (!SNAP[t]) { out.push(`${rel}: TABLE ${t}`); continue; }
    let end = src.indexOf(';', m.index);
    const next = src.indexOf('.from(', m.index + 5);
    if (next > 0 && (end < 0 || next < end)) end = next;
    const chain = src.slice(m.index, end < 0 ? undefined : end);
    const cols = new Set<string>();
    for (const c of chain.matchAll(/\.(eq|neq|gt|gte|lt|lte|is|in|like|ilike|order|not|contains)\(\s*['"`]([\w]+)['"`]/g)) cols.add(c[2]);
    for (const s of chain.matchAll(/\.select\(\s*['"`]([^'"`]*)['"`]/g)) {
      for (const p of splitTop(s[1])) {
        if (!p || p === '*' || p.includes('(')) continue;
        cols.add(p.split(':').pop()!.split('::')[0].trim());
      }
    }
    for (const c of cols) if (!(c in SNAP[t])) out.push(`${rel}: ${t}.${c}`);
  }
  return out;
}

describe('queries name live tables and columns', () => {
  // Dormant code (src/config/dormant.ts — gated, kept, not swept) is skipped.
  const DORMANT = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);
  const files = ['app', 'src', 'supabase/functions'].flatMap((d) => walk(path.join(ROOT, d)))
    .filter((f) => !DORMANT.has(path.relative(ROOT, f)));
  const found = new Set(files.flatMap((f) => scan(path.relative(ROOT, f), stripComments(fs.readFileSync(f, 'utf8')))));

  it('no query names a table or column production does not have', () => {
    expect([...found].filter((x) => !(x in KNOWN)).sort()).toEqual([]);
  });

  it('no stale KNOWN entry', () => {
    expect(Object.keys(KNOWN).filter((k) => !found.has(k))).toEqual([]);
  });

  it('detects the shapes it exists for (self-test)', () => {
    expect(scan('x.ts', `admin.from('documents').select('id, currency').eq('id', 1);`)).toEqual(['x.ts: documents.currency']);
    expect(scan('x.ts', `supabase.from('ai_queue_items').select('id');`)).toEqual(['x.ts: TABLE ai_queue_items']);
    expect(scan('x.ts', `db.from('calibration_entries').select('*').order('predicted_at');`)).toEqual(['x.ts: calibration_entries.predicted_at']);
    expect(scan('x.ts', `db.from('customers').select('id, name').eq('user_id', u);`)).toEqual([]);
    expect(scan('x.ts', `(supabase.from as any)('documents').select('id, currency');`)).toEqual(['x.ts: documents.currency']);
    expect(scan('x.ts', `const r = await from('price_refs').select('*');`)).toEqual(['x.ts: TABLE price_refs']);
    expect(scan('x.ts', `import x from 'y'; Array.from(list); supabase.storage.from('photos').upload(p);`)).toEqual([]);
  });
});
