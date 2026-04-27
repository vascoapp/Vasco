// =============================================================================
// SCHEDULE CONFLICT DETECTION (R272)
// =============================================================================
// When the contractor drops a job onto a time slot, evaluate whether placing
// it there would:
//   - overlap an existing scheduled job (HARD — block by default)
//   - fall outside the contractor's working hours (HARD by default)
//   - sit immediately adjacent to another job with no travel buffer (SOFT)
//
// Returns a structured ConflictReport so the UI can show a one-line summary
// + each issue + an "Override" option for non-hard conflicts.
// =============================================================================

export type ConflictKind = 'overlap' | 'outside_working_hours' | 'no_travel_buffer';

export type ConflictSeverity = 'hard' | 'soft';

export interface ConflictIssue {
  kind: ConflictKind;
  severity: ConflictSeverity;
  message: string;
  /** When relevant, the job that conflicts. */
  conflictingJobId?: string;
}

export interface ConflictReport {
  hasConflict: boolean;
  hardConflict: boolean;
  softConflict: boolean;
  issues: ConflictIssue[];
}

export interface SlotCandidate {
  /** 0-23 integer hour. */
  startHour: number;
  /** Duration in hours. */
  durationHours: number;
}

export interface ExistingScheduleEntry {
  jobId: string;
  title?: string;
  startHour: number;
  durationHours: number;
}

export interface WorkingHours {
  /** Inclusive start hour (e.g., 7 means 07:00 is valid). */
  start: number;
  /** Exclusive end hour (e.g., 19 means 18:59 is valid, 19:00 is not). */
  end: number;
}

const DEFAULT_WORKING_HOURS: WorkingHours = { start: 7, end: 19 };
const TRAVEL_BUFFER_HOURS = 0.5;

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Detect all conflicts for placing `candidate` into a day's existing schedule.
 *
 * Hard conflicts (severity 'hard'):
 *   - overlap: any minute of candidate's window overlaps an existing job
 *   - outside_working_hours: start < workingHours.start OR
 *     end > workingHours.end
 *
 * Soft conflicts (severity 'soft'):
 *   - no_travel_buffer: candidate begins or ends within TRAVEL_BUFFER_HOURS
 *     of another job (typical contractor needs ~30 min between jobs)
 */
export function detectConflicts(
  candidate: SlotCandidate,
  existing: ExistingScheduleEntry[],
  workingHours: WorkingHours = DEFAULT_WORKING_HOURS,
): ConflictReport {
  const issues: ConflictIssue[] = [];
  const candStart = candidate.startHour;
  const candEnd = candidate.startHour + candidate.durationHours;

  // Hard: outside working hours
  if (candStart < workingHours.start || candEnd > workingHours.end) {
    issues.push({
      kind: 'outside_working_hours',
      severity: 'hard',
      message: `Outside working hours (${String(workingHours.start).padStart(2, '0')}:00–${String(workingHours.end).padStart(2, '0')}:00)`,
    });
  }

  for (const e of existing) {
    const eStart = e.startHour;
    const eEnd = e.startHour + e.durationHours;

    // Hard: overlap
    if (rangesOverlap(candStart, candEnd, eStart, eEnd)) {
      issues.push({
        kind: 'overlap',
        severity: 'hard',
        message: e.title
          ? `Overlaps "${e.title}" (${String(eStart).padStart(2, '0')}:00–${String(eEnd).padStart(2, '0')}:00)`
          : `Overlaps an existing job (${String(eStart).padStart(2, '0')}:00–${String(eEnd).padStart(2, '0')}:00)`,
        conflictingJobId: e.jobId,
      });
      continue; // overlap implies no buffer too — don't double-flag
    }

    // Soft: <30 min between candidate and existing on either side
    const gap = Math.min(
      Math.abs(eStart - candEnd),
      Math.abs(candStart - eEnd),
    );
    if (gap < TRAVEL_BUFFER_HOURS) {
      issues.push({
        kind: 'no_travel_buffer',
        severity: 'soft',
        message: e.title
          ? `Less than 30 min before/after "${e.title}" — no travel buffer`
          : `Less than 30 min before/after another job — no travel buffer`,
        conflictingJobId: e.jobId,
      });
    }
  }

  const hardConflict = issues.some((i) => i.severity === 'hard');
  const softConflict = issues.some((i) => i.severity === 'soft');
  return {
    hasConflict: issues.length > 0,
    hardConflict,
    softConflict,
    issues,
  };
}

export const __test = { rangesOverlap, TRAVEL_BUFFER_HOURS, DEFAULT_WORKING_HOURS };
