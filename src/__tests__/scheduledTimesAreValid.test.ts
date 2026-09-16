/**
 * @jest-environment node
 */
// Dropping a job on the planner wrote its end time as
// `${hour + estimatedHours}:00`. Any fractional estimate — 2,5 h is the
// ordinary case — produced "11.5:00": not a time. It was persisted onto the
// job, shown on the job screen and handed to the ICS export, which cannot
// parse it (#339). The file already had `hoursToHM`; this one write path
// never used it.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const DIRS = ['app/contractor', 'app/(contractor)', 'src/services', 'src/components/contractor'];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('a time written onto a job is a real HH:MM', () => {
  it('the planner formats its end time', () => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, 'app/contractor/schedule.tsx'), 'utf8'));
    expect(src).toMatch(/const endTime = hoursToHM\(hour \+ job\.estimatedHours\)/);
    expect(src).toMatch(/const startTime = hoursToHM\(hour\)/);
  });

  it('nothing builds a time by concatenating a possibly-fractional value', () => {
    // `${h}:00` is fine for an integer loop counter; `${a + b}:00` is not,
    // because one of the addends is an hours ESTIMATE and those carry halves.
    const hits: string[] = [];
    for (const dir of DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const src = stripComments(fs.readFileSync(file, 'utf8'));
        src.split('\n').forEach((line, i) => {
          if (/\$\{[^}]*\+[^}]*\}:00/.test(line)) hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
