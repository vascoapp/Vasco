/**
 * An in-memory Supabase that rejects what production rejects.
 *
 * Convergence plan P0.3 (docs/CONVERGENCE_PLAN.md). The global jest stub said
 * "backend not configured", so every data path in the unit suite ran on
 * fixtures or on mocks that accepted any payload. A write with a column the
 * table does not have (PostgREST PGRST204 rejects the WHOLE write), a missing
 * NOT NULL column, or a read past PostgREST's 1000-row cap could not fail.
 *
 * The schema is a snapshot of the LIVE database
 * (src/test-utils/schema.snapshot.json, `npm run schema:snapshot`), not
 * database.types.ts, which is hand-written and covers a fraction of it.
 *
 * Enforced like production:
 *   - unknown table                      → 42P01
 *   - unknown column in a write          → PGRST204
 *   - unknown column in a filter/select  → 42703
 *   - NOT NULL column left null          → 23502
 *   - a row owned by another user        → 42501 on write; invisible on read
 *   - at most MAX_ROWS rows per response (unranged too)
 *   - unknown RPC, or a live RPC called with the wrong ARGUMENT names → PGRST202
 *     (a live RPC with no registered handler answers { data: null, error: null })
 *   - .single() on 0 or >1 rows          → PGRST116
 *
 * Use (jest hoists jest.mock above every const, so build it IN the factory):
 *   jest.mock('../lib/supabase', () => require('../test-utils/fakeSupabase').fakeSupabaseModule());
 *   const fake = require('../lib/supabase').__fake as FakeSupabase;
 */
import schema from './schema.snapshot.json';

type Row = Record<string, any>;
type Column = { nullable: boolean; hasDefault: boolean; type: string; default?: string };
type TableSchema = Record<string, Column>;

const TABLES = (schema as { tables: Record<string, TableSchema> }).tables;
type FnSig = { args: string[]; required: string[] };
const FUNCTIONS = ((schema as any).functions ?? {}) as Record<string, FnSig[]>;

/** Does a live overload accept exactly these argument names? (PostgREST rule) */
function rpcMatches(name: string, args: Record<string, unknown>): boolean {
  // JSON.stringify drops `undefined` — PostgREST never sees those keys.
  const given = Object.entries(args ?? {}).filter(([, v]) => v !== undefined).map(([k]) => k);
  return (FUNCTIONS[name] ?? []).some((sig) =>
    given.every((a) => sig.args.includes(a)) && sig.required.every((r) => given.includes(r)));
}
export const MAX_ROWS = 1000;

export interface PgError { code: string; message: string }
export interface Result<T = any> { data: T | null; error: PgError | null; count?: number | null }

export interface FakeCall { table: string; op: string; payload?: unknown; error?: PgError | null }

let uuidCounter = 0;
const fakeUuid = () => {
  uuidCounter += 1;
  const hex = uuidCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
};

const err = (code: string, message: string): PgError => ({ code, message });

