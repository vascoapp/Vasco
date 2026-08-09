/**
 * The aannemer team surface, signed in as an aannemer.
 *
 * This is the surface that has to hold up: a renovation GC running several
 * crews across several sites, several clients, at the same time. Everything
 * here is gated on `user.isAannemer`, so a walk that never signs in renders the
 * solo-contractor variant and sees none of it.
 *
 * Observation pass — writes what each screen rendered to aannemer-report.json.
 */
import fs from 'fs';
import path from 'path';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const APP = path.join(__dirname, '..', 'app');

const SCREENS: { id: string; file: string; params?: Record<string, string> }[] = [
  { id: 'werk (projects tab)', file: '(contractor)/werk.tsx' },
  { id: 'vandaag', file: '(contractor)/index.tsx' },
  { id: 'projects', file: 'contractor/projects.tsx' },
  { id: 'projects/[id]', file: 'contractor/projects/[id].tsx', params: { id: 'proj-seed-1' } },
  { id: 'project-billing/[id]', file: 'contractor/project-billing/[id].tsx', params: { id: 'proj-seed-1' } },
  { id: 'crew', file: 'contractor/crew.tsx' },
  { id: 'drag-schedule', file: 'contractor/drag-schedule.tsx' },
  { id: 'timesheet', file: 'contractor/timesheet.tsx' },
  { id: 'weekly-overview', file: 'contractor/weekly-overview.tsx' },
  { id: 'job-forms', file: 'contractor/job-forms.tsx' },
  { id: 'purchase-orders', file: 'contractor/purchase-orders.tsx' },
  { id: 'closeout', file: 'contractor/closeout.tsx' },
  { id: 'handover/[jobId]', file: 'contractor/handover/[jobId].tsx', params: { jobId: 'j-seed-1' } },
  { id: 'customer-crm', file: 'contractor/customer-crm.tsx' },
];

describe('aannemer team surface', () => {
  it('walks the multi-site screens signed in as an aannemer', async () => {
    const report: any[] = [];
    for (const s of SCREENS) {
      let entry: any = { screen: s.id, mounted: false, error: null, texts: [], a11y: [] };
      try {
        const Screen = require(path.join(APP, s.file)).default;
        const r = await walkScreen(Screen, { params: s.params ?? {}, as: 'aannemer', settlePasses: 10 });
        entry = {
          screen: s.id,
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
    const out = path.join(__dirname, 'aannemer-report.json');
    fs.writeFileSync(out, JSON.stringify({ role: 'aannemer', screens: report }, null, 1));
    // eslint-disable-next-line no-console
    console.log(`aannemer walk -> ${out}  mounted ${report.filter((r) => r.mounted).length}/${report.length}`);
    expect(report.length).toBe(SCREENS.length);
  }, 900_000);
});
