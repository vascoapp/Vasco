/**
 * @jest-environment node
 */
// `persistOrQueue(table, op, onlineFn, { payload })` holds two independent
// descriptions of one mutation: the lambda that runs online, and the table +
// payload the flush replays offline. The payload halves already have a guard
// (`offlineQueuePayloadParity`). The TABLE NAME did not — and it is the one
// thing the two halves never share, because the online half names its table
// inside `dataProvider` and the offline half repeats it as a string.
//
// `removeMaterial` said `'materials'`. Every other material write says
// `'material_catalog'`, which is the table that exists. The online delete
// worked; the queued replay addressed a table that has never existed, failed
// five times and was dropped — so a material deleted without signal came back
// on the next refresh (verified 2026-09-19).
//
// A wrong table name cannot fail loudly: PostgREST answers 404 and the queue
// just retries, so this is exactly the kind of thing only a list can catch.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const APPSTATE = stripComments(fs.readFileSync(path.join(ROOT, 'state/AppState.tsx'), 'utf8'));
const TYPES = fs.readFileSync(path.join(ROOT, 'lib/database.types.ts'), 'utf8');

/** Every table the generated types know about. */
const typedTables = new Set(
  [...TYPES.matchAll(/^ {6}([a-z_]+): \{$/gm)].map((m) => m[1]),
);

/** Every table a migration actually creates. */
const migrationsDir = path.resolve(ROOT, '../supabase/migrations');
const createdTables = new Set(
  fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .flatMap((f) => [
      ...fs.readFileSync(path.join(migrationsDir, f), 'utf8')
        .matchAll(/create table(?: if not exists)?\s+(?:public\.)?"?([a-z_]+)"?/gi),
    ].map((m) => m[1].toLowerCase())),
);

/**
 * What exists. The generated types are NOT the whole truth — `leads` and
 * `workers` are created by migrations and written to by the app, and neither
 * appears in `database.types.ts` (see the test at the bottom).
 */
const realTables = new Set([...typedTables, ...createdTables]);

/** Every table name the offline queue is asked to write to. */
const queuedTables = [
  ...APPSTATE.matchAll(/persistOrQueue\(\s*'([a-z_]+)'/g),
  ...APPSTATE.matchAll(/queueWrite\(\{\s*table:\s*'([a-z_]+)'/g),
  ...APPSTATE.matchAll(/queue(?:Row)?FkRepairs\(\s*'([a-z_]+)'/g),
].map((m) => m[1]);

describe('the generated types are a real list', () => {
  it('found the tables', () => {
    expect(typedTables.size).toBeGreaterThanOrEqual(15);
    expect(createdTables.size).toBeGreaterThanOrEqual(15);
    expect(realTables.has('material_catalog')).toBe(true);
    expect(realTables.has('documents')).toBe(true);
    // The name the bug used is NOT a table — if this ever becomes one, the
    // test below stops being meaningful and should be revisited.
    expect(realTables.has('materials')).toBe(false);
  });
});

describe('every queued write names a table that exists', () => {
  it('found the call sites', () => {
    // Pinned so a regex that quietly stops matching reports a clean sweep.
    expect(queuedTables.length).toBeGreaterThanOrEqual(25);
  });

  it.each([...new Set(queuedTables)])('%s is a real table', (table) => {
    expect({ table, exists: realTables.has(table) }).toEqual({ table, exists: true });
  });
});

describe('every table the app writes to is typed, not just real', () => {
  // These two were the find: `leads` and `workers` are created by
  // `20260520000002_leads.sql` / `20260520000004_workers.sql`, `LeadRow` and
  // `WorkerRow` have existed since R81/R86 — and neither table was listed in
  // the `Tables` map, so `supabase.from('leads')` had no typed shape and every
  // write went through an `as any` with nothing checking the payload.
  //
  // A table that EXISTS is not the same as a table the compiler knows about.
  it.each(['leads', 'workers'])('%s is typed', (table) => {
    expect({ table, created: createdTables.has(table) }).toEqual({ table, created: true });
    expect({ table, typed: typedTables.has(table) }).toEqual({ table, typed: true });
  });

  it('every queued table is TYPED, not merely present in a migration', () => {
    for (const table of new Set(queuedTables)) {
      expect({ table, typed: typedTables.has(table) }).toEqual({ table, typed: true });
    }
  });
});
