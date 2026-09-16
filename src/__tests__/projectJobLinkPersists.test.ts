/**
 * @jest-environment node
 */
// An aannemer assigning a job to a project changed `projects[].jobIds` in local
// state and nothing else. The persistent side of that link is `jobs.project_id`
// — a column that has existed since migration 20260501000001 — and neither
// mapper knew about it, while the BE project load hardcoded `jobIds: []`. So
// the next refresh emptied every project's job list, and the project P&L, cost
// roll-up and budget variance all read € 0 (#339, sweep 2026-09-16).
//
// Rule #8 (FE↔BE↔DB, 5 files): domain type, migration, database.types, write
// mapper, read mapper — and then a WRITER. This checks all six.
import fs from 'fs';
import path from 'path';
import { jobUpdatesToRowPayload, jobRowToJob } from '../lib/mappers';
import { stripComments } from '../utils/stripComments';
import type { JobRow } from '../lib/database.types';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the job↔project link crosses the mapper in both directions', () => {
  it('writes project_id', () => {
    expect(jobUpdatesToRowPayload({ projectId: 'p-1' })).toEqual({ project_id: 'p-1' });
  });

  it('clears it when the caller explicitly passes undefined', () => {
    // `'x' in updates` + `?? null`: without the coalesce the key holds
    // undefined, JSON.stringify drops it, and the old project comes back on the
    // next cold start (learnings #143).
    expect(jobUpdatesToRowPayload({ projectId: undefined })).toEqual({ project_id: null });
  });

  it('does not touch project_id when the caller never mentions it', () => {
    expect(jobUpdatesToRowPayload({ title: 'Boiler' })).not.toHaveProperty('project_id');
  });

  it('reads it back', () => {
    const row = { id: 'j-1', customer_id: null, title: 'Boiler', status: 'scheduled', project_id: 'p-1' } as unknown as JobRow;
    expect(jobRowToJob(row).projectId).toBe('p-1');
    expect(jobRowToJob({ ...row, project_id: null } as unknown as JobRow).projectId).toBeUndefined();
  });
});

describe('the column exists and the app state uses it', () => {
  it('the migration adds jobs.project_id', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260501000001_projects.sql'), 'utf8');
    expect(sql).toMatch(/alter table public\.jobs\s+add column if not exists project_id/);
  });

  it('JobRow declares it (a Row field that is not a column rejects the WHOLE write)', () => {
    expect(read('src/lib/database.types.ts')).toMatch(/project_id: string \| null;/);
  });

  it('assigning a job to a project persists to the job, not just the project', () => {
    const src = read('src/state/AppState.tsx');
    // `getProjectPnL:` also appears in the interface, hundreds of lines ABOVE
    // the implementation — indexOf there gives an empty slice that matches
    // nothing and passes every `not.toMatch`. Anchor forwards from the start.
    const at = src.indexOf('addJobToProject: (projectId, jobId)');
    expect(at).toBeGreaterThan(-1);
    const fn = src.slice(at, src.indexOf('getProjectPnL:', at));
    expect(fn).toMatch(/jobUpdatesToRowPayload\(\{ projectId \}\)/);
    expect(fn).toMatch(/persistOrQueue\('jobs', 'update'/);
    // And it does not double-link on a second tap.
    expect(fn).toMatch(/!p\.jobIds\.includes\(jobId\)/);
  });

  it('the BE project load rebuilds jobIds from the jobs', () => {
    const src = read('src/state/AppState.tsx');
    const load = src.slice(src.indexOf('const projectRows = await listProjects()'), src.indexOf('loadProjects failed'));
    expect(load).toMatch(/jobIdsByProject/);
    expect(load).not.toMatch(/jobIds: \[\],/);
  });

  it('a link made offline survives the refresh that has not seen the job yet', () => {
    const src = read('src/state/AppState.tsx');
    const load = src.slice(src.indexOf('const projectRows = await listProjects()'), src.indexOf('loadProjects failed'));
    // The rebuilt list comes from BE jobs only; a temp-id job is not in it.
    expect(load).toMatch(/tempJobIds/);
    expect(load).toMatch(/isTempIdFast\(id\)/);
  });
});
