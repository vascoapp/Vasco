// =============================================================================
// EVERY TEST FILE IS REACHED BY SOME RUNNER
// =============================================================================
// `jest.config.js` matches `**/__tests__/**` only. A `*.test.ts` written
// anywhere else is collected by nothing, and a test nobody runs is worse than
// no test: the file is there, it reads as coverage, and it silently stops
// tracking the code it was written for.
//
// That was not hypothetical. `supabase/functions/_shared/materialMerge.test.ts`
// (9 tests, written as attacks on "the training data the whole cohort moat runs
// on, and the one table that cannot be un-poisoned") and `llm_pii.test.ts`
// (7 tests over the tokenizer keeping customer names, emails, IBANs and
// postcodes out of a third-party model) were run by no script and no CI job.
// They passed — which nobody knew, because nothing asked.
//
// Deno files cannot simply be moved under `__tests__`: they import from
// https:// URLs and use `Deno.*`, so jest cannot load them. They are covered by
// `npm run test:edge` and the `edge-tests` CI job instead. This guard exists to
// make sure any FUTURE stray test file is noticed on the day it is written.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'ios', 'android', 'coverage']);

function testFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) testFiles(full, out);
    } else if (/\.(test|spec)\.tsx?$/.test(e.name)) {
      out.push(path.relative(ROOT, full));
    }
  }
  return out;
}

const read = (rel: string) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
};

describe('no test file is orphaned', () => {
  const files = testFiles(ROOT);

  it('found the test files to scan', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('every *.test.ts(x) is claimed by jest, the screen walk, or the deno runner', () => {
    const pkg = JSON.parse(read('package.json') || '{}');
    const edgeScript: string = pkg.scripts?.['test:edge'] ?? '';
    // The directories `npm run test:edge` hands to deno.
    const edgeRoots = edgeScript
      .split(/\s+/)
      .filter((a) => a && !a.startsWith('-') && a !== 'deno' && a !== 'test')
      .map((a) => a.replace(/\/$/, ''));

    const orphans = files.filter((f) => {
      if (f.includes('__tests__')) return false;        // jest.config.js
      if (f.includes('__screenwalk__')) return false;   // jest.screens.config.js
      return !edgeRoots.some((r) => r && f.startsWith(r));
    });

    expect(orphans).toEqual([]);
  });

  it('the deno tests are actually wired to a script and to CI', () => {
    // The files being reachable is only half of it — something has to run them.
    const pkg = JSON.parse(read('package.json') || '{}');
    expect(pkg.scripts?.['test:edge']).toMatch(/deno test/);

    const ci = read('.github/workflows/ci.yml');
    expect(ci).not.toBe('');
    expect(ci).toMatch(/setup-deno/);
    expect(ci).toMatch(/npm run test:edge/);
  });
});
