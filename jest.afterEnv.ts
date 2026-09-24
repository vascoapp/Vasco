/**
 * The net under the fake backend (convergence plan P0.3).
 *
 * The app swallows most backend errors (`catch {}`, `.catch(() => {})`), so a
 * write the live schema rejects — unknown column, missing NOT NULL, unknown
 * RPC or argument name, another user's row — fails nobody's test. This fails
 * the SUITE when the global fake recorded one. A test that provokes such an
 * error on purpose clears it: `require('<rel>/lib/supabase').__fake.calls.length = 0`.
 */
const SCHEMA_CLASS = new Set(['PGRST204', '23502', '42703', '42P01', 'PGRST202', '42501', 'PGRST200']);

afterAll(() => {
  let fake: any;
  try { fake = require('./src/lib/supabase').__fake; } catch { return; }
  if (!fake?.calls) return; // this suite mocked the backend itself
  const bad = fake.calls.filter((c: any) => c.error && SCHEMA_CLASS.has(c.error.code));
  if (bad.length && process.env.WALK_SCHEMA_DUMP) {
    require('fs').appendFileSync(process.env.WALK_SCHEMA_DUMP, bad.map((c: any) => `${c.op} ${c.table}: ${c.error.code} ${c.error.message}`).join('\n') + '\n');
  }
  if (bad.length) {
    const lines = bad.slice(0, 10).map((c: any) => `  ${c.op} ${c.table}: ${c.error.code} ${c.error.message}`);
    throw new Error(`The live schema would reject ${bad.length} backend call(s) this suite made:\n${lines.join('\n')}`);
  }
});
