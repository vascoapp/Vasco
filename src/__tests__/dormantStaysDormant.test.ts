/**
 * Dormant code stays dormant — and new dead code is a decision, not an accident.
 *
 * User's decision 2026-09-24: the code no signed-in contractor can reach is
 * gated (src/config/dormant.ts) and kept for a future extension, not deleted.
 * The manifest (src/config/dormant.files.json) is what sweeps skip. So:
 *   - a manifest file that became REACHABLE was wired back in without being
 *     taken off the list — it would escape every sweep;
 *   - a reachable-set file that went UNREACHABLE is new dead code — add it on
 *     purpose (`node scripts/reachability.mjs --write-manifest`) or wire it.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DORMANT_ROUTES, isDormantRoute } from '../config/dormant';

const ROOT = path.join(__dirname, '../..');

describe('dormant code stays dormant', () => {
  const report = JSON.parse(execFileSync('node', ['scripts/reachability.mjs', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  const unreached = new Set<string>(Object.values(report.byArea as Record<string, Array<{ file: string }>>).flat().map((f) => f.file));
  const manifest = new Set<string>(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files);

  it('no dormant file became reachable without leaving the list', () => {
    expect([...manifest].filter((f) => !unreached.has(f) && fs.existsSync(path.join(ROOT, f)))).toEqual([]);
  });

  it('no new unreachable code slipped in unrecorded', () => {
    expect([...unreached].filter((f) => !manifest.has(f))).toEqual([]);
  });

  it('every gated route prefix still names a screen', () => {
    const appFiles = execFileSync('find', ['app', '-name', '*.tsx'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
      .map((f) => f.replace(/^app\//, '').replace(/\.tsx$/, '').replace(/\/index$/, ''));
    const stale = Object.keys(DORMANT_ROUTES).filter((p) => !appFiles.some((f) => f === p || f.startsWith(`${p}/`)));
    expect(stale).toEqual([]);
  });

  it('the gate matches whole segments', () => {
    expect(isDormantRoute(['hub', 'materials'])).toBe(true);
    expect(isDormantRoute(['(tabs)'])).toBe(true);
    expect(isDormantRoute(['contractor', 'closeout'])).toBe(true);
    expect(isDormantRoute(['contractor', 'closeout-report'])).toBe(false);
    expect(isDormantRoute(['(contractor)', 'werk'])).toBe(false);
    expect(isDormantRoute(['contractor', 'job', '123'])).toBe(false);
  });

  it('the root layout redirects dormant routes', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/_layout.tsx'), 'utf8');
    expect(src).toMatch(/isDormantRoute\(segments as string\[\]\)/);
  });
});
