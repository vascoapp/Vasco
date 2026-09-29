// A generator a CONTRACTOR can be shown must not send its button to a DORMANT
// route — the root layout bounces those home. Four site-lead generators were
// registered for 'contractor' while routing into `sitelead/*`; none showed yet
// only because no live screen passed their screen ids (2026-09-29).
import fs from 'fs';
import path from 'path';
import { GENERATOR_REGISTRY } from '../intelligence/generators';
import { DORMANT_ROUTES } from '../config/dormant';
import { stripComments } from '../utils/stripComments';

const DIR = path.resolve(__dirname, '../intelligence/generators');
const PREFIXES = Object.keys(DORMANT_ROUTES);
const fileFor = (id: string) =>
  path.join(DIR, `${id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Generator.ts`);

const forContractor = GENERATOR_REGISTRY.filter((g) => g.roles.includes('contractor' as any));

it('finds the contractor generators and their files', () => {
  expect(forContractor.length).toBeGreaterThan(10);
  expect(forContractor.filter((g) => fs.existsSync(fileFor(g.id))).length).toBeGreaterThan(10);
});

it('no contractor generator routes into a dormant screen', () => {
  const hits = forContractor.filter((g) => fs.existsSync(fileFor(g.id))).flatMap((g) => {
    const src = stripComments(fs.readFileSync(fileFor(g.id), 'utf8'));
    return [...src.matchAll(/[`'"]\/((?:\([a-z]+\)\/)?[a-z-]+(?:\/[a-z-]+)?)/g)]
      .map((m) => m[1])
      .filter((r) => PREFIXES.some((p) => r === p || r.startsWith(`${p}/`)))
      .map((r) => `${g.id} → /${r}`);
  });
  expect(hits).toEqual([]);
});
