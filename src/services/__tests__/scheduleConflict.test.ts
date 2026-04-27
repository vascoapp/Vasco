/**
 * @jest-environment node
 *
 * R272 — schedule conflict detection.
 */

import { detectConflicts } from '../scheduleConflictService';

describe('detectConflicts (R272)', () => {
  test('clean slot → no conflicts', () => {
    const r = detectConflicts({ startHour: 10, durationHours: 2 }, []);
    expect(r.hasConflict).toBe(false);
    expect(r.issues).toHaveLength(0);
  });

  test('overlap → hard conflict', () => {
    const r = detectConflicts(
      { startHour: 10, durationHours: 2 },
      [{ jobId: 'j1', title: 'Existing', startHour: 11, durationHours: 2 }],
    );
    expect(r.hardConflict).toBe(true);
    expect(r.issues[0].kind).toBe('overlap');
    expect(r.issues[0].conflictingJobId).toBe('j1');
  });

  test('exact-edge touch is NOT overlap', () => {
    // Existing 10-12, candidate 12-14 — share boundary, no minute of overlap
    const r = detectConflicts(
      { startHour: 12, durationHours: 2 },
      [{ jobId: 'j1', startHour: 10, durationHours: 2 }],
    );
    // Won't be 'overlap' but WILL be 'no_travel_buffer' (gap = 0)
    expect(r.hardConflict).toBe(false);
    expect(r.softConflict).toBe(true);
    expect(r.issues[0].kind).toBe('no_travel_buffer');
  });

  test('outside working hours: too early', () => {
    const r = detectConflicts({ startHour: 5, durationHours: 1 }, []);
    expect(r.hardConflict).toBe(true);
    expect(r.issues[0].kind).toBe('outside_working_hours');
  });

  test('outside working hours: ends too late', () => {
    const r = detectConflicts({ startHour: 18, durationHours: 3 }, []);
    expect(r.hardConflict).toBe(true);
    expect(r.issues.find((i) => i.kind === 'outside_working_hours')).toBeDefined();
  });

  test('soft conflict: <30min buffer between jobs', () => {
    // Existing 10-12, candidate 12-13 → gap = 0 < 0.5h
    const r = detectConflicts(
      { startHour: 12, durationHours: 1 },
      [{ jobId: 'j1', startHour: 10, durationHours: 2 }],
    );
    expect(r.hardConflict).toBe(false);
    expect(r.softConflict).toBe(true);
    expect(r.issues[0].kind).toBe('no_travel_buffer');
  });

  test('30min+ buffer is fine', () => {
    // Existing 10-12, candidate 12.5-13 → gap = 0.5h
    const r = detectConflicts(
      { startHour: 13, durationHours: 1 },
      [{ jobId: 'j1', startHour: 10, durationHours: 2 }],
    );
    expect(r.hasConflict).toBe(false);
  });

  test('overlap suppresses no_travel_buffer (no double-flag)', () => {
    const r = detectConflicts(
      { startHour: 11, durationHours: 2 },
      [{ jobId: 'j1', startHour: 10, durationHours: 3 }],
    );
    expect(r.issues.filter((i) => i.kind === 'overlap')).toHaveLength(1);
    expect(r.issues.filter((i) => i.kind === 'no_travel_buffer')).toHaveLength(0);
  });

  test('multiple existing jobs flag separately', () => {
    const r = detectConflicts(
      { startHour: 11, durationHours: 1 },
      [
        { jobId: 'j1', title: 'A', startHour: 10, durationHours: 2 },
        { jobId: 'j2', title: 'B', startHour: 12, durationHours: 1 },
      ],
    );
    expect(r.issues.filter((i) => i.kind === 'overlap')).toHaveLength(1);
  });

  test('custom working hours respected', () => {
    const r = detectConflicts(
      { startHour: 9, durationHours: 2 },
      [],
      { start: 8, end: 17 },
    );
    expect(r.hasConflict).toBe(false);
    const r2 = detectConflicts(
      { startHour: 16, durationHours: 2 },
      [],
      { start: 8, end: 17 },
    );
    expect(r2.hardConflict).toBe(true);
  });

  test('hardConflict + softConflict can coexist', () => {
    // Existing 10-12, candidate 11-12.4 → overlap (hard) + back-to-back to nothing
    const r = detectConflicts(
      { startHour: 11, durationHours: 1.4 },
      [{ jobId: 'j1', startHour: 10, durationHours: 2 }],
    );
    expect(r.hardConflict).toBe(true);
  });
});
