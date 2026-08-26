/**
 * The contractor + aannemer screen inventory, shared by the walk and the
 * detectors so the two can never drift.
 *
 * `app/(tabs)`, `app/hub`, `app/sitelead` and `app/worker` are deliberately out
 * of scope: they are the director/CFO/COO portfolio, which ships to nobody
 * while `enterprise_portfolio` is false.
 */
import fs from 'fs';
import path from 'path';

export const APP_DIR = path.join(__dirname, '..', 'app');

/** Params for dynamic routes, keyed by route id. Values come from the seed. */
export const PARAMS: Record<string, Record<string, string>> = {
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

const IN_SCOPE = [/^\(contractor\)\//, /^contractor\//, /^invoices\//, /^quotes?\//, /^customer\//, /^accept\//];
const ALSO = ['login.tsx', 'signup.tsx', 'onboarding.tsx', 'forgot-password.tsx', 'reset-password.tsx'];

export function listScreens(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' && !entry.name.startsWith('+')) {
        out.push(path.relative(APP_DIR, full));
      }
    }
  };
  walk(APP_DIR);
  return out
    .filter((rel) => IN_SCOPE.some((re) => re.test(rel)) || ALSO.includes(rel))
    .filter((rel) => !rel.endsWith('error.tsx'))
    .sort();
}

export const routeId = (rel: string) => rel.replace(/\.tsx$/, '');
