// =============================================================================
// NO IMPORT MAY SHADOW A JEST GLOBAL
// =============================================================================
// `import it from '../../i18n/locales/it.json'` binds the Italian locale to the
// name `it`. Jest's `it` is then the JSON object, and the whole file dies at
// collection with:
//
//     TypeError: (0 , _it.default) is not a function
//
// That is a suite which NEVER RUNS. It does not show up as a failing
// assertion — it shows up as a file quietly contributing zero tests, which is
// indistinguishable from a file whose tests all passed unless you are reading
// the suite count. A locale named after a test global is a trap the language
// sets for you: `it.json` is the correct ISO code for Italian, and `test`,
// `expect` and `jest` are all plausible module names too.
//
// Import bindings only. A local variable called `test` is shadowing you chose
// inside a scope you can see; an import binding is file-wide and silent.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

/** Globals jest injects. Shadowing any of these breaks collection or assertions. */
const JEST_GLOBALS = new Set([
  'describe', 'it', 'test', 'expect', 'jest',
  'beforeAll', 'beforeEach', 'afterAll', 'afterEach',
  'xit', 'xtest', 'xdescribe', 'fit', 'ftest', 'fdescribe',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'ios', 'android', 'coverage']);

/**
 * Importing the globals from the test framework ON PURPOSE is the correct
 * modern pattern, not shadowing — `import { it, expect } from '@jest/globals'`
 * binds the very things it names. Exempting it matters: a guard that fires on
 * correct code is a guard someone deletes.
 */
const FRAMEWORK_MODULES = /^(@jest\/globals|vitest|node:test|bun:test)$/;

/** Every file jest actually loads: test files and its setup files. */
function jestLoadedFiles(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) jestLoadedFiles(full, out);
    } else if (
      /\.(test|spec)\.tsx?$/.test(e.name) ||
      /^jest\..*\.(setup|config)\.(ts|js|tsx)$/.test(e.name) ||
      /^jest\.setup\.(ts|js)$/.test(e.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Local bindings introduced by an import or a require, in source order. */
function importBindings(src: string): { name: string; line: number; text: string }[] {
  const found: { name: string; line: number; text: string }[] = [];
  const lineOf = (idx: number) => src.slice(0, idx).split('\n').length;
  const add = (name: string, idx: number, text: string, from: string | undefined) => {
    if (from && FRAMEWORK_MODULES.test(from)) return;
    found.push({ name, line: lineOf(idx), text });
  };

  // import X from '…'  /  import X, { a } from '…'
  for (const m of src.matchAll(/^\s*import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,[^;]*)?from\s*['"]([^'"]+)['"]/gm)) {
    add(m[1], m.index ?? 0, m[0].trim(), m[2]);
  }
  // import * as X from '…'
  for (const m of src.matchAll(/^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]/gm)) {
    add(m[1], m.index ?? 0, m[0].trim(), m[2]);
  }
  // import { a, b as c } from '…'  — the BOUND name is what matters
  for (const m of src.matchAll(/^\s*import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gms)) {
    for (const raw of m[1].split(',')) {
      const spec = raw.trim().replace(/^type\s+/, '');
      if (!spec) continue;
      const name = spec.includes(' as ') ? spec.split(' as ').pop()!.trim() : spec;
      if (/^[A-Za-z_$][\w$]*$/.test(name)) {
        add(name, m.index ?? 0, `import { … ${spec} … } from '${m[2]}'`, m[2]);
      }
    }
  }
  // const X = require('…')
  for (const m of src.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]/gm)) {
    add(m[1], m.index ?? 0, m[0].trim(), m[2]);
  }
  return found;
}

describe('no import shadows a jest global', () => {
  const files = jestLoadedFiles(ROOT);

  it('found the test files to scan', () => {
    // A guard that silently scans nothing passes forever.
    expect(files.length).toBeGreaterThan(50);
  });

  it('binds nothing named describe/it/test/expect/jest/before*/after*', () => {
    const offences: string[] = [];
    for (const file of files) {
      let src: string;
      try {
        src = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const b of importBindings(src)) {
        if (!JEST_GLOBALS.has(b.name)) continue;
        offences.push(
          `${path.relative(ROOT, file)}:${b.line}  binds "${b.name}"  →  ${b.text}\n` +
          `      rename the binding (e.g. \`import ${b.name}Locale from …\`). ` +
          `Shadowing jest's \`${b.name}\` makes the whole file fail at collection ` +
          `with "(0 , _${b.name}.default) is not a function" — a suite that never runs.`,
        );
      }
    }
    expect(offences).toEqual([]);
  });
});