function parseDefault(def: string | undefined, userId: string | null, seq: () => number): unknown {
  if (def == null) return undefined;
  const d = def.trim();
  if (/gen_random_uuid|uuid_generate_v4/.test(d)) return fakeUuid();
  if (/^now\(\)|CURRENT_TIMESTAMP|timezone\(/i.test(d)) return new Date().toISOString();
  if (/CURRENT_DATE/i.test(d)) return new Date().toISOString().slice(0, 10);
  if (/auth\.uid\(\)/.test(d)) return userId;
  if (/^nextval\(/.test(d)) return seq();
  if (/^true$/i.test(d)) return true;
  if (/^false$/i.test(d)) return false;
  if (/^-?\d+(\.\d+)?$/.test(d)) return Number(d);
  const lit = /^'(.*)'::[\w\s\[\]."]+$/.exec(d);
  if (lit) {
    if (/::jsonb?$/.test(d)) { try { return JSON.parse(lit[1]); } catch { return lit[1]; } }
    if (/\[\]$/.test(d) && lit[1] === '{}') return [];
    return lit[1];
  }
  if (/^ARRAY\[\]/i.test(d)) return [];
  return undefined; // an expression we do not model: leave it to the column default
}

const singular = (t: string) => t.replace(/ies$/, 'y').replace(/s$/, '');

/** Split a PostgREST select list on its top-level commas. */
function splitSelect(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function createFakeSupabase(opts: { userId?: string | null; rls?: boolean } = {}) {
  const db: Record<string, Row[]> = {};
  const rpcs: Record<string, (args: any) => Result | Promise<Result>> = {};
  const calls: FakeCall[] = [];
  let userId: string | null = opts.userId === undefined ? '11111111-1111-4111-8111-111111111111' : opts.userId;
  const rls = opts.rls ?? true;
  let seqN = 0;
  const seq = () => ++seqN;

  const rowsOf = (t: string) => (db[t] ??= []);
  const visible = (t: string, r: Row) =>
    !rls || !('user_id' in (TABLES[t] ?? {})) || userId == null || r.user_id == null || r.user_id === userId;

  function checkColumns(t: string, keys: string[], code: 'PGRST204' | '42703'): PgError | null {
    const cols = TABLES[t];
    for (const k of keys) {
      if (!(k in cols)) {
        return code === 'PGRST204'
          ? err('PGRST204', `Could not find the '${k}' column of '${t}' in the schema cache`)
          : err('42703', `column ${t}.${k} does not exist`);
      }
    }
    return null;
  }

  function completeInsert(t: string, input: Row, asSeed = false): { row?: Row; error?: PgError } {
    const cols = TABLES[t];
    const bad = checkColumns(t, Object.keys(input), 'PGRST204');
    if (bad) return { error: bad };
    const row: Row = {};
    for (const [c, meta] of Object.entries(cols)) {
      if (c in input) { row[c] = input[c]; continue; }
      // An unmodelled default expression still fills the column in the real
      // DB, so it counts as set for the NOT NULL check below (hasDefault).
      const dv = parseDefault(meta.default, userId, seq);
      row[c] = dv === undefined ? null : dv;
    }
    for (const [c, meta] of Object.entries(cols)) {
      const explicitNull = c in input && input[c] === null;
      if (!meta.nullable && (explicitNull || (row[c] == null && !meta.hasDefault))) {
        return { error: err('23502', `null value in column "${c}" of relation "${t}" violates not-null constraint`) };
      }
    }
    if (!asSeed && rls && 'user_id' in cols && userId && row.user_id != null && row.user_id !== userId) {
      return { error: err('42501', `new row violates row-level security policy for table "${t}"`) };
    }
    return { row };
  }

  function project(t: string, rows: Row[], sel: string): { rows?: Row[]; error?: PgError } {
    const parts = splitSelect(sel || '*');
    const embeds: Array<{ name: string; alias: string; inner: boolean; cols: string }> = [];
    const plain: string[] = [];
    for (const p of parts) {
      const m = /^(?:(\w+):)?(\w+)(?:!(\w+))?\((.*)\)$/.exec(p);
      if (m) embeds.push({ alias: m[1] ?? m[2], name: m[2], inner: m[3] === 'inner', cols: m[4] });
      else plain.push(p.includes(':') ? p.split(':')[1] : p);
    }
    const named = plain.filter((c) => c !== '*' && !c.includes('('));
    const bad = checkColumns(t, named.map((c) => c.split('::')[0].trim()), '42703');
    if (bad) return { error: bad };
    // Projected row paired with its source row, so an !inner embed that drops
    // a row keeps every later embed looking at the right source.
    let pairs: Array<{ o: Row; src: Row }> = rows.map((r) => ({
      o: plain.includes('*') || (plain.length === 0 && embeds.length === 0)
        ? { ...r }
        : Object.fromEntries(named.map((c) => [c, r[c]])),
      src: r,
    }));
    for (const e of embeds) {
      if (!TABLES[e.name]) return { error: err('PGRST200', `Could not find a relationship between '${t}' and '${e.name}'`) };
      const fk = `${singular(e.name)}_id`;
      const back = `${singular(t)}_id`;
      const next: typeof pairs = [];
      pairs.forEach(({ o, src }) => {
        let val: any;
        if (fk in TABLES[t]) {
          const hit = rowsOf(e.name).find((x) => x.id === src[fk]);
          val = hit ? project(e.name, [hit], e.cols).rows?.[0] ?? null : null;
          if (e.inner && !hit) return;
        } else if (back in TABLES[e.name]) {
          const hits = rowsOf(e.name).filter((x) => x[back] === src.id);
          val = project(e.name, hits, e.cols).rows ?? [];
          if (e.inner && hits.length === 0) return;
        } else {
          throw new Error(`fakeSupabase: no FK between ${t} and ${e.name}`);
        }
        next.push({ o: { ...o, [e.alias]: val }, src });
      });
      pairs = next;
    }
    return { rows: pairs.map((p) => p.o) };
  }

  function builder(t: string) {
    const st = {
      op: 'select' as 'select' | 'insert' | 'upsert' | 'update' | 'delete',
      payload: undefined as any,
      sel: '*',
      returning: false,
      filters: [] as Array<{ col: string; fn: (v: any) => boolean }>,
      order: [] as Array<{ col: string; asc: boolean }>,
      range: null as null | [number, number],
      limit: null as null | number,
      single: null as null | 'single' | 'maybe',
      count: false,
      head: false,
      onConflict: 'id',
      ignoreDuplicates: false,
    };
    const add = (col: string, fn: (v: any) => boolean) => { st.filters.push({ col, fn }); return q; };
    const like = (pat: string, flags: string) => new RegExp(`^${pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, flags);
    const cmp = (op: string, val: any) => (v: any) => {
      switch (op) {
        case 'eq': return v === val || (v != null && val != null && String(v) === String(val));
        case 'neq': return !(v === val || String(v) === String(val));
        case 'gt': return v != null && v > val;
        case 'gte': return v != null && v >= val;
        case 'lt': return v != null && v < val;
        case 'lte': return v != null && v <= val;
        case 'is': return val === null ? v == null : v === val;
        case 'in': return (Array.isArray(val) ? val : String(val).replace(/[()]/g, '').split(',')).map(String).includes(String(v));
        case 'like': return v != null && like(val, '').test(String(v));
        case 'ilike': return v != null && like(val, 'i').test(String(v));
        default: throw new Error(`fakeSupabase: operator ${op} not modelled`);
      }
    };
    const q: any = {
      select(cols = '*', o?: { count?: string; head?: boolean }) {
        if (st.op === 'select') st.sel = cols; else { st.returning = true; st.sel = cols; }
        if (o?.count) st.count = true;
        if (o?.head) st.head = true;
        return q;
      },
      insert(p: any) { st.op = 'insert'; st.payload = p; return q; },
      upsert(p: any, o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        st.op = 'upsert'; st.payload = p; st.onConflict = o?.onConflict ?? 'id'; st.ignoreDuplicates = !!o?.ignoreDuplicates; return q;
      },
      update(p: any) { st.op = 'update'; st.payload = p; return q; },
      delete() { st.op = 'delete'; return q; },
      eq: (c: string, v: any) => add(c, cmp('eq', v)),
      neq: (c: string, v: any) => add(c, cmp('neq', v)),
      gt: (c: string, v: any) => add(c, cmp('gt', v)),
      gte: (c: string, v: any) => add(c, cmp('gte', v)),
      lt: (c: string, v: any) => add(c, cmp('lt', v)),
      lte: (c: string, v: any) => add(c, cmp('lte', v)),
      is: (c: string, v: any) => add(c, cmp('is', v)),
      in: (c: string, v: any[]) => add(c, cmp('in', v)),
      like: (c: string, v: string) => add(c, cmp('like', v)),
      ilike: (c: string, v: string) => add(c, cmp('ilike', v)),
      not: (c: string, op: string, v: any) => { const f = cmp(op, v); return add(c, (x) => !f(x)); },
      filter: (c: string, op: string, v: any) => add(c, cmp(op, v)),
      match: (obj: Row) => { for (const [c, v] of Object.entries(obj)) add(c, cmp('eq', v)); return q; },
      order(col: string, o?: { ascending?: boolean }) { st.order.push({ col, asc: o?.ascending !== false }); return q; },
      range(a: number, b: number) { st.range = [a, b]; return q; },
      limit(n: number) { st.limit = n; return q; },
      single() { st.single = 'single'; return q; },
      maybeSingle() { st.single = 'maybe'; return q; },
      returns() { return q; },
      abortSignal() { return q; },
      then(res: (r: Result) => any, rej?: (e: any) => any) {
        return Promise.resolve().then(execute).then(res, rej);
      },
    };

    function execute(): Result {
      const done = (r: Result) => { calls.push({ table: t, op: st.op, payload: st.payload, error: r.error }); return r; };
      if (!TABLES[t]) return done({ data: null, error: err('42P01', `relation "public.${t}" does not exist`) });
      const badFilter = checkColumns(t, st.filters.map((f) => f.col).concat(st.order.map((o) => o.col)), '42703');
      if (badFilter) return done({ data: null, error: badFilter });
      const match = (r: Row) => visible(t, r) && st.filters.every((f) => f.fn(r[f.col]));
      let affected: Row[] = [];

      if (st.op === 'insert' || st.op === 'upsert') {
        const input: Row[] = Array.isArray(st.payload) ? st.payload : [st.payload];
        const conflictCols = st.onConflict.split(',').map((c) => c.trim());
        const bad = checkColumns(t, conflictCols, '42703');
        if (st.op === 'upsert' && bad) return done({ data: null, error: bad });
        const staged: Array<{ kind: 'new' | 'update'; row: Row; target?: Row }> = [];
        for (const r of input) {
          const existing = st.op === 'upsert' && conflictCols.every((c) => r[c] != null)
            ? rowsOf(t).find((x) => conflictCols.every((c) => String(x[c]) === String(r[c])))
            : undefined;
          if (existing) {
            if (!visible(t, existing)) return done({ data: null, error: err('42501', `new row violates row-level security policy for table "${t}"`) });
            if (st.ignoreDuplicates) continue;
            const badCols = checkColumns(t, Object.keys(r), 'PGRST204');
            if (badCols) return done({ data: null, error: badCols });
            staged.push({ kind: 'update', row: { ...existing, ...r }, target: existing });
          } else {
            const c = completeInsert(t, r);
            if (c.error) return done({ data: null, error: c.error });
            if (st.op === 'insert' && 'id' in TABLES[t] && rowsOf(t).some((x) => x.id === c.row!.id)) {
              return done({ data: null, error: err('23505', `duplicate key value violates unique constraint "${t}_pkey"`) });
            }
            staged.push({ kind: 'new', row: c.row! });
          }
        }
        // All-or-nothing, like one PostgREST statement.
        for (const s of staged) {
          if (s.kind === 'new') rowsOf(t).push(s.row);
          else Object.assign(s.target!, s.row);
          affected.push(s.kind === 'new' ? s.row : s.target!);
        }
      } else if (st.op === 'update') {
        const bad = checkColumns(t, Object.keys(st.payload ?? {}), 'PGRST204');
        if (bad) return done({ data: null, error: bad });
        for (const [c, v] of Object.entries(st.payload ?? {})) {
          if (v === null && !TABLES[t][c].nullable) {
            return done({ data: null, error: err('23502', `null value in column "${c}" of relation "${t}" violates not-null constraint`) });
          }
        }
        affected = rowsOf(t).filter(match);
        for (const r of affected) Object.assign(r, st.payload);
      } else if (st.op === 'delete') {
        affected = rowsOf(t).filter(match);
        db[t] = rowsOf(t).filter((r) => !affected.includes(r));
      } else {
        affected = rowsOf(t).filter(match);
      }

      if (st.op !== 'select' && !st.returning) return done({ data: null, error: null });

      let rows = [...affected];
      for (const o of [...st.order].reverse()) {
        rows.sort((a, b) => {
          const x = a[o.col], y = b[o.col];
          if (x == null && y == null) return 0;
          if (x == null) return o.asc ? 1 : -1;
          if (y == null) return o.asc ? -1 : 1;
          return (x < y ? -1 : x > y ? 1 : 0) * (o.asc ? 1 : -1);
        });
      }
      const total = rows.length;
      const from = st.range ? st.range[0] : 0;
      const to = st.range ? st.range[1] + 1 : st.limit != null ? st.limit : rows.length;
      // PostgREST's max_rows: never more than MAX_ROWS in one response, silently.
      rows = rows.slice(from, Math.min(to, from + MAX_ROWS));
      const proj = project(t, rows, st.sel);
      if (proj.error) return done({ data: null, error: proj.error });
      rows = proj.rows!;
      if (st.head) return done({ data: null, error: null, count: total });
      if (st.single) {
        if (rows.length === 1) return done({ data: rows[0], error: null, count: st.count ? total : null });
        if (rows.length === 0 && st.single === 'maybe') return done({ data: null, error: null });
        return done({ data: null, error: err('PGRST116', `JSON object requested, multiple (or no) rows returned`) });
      }
      return done({ data: rows, error: null, count: st.count ? total : null });
    }
    return q;
  }

  const client = {
    from: (t: string) => builder(t),
    rpc: async (name: string, args?: any): Promise<Result> => {
      const h: ((a: any) => Result | Promise<Result>) | undefined = rpcs[name];
      const exists = rpcMatches(name, args ?? {});
      // A handler for a function NOT in the live schema is a test-only stub; allow it.
      const testOnly = name in rpcs && !(name in FUNCTIONS);
      if (!exists && !testOnly) {
        const e = err('PGRST202', `Could not find the function public.${name}(${Object.keys(args ?? {}).join(', ')}) in the schema cache`);
        calls.push({ table: `rpc:${name}`, op: 'rpc', payload: args, error: e });
        return { data: null, error: e };
      }
      calls.push({ table: `rpc:${name}`, op: 'rpc', payload: args, error: null });
      return h ? h(args ?? {}) : { data: null, error: null };
    },
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
      getSession: async () => ({ data: { session: userId ? { access_token: 'fake', user: { id: userId } } : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      // Sign-in/up are not modelled as a real auth server: a test that needs a
      // session passes `userId`, and these answer the way a refused request does.
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: { message: 'fakeSupabase: sign-in not modelled — pass userId' } }),
      signUp: async () => ({ data: { user: null, session: null }, error: { message: 'fakeSupabase: sign-up not modelled — pass userId' } }),
      signOut: async () => { userId = null; return { error: null }; },
      setSession: async () => ({ data: { session: null, user: null }, error: null }),
      updateUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
    },
    channel: () => { const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} }; return ch; },
    removeChannel: () => {},
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => { calls.push({ table: `storage:${bucket}`, op: 'upload', payload: path }); return { data: { path }, error: null }; },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://fake.storage/${bucket}/${path}` } }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://fake.storage/${bucket}/${path}?signed` }, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
    functions: {
      invoke: async (name: string) => ({ data: null, error: { message: `fakeSupabase: edge function ${name} not modelled` } }),
    },
  };

  const api = {
    client,
    /** Rows as stored (owner-blind — the test's view, not the user's). */
    rows: (t: string) => rowsOf(t),
    seed(t: string, rows: Row[]) {
      if (!TABLES[t]) throw new Error(`fakeSupabase: no table ${t} in the schema snapshot`);
      for (const r of rows) {
        // Seeds may set up ANOTHER user's rows (RLS is the app's constraint,
        // not the test's); schema rules still apply.
        const c = completeInsert(t, { ...(TABLES[t].user_id && userId ? { user_id: userId } : {}), ...r }, true);
        if (c.error) throw new Error(`fakeSupabase seed ${t}: ${c.error.message}`);
        rowsOf(t).push(c.row!);
      }
    },
    /** Register a handler. Stubbing a function that does NOT exist live needs
     *  `{ testOnly: true }` — otherwise a misspelt RPC name would stay green. */
    rpc(name: string, handler: (args: any) => Result | Promise<Result>, opts?: { testOnly?: boolean }) {
      if (!(name in FUNCTIONS) && !opts?.testOnly) {
        throw new Error(`fakeSupabase: no live function public.${name} — misspelt? (pass { testOnly: true } to stub one on purpose)`);
      }
      rpcs[name] = handler;
    },
    calls,
    setUser(id: string | null) { userId = id; },
    reset() { for (const k of Object.keys(db)) delete db[k]; calls.length = 0; },
    hasTable: (t: string) => !!TABLES[t],
    columns: (t: string) => Object.keys(TABLES[t] ?? {}),
  };
  return api;
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

/** The shape of src/lib/supabase, backed by a fresh fake (see header). */
export function fakeSupabaseModule(opts?: Parameters<typeof createFakeSupabase>[0]) {
  const fake = createFakeSupabase(opts);
  return { supabase: fake.client, isSupabaseConfigured: true, __fake: fake };
}
