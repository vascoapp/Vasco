/**
 * The screen walk.
 *
 * Mounts every contractor + aannemer screen with the real Dutch locale and
 * records what it rendered to `walk-report.json`. Nothing is asserted here —
 * this is the observation pass. Findings that survive verification get locked
 * as real tests in `detectors.test.tsx`.
 *
 *   npm run walk            # demo contractor (what the simulator shows)
 *   WALK_POSTURE=fresh npm run walk   # day one: backend up, no rows
 *
 * Scope follows the user's standing steer: contractor and aannemer only.
 * `app/(tabs)`, `app/hub`, `app/sitelead` and `app/worker` are the
 * director/CFO/COO portfolio, which `enterprise_portfolio: false` ships to
 * nobody.
 */
import fs from 'fs';
import path from 'path';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const APP = path.join(__dirname, '..', 'app');

/** Params for dynamic routes, keyed by the route file's directory-relative id. */
const PARAMS: Record<string, Record<string, string>> = {
  'contractor/job/[id]': { id: 'j-seed-1' },
  'contractor/job/[id]/photos': { id: 'j-seed-1' },
  'contractor/job-quality/[id]': { id: 'j-seed-1' },
  'contractor/job-form/[jobId]': { jobId: 'j-seed-1' },
  'contractor/handover/[jobId]': { jobId: 'j-seed-1' },
  'contractor/customer/[id]': { id: 'cust-001' },
  'contractor/projects/[id]': { id: 'proj-seed-1' },
  'contractor/project-billing/[id]': { id: 'proj-seed-1' },
  'contractor/recurring/[id]': { id: 'rec-1' },
  'contractor/pricebook/[id]': { id: 'pb-1' },
  'contractor/site-assets/[customerId]': { customerId: 'cust-001' },
  'invoices/[id]': { id: 'inv-seed-1' },
  'quotes/[id]': { id: 'Q-2026-0031' },
  'quotes/[id]/invoice': { id: 'Q-2026-0031' },
  'quote/[id]': { id: 'Q-2026-0031' },
  'customer/[code]': { code: 'demo-code' },
  'accept/[token]': { token: 'demo-token' },
  'ref/[code]': { code: 'demo-ref' },
};

/** Directories that belong to the contractor / aannemer surface. */
const IN_SCOPE = [/^\(contractor\)\//, /^contractor\//, /^invoices\//, /^quotes?\//, /^customer\//, /^accept\//];
const ALSO = ['login.tsx', 'signup.tsx', 'onboarding.tsx', 'forgot-password.tsx', 'reset-password.tsx'];

function listScreens(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' && !entry.name.startsWith('+')) {
        out.push(path.relative(APP, full));
      }
    }
  };
  walk(APP);
  return out
    .filter((rel) => IN_SCOPE.some((re) => re.test(rel)) || ALSO.includes(rel))
    .filter((rel) => !rel.endsWith('error.tsx'))
    .sort();
}

describe('screen walk', () => {
  const screens = listScreens();
  const report: any[] = [];

  it(`walks ${screens.length} contractor/aannemer screens`, async () => {
    for (const rel of screens) {
      const id = rel.replace(/\.tsx$/, '');
      let entry: any = { screen: id, mounted: false, error: null, texts: [], a11y: [] };
      try {
        const mod = require(path.join(APP, rel));
        const Screen = mod.default;
        if (typeof Screen !== 'function') {
          entry.error = `no default export (got ${typeof Screen})`;
          report.push(entry);
          continue;
        }
        const r = await walkScreen(Screen, { params: PARAMS[id] ?? {} });
        entry = {
          screen: id,
          mounted: r.error === null,
          error: r.error?.message ?? null,
          texts: r.texts,
          a11y: r.a11yLabels,
        };
        teardown(r);
      } catch (e: any) {
        entry.error = `import: ${e?.message ?? String(e)}`;
      }
      report.push(entry);
    }

    const posture = process.env.WALK_POSTURE ?? 'demo';
    const out = path.join(__dirname, `walk-report.${posture}.json`);
    fs.writeFileSync(out, JSON.stringify({ posture, screens: report }, null, 1));
    // eslint-disable-next-line no-console
    console.log(
      `\nwalked ${report.length} screens -> ${out}\n` +
        `mounted: ${report.filter((r) => r.mounted).length}  failed: ${report.filter((r) => !r.mounted).length}`,
    );
    expect(report.length).toBeGreaterThan(0);
  }, 900_000);
});
