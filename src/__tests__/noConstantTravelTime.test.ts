/**
 * @jest-environment node
 */
// A screen may not invent a drive time.
//
// The job detail screen built its fallback job with `travelTime: 15`, so every
// job — next door or 80 km away, in every market — read "15 Min. Fahrt" (German
// device walk, 2026-09-14). The app collects no device location; a travel time
// can only come from a route calculation, never a literal. Scheduler FIXTURES
// in src/services may carry one; a screen may not.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const APP = path.resolve(__dirname, '../../app');
const CONSTANT_TRAVEL = /\btravel(?:Time|Minutes|Min)\s*:\s*\d+(?:\.\d+)?\s*[,}\n]/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe('no screen hardcodes a travel time', () => {
  const files = walk(APP);

  it('scans the screens it claims to', () => {
    // A path mistake would scan nothing and report a clean sweep.
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith(path.join('contractor', 'job', '[id].tsx')))).toBe(true);
  });

  it('finds no literal travel time', () => {
    const hits = files
      .filter((f) => CONSTANT_TRAVEL.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(APP, f));
    expect(hits).toEqual([]);
  });
});
