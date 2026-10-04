/**
 * Device calendar sync is offered only when the build can actually do it.
 *
 * `calendarSyncService` imports `expo-calendar` dynamically, and `expo-calendar`
 * was never a dependency — so every import threw, no calendar was ever found,
 * and the screen told the contractor to grant calendar rights in Settings,
 * which could not help (emulator walk W15, 2026-10-04). The entry points are
 * hidden behind DORMANT_CONTROLS.deviceCalendar. This ties that flag to the
 * module: switching it on without the dependency fails here, and so does the
 * dependency arriving while the screen stays gated (un-gate it on purpose).
 */
import * as fs from 'fs';
import * as path from 'path';
import { DORMANT_CONTROLS, DORMANT_ROUTES } from '../config/dormant';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const hasModule = !!pkg.dependencies?.['expo-calendar'];

describe('device calendar', () => {
  it('is offered exactly when expo-calendar is a dependency', () => {
    expect(DORMANT_CONTROLS.deviceCalendar).toBe(hasModule);
  });

  it('keeps its screen gated while the module is missing', () => {
    expect('contractor/calendar-settings' in DORMANT_ROUTES).toBe(!hasModule);
  });

  it('every live link to the calendar screen checks the flag', () => {
    const dormant: string[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/dormant.files.json'), 'utf8')).files;
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(full); }
        else if (/\.tsx?$/.test(e.name)) files.push(path.relative(ROOT, full));
      }
    };
    walk(path.join(ROOT, 'app'));
    walk(path.join(ROOT, 'src'));
    const linking = files.filter((f) => !dormant.includes(f))
      .filter((f) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).includes('/contractor/calendar-settings'));
    expect(linking.length).toBeGreaterThan(0);
    const ungated = linking.filter((f) => !stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8')).includes('DORMANT_CONTROLS.deviceCalendar'));
    expect(ungated).toEqual([]);
  });
});
