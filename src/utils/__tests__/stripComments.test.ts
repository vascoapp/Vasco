/**
 * `stripComments` must remove comments and NOTHING else.
 *
 * Six static guards in this repo begin by stripping comments, so an error here
 * does not produce a wrong answer — it produces a guard that quietly stops
 * seeing its own subject and reports green forever. Both bugs this file pins
 * were found that way, and both were shipped by a stripper that looked right:
 *
 *   1. `'image/*'` — a MIME wildcard in a STRING opened a phantom block
 *      comment that ran to the next real close marker. 41 files lost >200
 *      characters each; 11 `Alert.alert` calls became invisible to the
 *      repo-wide guard.
 *   2. `/^https:\/\//` — a regex literal whose closing `\/` + `/` reads as a
 *      line comment, taking the rest of the line (`);` included) with it.
 *
 * The last test is the one with real teeth: it asks the TypeScript compiler
 * whether stripping changed the program, for every file in `app/` and `src/`.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { stripComments } from '../stripComments';

describe('stripComments', () => {
  it('removes line and block comments', () => {
    expect(stripComments('a; // gone\nb;')).toBe('a; \nb;');
    expect(stripComments('a; /* gone */ b;')).toBe('a;  b;');
  });

  it('keeps a comment marker that lives inside a string', () => {
    // The permits.tsx shape. Everything after it used to vanish.
    const src = `const p = { type: ['application/pdf', 'image/*'] };\nAlert.alert('x');`;
    expect(stripComments(src)).toContain("Alert.alert('x')");
    expect(stripComments(src)).toContain("'image/*'");
  });

  it('keeps a line-comment marker inside a string', () => {
    expect(stripComments(`const u = 'https://x.dev'; keep();`)).toContain('keep()');
  });

  it('survives a regex literal that ends in an escaped slash', () => {
    // The directions.test.ts shape: `\/` + `/` is not a line comment.
    const src = `expect(u).toMatch(/^https:\\/\\//);\nnext();`;
    const out = stripComments(src);
    expect(out).toContain('toMatch(/^https:\\/\\//)');
    expect(out).toContain('next()');
  });

  it('does not mistake division for a regex', () => {
    expect(stripComments('const r = a / b; const s = c / d;')).toBe(
      'const r = a / b; const s = c / d;',
    );
  });

  it('treats a slash after a keyword as a regex', () => {
    const src = 'function f(s) { return /a\\/b/.test(s); }';
    expect(stripComments(src)).toBe(src);
  });

  it('leaves template literals, including their interpolations, intact', () => {
    const src = 'const u = `${base}/api/v2`; // trailing\ngo();';
    const out = stripComments(src);
    expect(out).toContain('`${base}/api/v2`');
    expect(out).toContain('go()');
    expect(out).not.toContain('trailing');
  });

  it('handles an escaped quote inside a string', () => {
    const src = `const s = 'it\\'s fine'; after();`;
    expect(stripComments(src)).toContain('after()');
  });

  /**
   * The real guard. If stripping a file changes what TypeScript emits for it,
   * the stripper removed something that was not a comment — and every detector
   * built on it is scanning a file that does not exist.
   */
  it('changes no program in app/ or src/, as judged by the compiler', () => {
    const repo = path.join(__dirname, '..', '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(p);
        } else if (/\.tsx?$/.test(entry.name)) files.push(p);
      }
    };
    for (const r of ['app', 'src']) walk(path.join(repo, r));
    expect(files.length).toBeGreaterThan(400);

    const options = {
      removeComments: true,
      target: ts.ScriptTarget.ESNext,
      jsx: ts.JsxEmit.Preserve,
    };
    const norm = (s: string) => s.replace(/\s+/g, '');
    const broken: string[] = [];

    let compared = 0;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const o = { compilerOptions: options, fileName: f, reportDiagnostics: true };
      let before: ts.TranspileOutput;
      let after: ts.TranspileOutput;
      try {
        before = ts.transpileModule(src, o);
        after = ts.transpileModule(stripComments(src), o);
      } catch {
        // One file in the tree makes the emitter itself throw, on the ORIGINAL
        // source. That is not this function's problem, and skipping is honest —
        // `compared` below keeps the skip from quietly becoming the whole run.
        continue;
      }
      compared += 1;
      const newErrors = (after.diagnostics ?? []).length > (before.diagnostics ?? []).length;
      if (norm(before.outputText) !== norm(after.outputText) || newErrors) {
        broken.push(path.relative(repo, f));
      }
    }
    expect(broken).toEqual([]);
    // A try/catch that swallowed everything would leave `broken` empty too.
    expect(compared).toBeGreaterThan(files.length - 5);
  }, 120_000);

  /**
   * `scripts/lib/strip-comments.mjs` is a hand-kept copy, because the Node
   * scripts are plain ESM and cannot import this TypeScript module. A copy that
   * nothing compares is a copy that drifts — back into the bug it was written
   * to avoid, silently, in the scripts nobody runs locally.
   */
  it('matches the .mjs copy the scripts use, byte for byte, across the repo', () => {
    const repo = path.join(__dirname, '..', '..', '..');
    const mjs = fs.readFileSync(path.join(repo, 'scripts/lib/strip-comments.mjs'), 'utf8');
    // Evaluate the sibling implementation without a bundler: strip its ESM
    // export and hand the body to the Function constructor.
    const factory = new Function(`${mjs.replace(/^export\s+/gm, '')}; return stripComments;`);
    const other = factory() as (s: string) => string;

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue;
          walk(p);
        } else if (/\.tsx?$/.test(entry.name)) files.push(p);
      }
    };
    for (const r of ['app', 'src']) walk(path.join(repo, r));

    const divergent = files.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return stripComments(src) !== other(src);
    });
    expect(divergent.map((f) => path.relative(repo, f))).toEqual([]);
  }, 60_000);
});
