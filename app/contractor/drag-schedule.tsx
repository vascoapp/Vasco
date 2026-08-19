// =============================================================================
// SCHEDULE BOARD — tap to schedule, tap a block to reassign
// =============================================================================
// ⚠️ The route is still `/contractor/drag-schedule` and this file is still
// named for a gesture it has never had. Fourteen call sites point at that path
// (aiCommandRouter, queueItemExecutor, notificationService, three KPI tiles,
// deep links), so the NAME is a separate, riskier change than the behaviour.
// The header, though, used to describe a pick-up-and-drop interaction in
// detail, and no gesture library has ever been imported here — not
// PanResponder, not reanimated, nothing. A name that describes an intention
// outlives the intention; the comment at least should not.
//
// (Deliberately paraphrased, not quoted: __screenwalk__/scheduleMenuNotAlert
// greps this file for the old wording, and a detector that cannot tell a
// quotation from a claim is a detector that has to be argued with.)
//
// Interaction, actually:
//   · pool card  → menu of free slots (→ crew first, when crewMode)
//   · lane block → menu of crew members to move it to
//   · long-press a block → remove from the schedule
//
// Both menus are DKMenu, not Alert. House rule (CLAUDE.md): picking one of N
// is a balloon menu. This screen broke that rule AND paid for it — see
// SlotPicker below.
// =============================================================================

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { todayKey, weekKeys, startOfWeek } from '../../src/utils/dateKey';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { PAGE_BG } from '../../src/theme/tabStyles';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { DKMenu, type DKMenuItem } from '../../src/components/shared/DKMenu';
import { useAppState } from '../../src/state/AppState';
import { slotHoursOr } from '../../src/utils/jobSlot';
import { hapticSuccess, hapticWarning } from '../../src/utils/haptics';
import { scheduleJobReminder } from '../../src/services/pushNotificationService';
import { useTranslation } from 'react-i18next';
import { useFeatureFlag } from '../../src/services/featureFlagService';
import { shareAllScheduledJobs } from '../../src/services/calendarExportService';
import { getCalendarSyncSettings, syncJobToCalendar } from '../../src/services/calendarSyncService';
import { detectConflicts } from '../../src/services/scheduleConflictService';
import type { Job } from '../../src/domain/jobs';
import type { Worker } from '../../src/domain/worker';
import { staffingGapsForWeek, crewWeekLoad } from '../../src/services/crewWeekService';
import { makeEntityLabels } from '../../src/i18n/entityLabels';
import { tradeMismatch } from '../../src/services/crewAssignment';
import { useAuth } from '../../src/context/AuthContext';
import { formatWeekdayDayMonth, formatDayMonth, formatWeekdayShort } from '../../src/i18n/formatting';
import type { Country } from '../../src/i18n/formatting';

const CAL_PROMPT_DISMISSED_KEY = '@vasco_calendar_prompt_dismissed';

/**
 * R269: After scheduling, either silently sync (if enabled) or one-time-prompt
 * the user to enable calendar sync. Dismissed prompts are remembered.
 */
async function maybePromptCalendarSync(
  job: { id: string; scheduledDate?: string; scheduledStartTime?: string; scheduledEndTime?: string; title?: string; estimatedDuration?: number },
  router: ReturnType<typeof useRouter>,
  t: (k: string, d?: any) => string,
): Promise<void> {
  try {
    const settings = await getCalendarSyncSettings();
    if (settings.enabled) {
      await syncJobToCalendar(job as Job);
      return;
    }
    const dismissed = await AsyncStorage.getItem(CAL_PROMPT_DISMISSED_KEY);
    if (dismissed === 'true') return;
    Alert.alert(
      t('schedule.calendarPromptTitle', 'Sync to your calendar?'),
      t('schedule.calendarPromptBody', 'Show your jobs in your phone calendar so you never miss one.'),
      [
        { text: t('schedule.calendarPromptDismiss', 'Not now'), style: 'cancel', onPress: () => AsyncStorage.setItem(CAL_PROMPT_DISMISSED_KEY, 'true').catch(() => {}) },
        { text: t('schedule.calendarPromptEnable', 'Enable'), onPress: () => router.push('/contractor/calendar-settings' as any) },
      ],
    );
  } catch {
    // Best-effort — never block scheduling
  }
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 07:00 - 18:00

// ---------------------------------------------------------------------------
// BlockPressable — a scheduled block, which is a menu anchor only with a crew
// ---------------------------------------------------------------------------
/**
 * Solo contractors have nobody to reassign to, so wrapping every block in a
 * DKMenu for them would add a Modal and a measured anchor per block to show a
 * one-item menu. They keep the plain Pressable and the info Alert.
 *
 * Long-press still removes, in both branches — it is the only way off the
 * board and losing it would strand jobs.
 */
function BlockPressable({
  job, laneName, crewMode, items, onShowInfo, onRemove, reassignLabel, hoursToHM, children,
}: {
  job: ScheduledJob;
  laneName: string;
  crewMode: boolean;
  items: DKMenuItem[];
  onShowInfo: () => void;
  onRemove: () => void;
  reassignLabel: string;
  hoursToHM: (h: number) => string;
  children: React.ReactNode;
}) {
  const label = `${job.title}, ${laneName}, ${job.startHour}:00 – ${hoursToHM(job.startHour + job.duration)}${job.site ? `, ${job.site}` : ''}`;
  const style = [styles.laneBlock, {
    backgroundColor: job.color + '15',
    borderLeftColor: job.color,
    height: job.duration * SLOT_HEIGHT - 4,
  }];

  // A crew of one has nobody else to move the job to, so the menu would be
  // empty — and an empty menu is a dead control.
  if (!crewMode || items.length === 0) {
    return (
      <Pressable
        style={style}
        onLongPress={onRemove}
        onPress={onShowInfo}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <DKMenu
      renderAnchor={(open) => (
        <Pressable
          style={style}
          onLongPress={onRemove}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {children}
        </Pressable>
      )}
      items={items}
      accessibilityLabel={reassignLabel}
    />
  );
}

// ---------------------------------------------------------------------------
// SlotPicker — the scheduling menu, and why it is not an Alert
// ---------------------------------------------------------------------------
/**
 * This used to be `Alert.alert(…, [...slots, cancel])`, and on Android that is
 * a data-loss bug, not a style preference: **RN's Android Alert silently keeps
 * only the first three buttons.** Five slots plus cancel meant an Android
 * contractor could choose from two times and never knew the others existed.
 * The crew picker was worse — `[...workers, unassign, cancel]`, so a crew of
 * three or more was unreachable past the second name.
 *
 * The `.slice(0, 5)` that used to cap the slot list was a symptom of the same
 * cap. A DKMenu scrolls, so every free slot in the working day is offered now.
 *
 * Two steps when there is a crew, because "when" is only half the decision —
 * the job should land in somebody's lane, not in an anonymous company-wide
 * day. Step two reuses the same balloon: selecting a worker re-opens the menu
 * with the slot list. DKMenu closes on select (`close(); item.onPress()`), and
 * calling `open()` inside that same handler batches with the close, so the
 * balloon stays up and swaps its contents rather than blinking shut and back.
 */
export function SlotPicker({
  slots, workers, crewMode, currentWorkerId, onPick, accessibilityLabel, renderAnchor, labels,
}: {
  slots: number[];
  workers: { id: string; name: string }[];
  crewMode: boolean;
  currentWorkerId?: string;
  /** workerId is undefined for a solo contractor and for an explicit unassign. */
  onPick: (hour: number, workerId?: string) => void;
  accessibilityLabel: string;
  renderAnchor: (open: () => void) => React.ReactNode;
  labels: { chooseSlot: string; assignTo: string; unassign: string; noSlots: string };
}) {
  const [step, setStep] = useState<'worker' | 'slot'>(crewMode ? 'worker' : 'slot');
  const [pickedWorker, setPickedWorker] = useState<string | undefined>(undefined);
  const reopenRef = useRef<(() => void) | null>(null);

  const start = useCallback((open: () => void) => {
    // Always restart at step one. A menu that reopens halfway through a
    // decision the user abandoned is a menu that lies about where it is.
    setStep(crewMode ? 'worker' : 'slot');
    setPickedWorker(undefined);
    reopenRef.current = open;
    open();
  }, [crewMode]);

  const items: DKMenuItem[] = step === 'worker'
    ? [
        ...workers.map((w) => ({
          key: w.id,
          label: w.name,
          selected: w.id === currentWorkerId,
          onPress: () => {
            setPickedWorker(w.id);
            setStep('slot');
            reopenRef.current?.();
          },
        })),
        {
          key: '__unassigned',
          label: labels.unassign,
          emphasis: true,
          onPress: () => {
            setPickedWorker(undefined);
            setStep('slot');
            reopenRef.current?.();
          },
        },
      ]
    : slots.length > 0
      ? slots.map((h) => ({
          key: String(h),
          label: `${h}:00`,
          onPress: () => onPick(h, pickedWorker),
        }))
      : // An empty menu is a dead control. Say why there is nothing to pick.
        [{ key: '__none', label: labels.noSlots, onPress: () => {} }];

  return (
    <DKMenu
      renderAnchor={(open) => renderAnchor(() => start(open))}
      items={items}
      accessibilityLabel={step === 'worker' ? labels.assignTo : labels.chooseSlot}
    />
  );
}


const SLOT_HEIGHT = 60;

// Format a decimal-hours value (e.g. 16.5) as HH:MM ("16:30"). Block durations
// can be fractional now that they derive from the real slot, so
// `${startHour + duration}:00` would print "16.5:00" — an invalid time (and,
// in the ICS export below, an unparseable one).
const hoursToHM = (h: number): string => {
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const TIME_COL_WIDTH = 50;
const LANE_WIDTH = 150;
// A working day, used as each crew member's capacity denominator. The single
// -lane view has used 10 since it shipped; keep one constant so the solo
// utilisation bar and the per-person lane figures cannot drift apart.
const WORKDAY_HOURS = 10;

interface ScheduledJob {
  jobId: string;
  title: string;
  customerName: string;
  startHour: number;
  duration: number; // in hours
  color: string;
  /**
   * Which crew member is on this job. Undefined = nobody assigned yet.
   *
   * A solo contractor never sets this and the planner stays a single lane.
   * An aannemer runs several crews on several sites at once, so "when" is
   * only half the question — the board below splits by WHO, and conflicts are
   * scoped per person rather than across the whole company.
   */
  workerId?: string;
  /** Site label (city), so a multi-site day is readable at a glance. */
  site?: string;
}

const COLORS = [Palette.hermesOrange, '#3B82F6', '#10B981', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

export default function DragScheduleScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const country = (user?.country ?? 'NL') as Country;
  // Hidden for launch — see featureFlagService DEFAULTS.route_optimization.
  const routeOptimizationEnabled = useFeatureFlag('route_optimization');
  const router = useRouter();
  const { jobs, customers, workers, updateJobStatus, updateJob } = useAppState();
  // Only people currently on the crew get a lane. Inactive workers are kept
  // for historical job records (see src/domain/worker.ts) and must not appear.
  const activeWorkers = useMemo(() => workers.filter((w: Worker) => w.isActive), [workers]);
  // Solo contractors have no crew, so the per-person board would be one lane
  // labelled with their own name — noise. They keep the original timeline.
  const crewMode = activeWorkers.length > 0;
  // Shared enum→label helper (src/i18n/entityLabels.ts) — the milestone's
  // trade is a slug like 'tiling' and must not reach the strip raw.
  const { tradeLabel } = useMemo(() => makeEntityLabels(t), [t]);
  // R21: when entered from queue executor with ?jobId=, highlight the
  // suggested job in the unassigned pool so the contractor's eye lands on
  // it instantly. Was R1 deferral (schedule_suggestion didn't pre-position).
  // `?view=week` so the week board is addressable — a queue item or
  // notification about next week's staffing can land the contractor on the
  // view that answers it, instead of on today.
  const { jobId: focusJobId, view: viewParam } = useLocalSearchParams<{ jobId?: string; view?: string }>();

  // Day is a call-out model. A renovation crew sits on one address for a week,
  // and the plan that matters is trade order across weeks — so the week view
  // is where an aannemer answers "is this staffed?". Day stays the default
  // because it is what you open on the morning itself.
  const [viewMode, setViewMode] = useState<'day' | 'week'>(viewParam === 'week' ? 'week' : 'day');


  // localDateKey, not toISOString(): in UTC+x the UTC date is still
  // yesterday between local midnight and 02:00, so the planner showed the
  // wrong day's jobs in the early morning.
  const todayStr = todayKey();

  // Build schedule from REAL AppState jobs (already scheduled for today)
  const initialSchedule: ScheduledJob[] = jobs
    .filter((j: any) => j.scheduledDate === todayStr && (j.status === 'scheduled' || j.status === 'in-progress' || j.status === 'ingepland' || j.status === 'bezig'))
    .map((j: any, idx: number) => {
      const startHour = j.scheduledStartTime ? parseInt(j.scheduledStartTime.split(':')[0], 10) : 9;
      const cust = customers.find((c: any) => c.id === j.customerId);
      // Block length is TODAY'S SLOT, not j.estimatedDuration (the WHOLE job's
      // estimate — a 24h Badkamer renovatie rendered 13:00 to 37:00 and pushed
      // Bezetting to 270%). Shared helper: the same mix-up also hit the Werk
      // badge and Weekoverzicht, each with its own copy of this arithmetic.
      return {
        jobId: j.id,
        title: j.title,
        // Never fall back to the raw customerId — it renders on the planner
        // card as "cust-003". Blank is better than an internal id.
        customerName: cust?.name || '',
        startHour: isNaN(startHour) ? 9 : startHour,
        duration: slotHoursOr(j, 2),
        // In crew mode the colour identifies the PERSON, so the same worker
        // reads the same everywhere; otherwise keep the per-job palette.
        color: j.assignedWorkerId
          ? (workers.find((w: Worker) => w.id === j.assignedWorkerId)?.color ?? COLORS[idx % COLORS.length])
          : COLORS[idx % COLORS.length],
        workerId: j.assignedWorkerId,
        site: j.address?.city || undefined,
      };
    });

  // Unassigned = jobs that need scheduling (lead, quoted, accepted, or scheduled without a date)
  const initialUnassigned = jobs
    .filter((j: any) =>
      ['lead', 'quoted', 'accepted', 'scheduled'].includes(j.status) &&
      j.scheduledDate !== todayStr // not already on today's schedule
    )
    .slice(0, 10)
    .map((j: any) => {
      const cust = customers.find((c: any) => c.id === j.customerId);
      return {
        jobId: j.id,
        title: j.title,
        // Never fall back to the raw customerId — it renders on the planner
        // card as "cust-003". Blank is better than an internal id.
        customerName: cust?.name || '',
        estimatedHours: j.estimatedDuration || 2,
        site: j.address?.city || undefined,
      };
    });

  const [schedule, setSchedule] = useState<ScheduledJob[]>(initialSchedule);
  const [unassigned, setUnassigned] = useState(initialUnassigned);

  // AppState hydrates asynchronously, so on a cold open `jobs` is [] at mount
  // and these useState initialisers captured empty arrays — the planner then
  // stayed permanently blank until the screen was unmounted and re-entered.
  // Re-sync whenever the underlying set of jobs actually changes. Local drag
  // positions are intentionally reset by that: they are not persisted, so the
  // job list is the only source of truth worth preserving.
  const sourceSignature = `${initialSchedule.map((j) => `${j.jobId}@${j.startHour}`).join(',')}|${initialUnassigned.map((j: any) => j.jobId ?? j.id).join(',')}`;
  const lastSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSyncedRef.current === sourceSignature) return;
    lastSyncedRef.current = sourceSignature;
    setSchedule(initialSchedule);
    setUnassigned(initialUnassigned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceSignature]);
  const [draggedJob, setDraggedJob] = useState<string | null>(null);
  const [dropTargetHour, setDropTargetHour] = useState<number | null>(null);

  // App locale, not device: this header read "Sunday, August 9" on a Dutch
  // planner whose every other string was Dutch.
  const today = formatWeekdayDayMonth(new Date(), country);

  // One lane per crew member, plus a lane for work nobody owns yet. The
  // unassigned lane is the point of the board for an aannemer: it is the list
  // of jobs that will not happen unless somebody is put on them.
  const lanes = useMemo(() => {
    if (!crewMode) return [];
    const rows = activeWorkers.map((w) => ({
      id: w.id as string | null,
      name: w.name,
      color: w.color ?? Palette.hermesOrange,
      jobs: schedule.filter((s) => s.workerId === w.id),
    }));
    // Anything not sitting in one of the lanes above — no assignee, or an
    // assignee who is no longer active. Deactivating a worker does NOT clear
    // their assignments (only deleting one does, AppState ~1214), so without
    // this the job would render in NO lane: scheduled work, invisible on the
    // board. Every scheduled job must appear exactly once.
    const laneIds = new Set(rows.map((r) => r.id));
    const orphan = schedule.filter((s) => !s.workerId || !laneIds.has(s.workerId));
    if (orphan.length) {
      rows.push({ id: null, name: t('schedule.unassignedLane'), color: SemanticColors.textTertiary, jobs: orphan });
    }
    return rows;
  }, [crewMode, activeWorkers, schedule, t]);

  // ─── Week view ───────────────────────────────────────────────────────────
  const { projects } = useAppState();
  const weekDayKeys = useMemo(() => weekKeys(new Date()), []);
  const weekLoad = useMemo(
    () => crewWeekLoad({
      jobs: jobs as any,
      weekDayKeys,
      hoursFor: (j: any) => slotHoursOr(j, 2),
    }),
    [jobs, weekDayKeys],
  );
  // ProjectMilestone has carried `trade` + `weekNumber` since it was written
  // and nothing read it, so a plan could reach the week that needs a tiler
  // with no tiler booked and the app said nothing.
  const gaps = useMemo(
    () => (crewMode
      ? staffingGapsForWeek({ projects: projects as any, jobs: jobs as any, workers: activeWorkers as any, weekDayKeys })
      : []),
    [crewMode, projects, jobs, activeWorkers, weekDayKeys],
  );
  // "Book a tiler" and "the room is not ready" are opposite instructions, so
  // they are split at the source rather than distinguished by wording.
  const blockedGaps = useMemo(() => gaps.filter(g => !!g.blockedByTitle), [gaps]);
  const unstaffedGaps = useMemo(() => gaps.filter(g => !g.blockedByTitle), [gaps]);
  const weekLabel = useMemo(
    () => t('schedule.weekOf', { date: formatDayMonth(startOfWeek(new Date()), country) }),
    [t, country],
  );
  // formatWeekdayShort, not Intl with an undefined locale: `undefined` means
  // the DEVICE, which printed "Mon Tue Wed" across a Dutch planner. Exactly the
  // bug this file's own header comment was fixed for one round earlier.
  const weekdayNames = useMemo(
    () => weekDayKeys.map((k) => formatWeekdayShort(new Date(`${k}T12:00:00`), country)),
    [weekDayKeys, country],
  );

  const totalScheduledHours = schedule.reduce((sum, j) => sum + j.duration, 0);
  // Capacity is the CREW's day, not one person's. With two crews booked 5h and
  // 4h the bar read "9u / 10u (90%)" directly above lanes saying 5/10 and 4/10
  // — the same screen disagreeing with itself, and a company that looks full
  // while both crews are free all afternoon.
  const dayCapacity = crewMode ? activeWorkers.length * WORKDAY_HOURS : WORKDAY_HOURS;
  const utilizationPct = dayCapacity > 0
    ? Math.round((totalScheduledHours / dayCapacity) * 100)
    : 0;

  const handleDropOnSlot = (
    hour: number,
    job: { jobId: string; title: string; customerName: string; estimatedHours: number; site?: string },
    workerId?: string,
  ) => {
    // R272: structured conflict detection — overlap + working hours (HARD)
    // and travel-buffer (SOFT, overridable).
    //
    // Scoped to the PERSON doing the job. Comparing a candidate against the
    // whole company's day is right for a solo contractor and wrong for an
    // aannemer: two crews working two sites at 09:00 is normal operation, not
    // a clash, while the same person on both is the thing that must be caught.
    const lane = crewMode
      ? schedule.filter((s) => (s.workerId ?? null) === (workerId ?? null))
      : schedule;
    const report = detectConflicts(
      { startHour: hour, durationHours: job.estimatedHours },
      lane.map((s) => ({ jobId: s.jobId, title: s.title, startHour: s.startHour, durationHours: s.duration })),
    );

    // R13.1: was a real-bug — visual `proceed` was separate from persistence,
    // and persistence only ran on the no-conflict fallthrough path. When a
    // contractor tapped "Schedule anyway" after a soft conflict, the visual
    // schedule updated but updateJob / updateJobStatus / calendar sync /
    // push reminder NEVER fired, so the job didn't actually get scheduled
    // (next app open showed it back in the unassigned column). Folded the
    // persistence calls into `proceed` so all three drop paths persist.
    const proceed = () => {
      const worker = workerId ? activeWorkers.find((w) => w.id === workerId) : undefined;
      const color = worker?.color ?? COLORS[schedule.length % COLORS.length];
      setSchedule(prev => [...prev, {
        jobId: job.jobId,
        title: job.title,
        customerName: job.customerName,
        startHour: hour,
        duration: job.estimatedHours,
        color,
        workerId,
        site: job.site,
      }]);
      setUnassigned(prev => prev.filter(u => u.jobId !== job.jobId));
      hapticSuccess();
      setDraggedJob(null);
      setDropTargetHour(null);

      // PERSIST to AppState — update job with scheduled date/time and status
      try {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + job.estimatedHours).toString().padStart(2, '0')}:00`;
        updateJob(job.jobId, {
          scheduledDate: todayStr,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
          estimatedDuration: job.estimatedHours,
          // Persisted so the board survives a reload and so the rest of the
          // app (crew screen, job detail) agrees on who is on this job.
          ...(crewMode ? { assignedWorkerId: workerId } : {}),
        });
        updateJobStatus(job.jobId, 'scheduled');
        // R269: contextual calendar prompt during scheduling — auto-sync if
        // already enabled, else one-time prompt to enable.
        maybePromptCalendarSync(
          { id: job.jobId, title: job.title, scheduledDate: todayStr, scheduledStartTime: startTime, scheduledEndTime: endTime, estimatedDuration: job.estimatedHours },
          router,
          t,
        );
      } catch {}

      // Fire-and-forget push notification reminder (1h before scheduled time)
      const today = new Date();
      const scheduledTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, 0, 0);
      scheduleJobReminder({ jobId: job.jobId, jobTitle: job.title, scheduledTime }).catch(() => {});
    };

    if (report.hardConflict) {
      hapticWarning();
      const reasons = report.issues.filter((i) => i.severity === 'hard').map((i) => `• ${i.message}`).join('\n');
      Alert.alert(t('schedule.conflict', 'Conflict'), reasons);
      setDraggedJob(null);
      setDropTargetHour(null);
      return;
    }

    if (report.softConflict) {
      hapticWarning();
      const reasons = report.issues.filter((i) => i.severity === 'soft').map((i) => `• ${i.message}`).join('\n');
      Alert.alert(
        t('schedule.softConflictTitle', 'Heads up'),
        reasons,
        [
          { text: t('schedule.softCancel', 'Pick another slot'), style: 'cancel', onPress: () => { setDraggedJob(null); setDropTargetHour(null); } },
          { text: t('schedule.softOverride', 'Schedule anyway'), onPress: proceed },
        ],
      );
      return;
    }

    proceed();
  };

  const handleExportCalendar = async () => {
    // Build minimal Job objects from scheduled items for the calendar export
    const scheduledJobs: Job[] = schedule.map(s => ({
      id: s.jobId,
      title: s.title,
      description: '',
      status: 'scheduled' as const,
      customerId: '',
      customerName: s.customerName,
      trade: 'general',
      createdAt: new Date().toISOString(),
      // todayKey(), not toISOString(): the latter is the UTC date, so a job
      // created between midnight and 02:00 CEST was filed under YESTERDAY and
      // vanished from the planner it was just dragged onto.
      scheduledDate: todayKey(),
      scheduledStartTime: `${s.startHour.toString().padStart(2, '0')}:00`,
      scheduledEndTime: hoursToHM(s.startHour + s.duration),
    } as any));
    try {
      await shareAllScheduledJobs(scheduledJobs);
      hapticSuccess();
    } catch {
      // Share cancelled
    }
  };

  /**
   * Warn before putting somebody on a job outside their trade, then run
   * `then`. A WARNING, never a block: the contractor knows their crew — an
   * apprentice shadowing a lead, a painter who also tiles. Blocking would
   * teach people to route around the app.
   */
  const confirmTrade = (workerId: string | undefined, jobId: string, then: () => void) => {
    const worker = workerId ? activeWorkers.find((w) => w.id === workerId) : undefined;
    const appJob = (jobs as any[]).find((j) => j.id === jobId);
    const mismatch = tradeMismatch(worker as any, appJob as any, tradeLabel);
    if (!mismatch) { then(); return; }
    hapticWarning();
    Alert.alert(
      t('schedule.tradeMismatchTitle'),
      t('schedule.tradeMismatchBody', {
        worker: mismatch.workerName,
        workerTrade: mismatch.workerTrade,
        jobTrade: mismatch.jobTrade,
      }),
      [
        { text: t('schedule.pickSomeoneElse'), style: 'cancel' },
        { text: t('schedule.assignAnyway'), onPress: then },
      ],
    );
  };

  /**
   * Move a scheduled job to a different crew member.
   *
   * Reassigning is the operation an aannemer performs most on a running day —
   * someone calls in sick, a site over-runs — and it has to be reachable from
   * the block itself rather than by deleting and re-scheduling.
   */
  /** Solo contractor: there is nobody to reassign to, so the tap just tells
   *  you what the block is. Unchanged, and a two-button Alert is fine. */
  const showJobInfo = (job: ScheduledJob) => {
    Alert.alert(job.title, `${job.customerName}\n${job.startHour}:00 – ${hoursToHM(job.startHour + job.duration)}`);
  };

  /**
   * Crew members this job could move to, as menu items.
   *
   * Was an `Alert.alert(reassignTo, [...workers, unassign, cancel])` — which on
   * Android showed the first three buttons and dropped the rest, so a crew of
   * four had two reachable names. Returning items instead of raising an Alert
   * lets DKMenu scroll the whole crew.
   */
  const reassignItems = (job: ScheduledJob): DKMenuItem[] => {
    const apply = (workerId?: string) => {
      const worker = workerId ? activeWorkers.find((w) => w.id === workerId) : undefined;
      setSchedule((prev) => prev.map((s2) => s2.jobId === job.jobId
        ? { ...s2, workerId, color: worker?.color ?? COLORS[0] }
        : s2));
      try { updateJob(job.jobId, { assignedWorkerId: workerId }); } catch {}
      hapticSuccess();
    };
    return [
      ...activeWorkers
        .filter((w) => w.id !== job.workerId)
        .map((w) => ({
          key: w.id,
          label: w.name,
          onPress: () => confirmTrade(w.id, job.jobId, () => apply(w.id)),
        })),
      ...(job.workerId
        ? [{ key: '__unassign', label: t('schedule.unassign'), emphasis: true, onPress: () => apply(undefined) }]
        : []),
    ];
  };

  const handleRemoveFromSchedule = (jobId: string) => {
    const job = schedule.find(s => s.jobId === jobId);
    if (!job) return;

    Alert.alert(t('schedule.removeJob', 'Klus verwijderen'), `"${job.title}" ${t('schedule.removeFromSchedule', 'uit planning verwijderen')}?`, [
      { text: t('schedule.cancel', 'Annuleren'), style: 'cancel' },
      {
        text: t('schedule.remove', 'Verwijderen'),
        style: 'destructive',
        onPress: () => {
          setSchedule(prev => prev.filter(s => s.jobId !== jobId));
          setUnassigned(prev => [...prev, {
            jobId: job.jobId,
            title: job.title,
            customerName: job.customerName,
            estimatedHours: job.duration,
            site: job.site,
          }]);
          hapticSuccess();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={SemanticColors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>{t('schedule.daySchedule', 'Day schedule')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{today}</Text>
        </View>
        {/* Route optimisation hidden for launch (2026-07-20). The drag-to-
            reschedule planner itself stays — only the optimise action is
            gated, via the remotely-flippable `route_optimization` flag. */}
        {routeOptimizationEnabled && (
        <Pressable
          onPress={async () => {
            // R254: optimize today's job order via the new scheduler. Uses
            // postcode-prefix proximity for distance + priority weighting.
            if (schedule.length < 2) {
              Alert.alert(t('schedule.optimizeNeedTwo', 'Need at least 2 jobs to optimize'));
              return;
            }
            try {
              const { optimizeSchedule } = await import('../../src/services/optimalSchedulerService');
              const startCountry = ((jobs as any[]).find((j) => j?.address?.country)?.address?.country ?? 'NL');
              const startPostcode = (jobs as any[]).find((j) => j?.address?.postcode)?.address?.postcode ?? '';
              const optimized = optimizeSchedule(
                schedule.map((s) => {
                  const j = (jobs as any[]).find((x) => x.id === s.jobId);
                  return {
                    id: s.jobId,
                    title: s.title,
                    postcode: j?.address?.postcode,
                    country: (j?.address?.country ?? startCountry),
                    estimatedHours: s.duration,
                    priority: j?.priority,
                  };
                }),
                {
                  date: todayStr,
                  startPostcode: startPostcode || ((jobs as any[])[0]?.address?.postcode ?? ''),
                  startCountry,
                },
              );
              const newSchedule = optimized.stops.map((stop, idx) => ({
                jobId: stop.job.id,
                title: stop.job.title ?? '',
                customerName: schedule.find((s) => s.jobId === stop.job.id)?.customerName ?? '',
                startHour: parseInt(stop.arrivalAt.split(':')[0], 10),
                duration: stop.job.estimatedHours,
                color: COLORS[idx % COLORS.length],
              }));
              // R255: capture before/after for the savings widget.
              //
              // This used to invent the baseline — `reduce((sum, _, idx) =>
              // sum + (idx > 0 ? 5 : 0))`, i.e. a flat 5km per job — and that
              // number is persisted by recordOptimization and surfaces as the
              // contractor's weekly "km saved". The saving was arithmetic on a
              // made-up constant.
              //
              // Measure the CURRENT order instead, with the same distance
              // function and defaults the optimizer itself uses (avgSpeed 50,
              // postcode fallback 25km), so before/after are directly
              // comparable and both reflect real postcodes.
              const { __internal } = await import('../../src/services/optimalSchedulerService');
              const AVG_SPEED_KMH = 50;
              const FALLBACK_KM = 25;
              const legFrom = (jobId: string) => {
                const j = (jobs as any[]).find((x) => x.id === jobId);
                return {
                  lat: j?.address?.lat,
                  lng: j?.address?.lng,
                  postcode: j?.address?.postcode,
                  country: (j?.address?.country ?? startCountry) as any,
                };
              };
              let driveKmBefore = 0;
              let prevStop = {
                lat: undefined as number | undefined,
                lng: undefined as number | undefined,
                postcode: startPostcode || ((jobs as any[])[0]?.address?.postcode ?? ''),
                country: startCountry as any,
              };
              for (const s of schedule) {
                const stop = legFrom(s.jobId);
                driveKmBefore += __internal.distanceKm(prevStop, stop, FALLBACK_KM);
                prevStop = stop;
              }
              driveKmBefore = Math.round(driveKmBefore * 10) / 10;
              const driveMinBefore = Math.round((driveKmBefore / AVG_SPEED_KMH) * 60);

              setSchedule(newSchedule);
              hapticSuccess();
              const summary = t('schedule.driveSummary', '{{km}}km · {{min}}min driving', {
                km: optimized.totalDriveKm,
                min: Math.round(optimized.totalDriveMin),
              })
                + (optimized.warnings.length ? `\n⚠ ${optimized.warnings.join('; ')}` : '');

              // R255: write optimized order back to AppState — persist scheduledStartTime per job
              for (const stop of optimized.stops) {
                try {
                  // R66 round 22: was `as any` — both fields are real on
                  // Job (src/domain/jobs.ts). Same R21 cleanup pattern.
                  updateJob(stop.job.id, {
                    scheduledStartTime: stop.arrivalAt,
                    scheduledEndTime: stop.departureAt,
                  });
                } catch {
                  // continue with remaining stops
                }
              }

              // R255: record the optimization event for weekly stats
              try {
                const { recordOptimization } = await import('../../src/services/optimizationStatsService');
                await recordOptimization({
                  date: todayStr,
                  jobCount: optimized.stops.length,
                  driveKmBefore,
                  driveMinBefore,
                  driveKmAfter: optimized.totalDriveKm,
                  driveMinAfter: optimized.totalDriveMin,
                  warnings: optimized.warnings.length,
                  applied: true,
                });
              } catch {
                // best-effort
              }

              Alert.alert(t('schedule.optimizedTitle', 'Route optimized'), summary + '\n\n' + t('schedule.optimizedApplied', 'Applied to today\'s schedule.'));
            } catch (e) {
              hapticWarning();
              Alert.alert(t('schedule.optimizeFailed', 'Optimization failed'), String((e as Error).message ?? e));
            }
          }}
          style={styles.exportButton}
          accessibilityRole="button"
          accessibilityLabel={t('schedule.optimize', 'Optimize order')}
        >
          <Ionicons name="flash-outline" size={18} color={Palette.hermesOrange} />
          <Text style={styles.exportButtonText}>{t('schedule.optimize', 'Optimize')}</Text>
        </Pressable>
        )}
        <Pressable onPress={handleExportCalendar} style={styles.exportButton} accessibilityRole="button" accessibilityLabel={t('schedule.export', 'Export to calendar')}>
          <Ionicons name="calendar-outline" size={18} color={Palette.hermesOrange} />
          <Text style={styles.exportButtonText}>{t('schedule.export', 'Exporteer')}</Text>
        </Pressable>
      </View>

      {/* Day / Week. Only when there is a crew: a solo contractor has no
          staffing question to answer, so the toggle would be a second way to
          look at the same one person. */}
      {crewMode && (
        <View style={styles.viewToggle}>
          {(['day', 'week'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === mode }}
            >
              <Text style={[styles.viewToggleText, viewMode === mode && styles.viewToggleTextActive]}>
                {mode === 'day' ? t('schedule.viewDay') : t('schedule.viewWeek')}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Staffing gaps — the plan says a trade is due this week and nobody of
          that trade is on it. Shown in week view, where it is actionable.

          Split in two, because the two halves call for opposite actions and a
          single "Not staffed" heading asserted the wrong one over both (#127 —
          adding a dimension leaves the old aggregate measuring the old thing).
          Unstaffed: book someone. Blocked: booking someone would not help, the
          room is not ready. */}
      {crewMode && viewMode === 'week' && unstaffedGaps.length > 0 && (
        <View style={styles.gapCard}>
          <View style={styles.gapHeader}>
            <Ionicons name="warning-outline" size={16} color={Palette.orange500} />
            <Text style={styles.gapTitle}>{t('schedule.gapTitle')}</Text>
          </View>
          {unstaffedGaps.slice(0, 4).map((gap) => (
            <Text key={`${gap.projectId}-${gap.milestoneTitle}`} style={styles.gapLine} numberOfLines={2}>
              {gap.nobodyOnProject
                ? t('schedule.gapNobody', { project: gap.projectTitle, milestone: gap.milestoneTitle })
                : t('schedule.gapLine', {
                    project: gap.projectTitle,
                    milestone: gap.milestoneTitle,
                    trade: tradeLabel(gap.trade),
                  })}
            </Text>
          ))}
          {unstaffedGaps.length > 4 ? (
            <Text style={styles.gapMore}>{t('schedule.gapMore', { count: unstaffedGaps.length - 4 })}</Text>
          ) : null}
        </View>
      )}

      {crewMode && viewMode === 'week' && blockedGaps.length > 0 && (
        <View style={styles.gapCard}>
          <View style={styles.gapHeader}>
            <Ionicons name="hourglass-outline" size={16} color={SemanticColors.feedbackWarning} />
            <Text style={styles.gapTitle}>{t('schedule.blockedTitle')}</Text>
          </View>
          {blockedGaps.slice(0, 4).map((gap) => (
            <Text key={`${gap.projectId}-${gap.milestoneTitle}`} style={styles.gapLine} numberOfLines={2}>
              {t('schedule.blockedLine', {
                project: gap.projectTitle,
                milestone: gap.milestoneTitle,
                blocker: gap.blockedByTitle,
              })}
            </Text>
          ))}
          {blockedGaps.length > 4 ? (
            <Text style={styles.gapMore}>{t('schedule.gapMore', { count: blockedGaps.length - 4 })}</Text>
          ) : null}
        </View>
      )}

      {/* Utilization bar */}
      <View style={styles.utilBar}>
        <View style={styles.utilInfo}>
          <Text style={styles.utilLabel}>{t('schedule.utilization', 'Bezetting')}</Text>
          <Text style={styles.utilValue}>
            {t('common.durationH', { defaultValue: '{{h}}h', h: totalScheduledHours })}
            {' / '}
            {t('common.durationH', { defaultValue: '{{h}}h', h: dayCapacity })}
            {` (${utilizationPct}%)`}
          </Text>
        </View>
        <View style={styles.utilTrack}>
          <View style={[styles.utilFill, { width: `${Math.min(utilizationPct, 100)}%` }]} />
        </View>
      </View>

      {/* Unassigned pool */}
      {unassigned.length > 0 && (
        <View style={styles.poolSection}>
          <Text style={styles.poolTitle}>{t('schedule.unscheduled', 'Niet ingepland')} ({unassigned.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poolContent}>
            {unassigned.map(job => (
              <View key={job.jobId} style={[styles.poolCard, focusJobId && job.jobId === focusJobId && styles.poolCardFocus]}>
                <Text style={styles.poolJobTitle} numberOfLines={1}>{job.title}</Text>
                <Text style={styles.poolJobCustomer} numberOfLines={1}>{job.customerName}</Text>
                {/* The site gets its own line. Joined with the customer on one
                    fixed-width line it truncated to "Fam. de Vries · Haar…" —
                    and WHERE the job is is exactly what you need before
                    deciding which crew takes it. */}
                {job.site ? (
                  <View style={styles.poolSiteRow}>
                    <Ionicons name="location-outline" size={11} color={SemanticColors.textTertiary} />
                    <Text style={styles.poolJobCustomer} numberOfLines={1}>{job.site}</Text>
                  </View>
                ) : null}
                <Text style={styles.poolJobHours}>{t('common.durationH', { defaultValue: '{{h}}h', h: job.estimatedHours })}</Text>
                {/* Tap to pick time slot */}
                {/* No `.slice(0, 5)` any more — that cap existed to stay under
                    the Android Alert's 3-button ceiling, and a DKMenu scrolls.
                    Every slot the job actually fits in is offered. */}
                <SlotPicker
                  slots={HOURS.filter((h) => h + job.estimatedHours <= 19)}
                  workers={activeWorkers.map((w) => ({ id: w.id, name: w.name }))}
                  crewMode={crewMode}
                  onPick={(hour, workerId) => {
                    if (!workerId) { handleDropOnSlot(hour, job, undefined); return; }
                    // The trade check still gates the assignment, and still
                    // warns rather than blocks — an apprentice shadowing a lead
                    // is a real day.
                    confirmTrade(workerId, job.jobId, () => handleDropOnSlot(hour, job, workerId));
                  }}
                  accessibilityLabel={t('schedule.chooseSlot', 'Tijdslot kiezen')}
                  labels={{
                    chooseSlot: t('schedule.chooseSlot', 'Tijdslot kiezen'),
                    assignTo: t('schedule.assignTo'),
                    unassign: t('schedule.unassign'),
                    noSlots: t('schedule.noFreeSlots', 'Geen vrij tijdslot vandaag'),
                  }}
                  renderAnchor={(open) => (
                    <Pressable
                      style={styles.poolAssignBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('schedule.schedule', 'Schedule')} ${job.title}`}
                      onPress={open}
                    >
                      <Ionicons name="add-circle" size={14} color={Palette.hermesOrange} />
                      <Text style={styles.poolAssignText}>{t('schedule.schedule', 'Inplannen')}</Text>
                    </Pressable>
                  )}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {crewMode && viewMode === 'week' ? (
        <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
          <Text style={styles.weekLabel}>{weekLabel}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.weekHeaderRow}>
                <View style={{ width: 96 }} />
                {weekdayNames.map((name, i) => (
                  <Text key={weekDayKeys[i]} style={styles.weekDayName}>{name}</Text>
                ))}
              </View>
              {activeWorkers.map((w) => {
                const load = weekLoad.get(w.id);
                const days = load?.days ?? new Set<string>();
                const sites = load?.sites ?? new Set<string>();
                return (
                  <View key={w.id} style={styles.weekRow}>
                    <View style={styles.weekWho}>
                      <Text style={styles.weekWhoName} numberOfLines={1}>{w.name}</Text>
                      <Text style={styles.weekWhoMeta} numberOfLines={1}>
                        {days.size === 0
                          ? t('schedule.weekFree')
                          : days.size === 1
                            ? t('schedule.oneDayBooked')
                            : t('schedule.daysBooked', { count: days.size })}
                      </Text>
                      {sites.size > 0 && (
                        <Text style={styles.weekWhoSites} numberOfLines={1}>
                          {sites.size === 1
                            ? (Array.from(sites)[0] as string)
                            : t('schedule.sitesToday', { count: sites.size })}
                        </Text>
                      )}
                    </View>
                    {weekDayKeys.map((key) => {
                      const dayJobs = (jobs as any[]).filter(
                        (j) => j.scheduledDate === key && j.assignedWorkerId === w.id,
                      );
                      return (
                        <View key={key} style={styles.weekCell}>
                          {dayJobs.slice(0, 2).map((j) => (
                            <View
                              key={j.id}
                              style={[styles.weekChip, { backgroundColor: (w.color ?? Palette.hermesOrange) + '22', borderLeftColor: w.color ?? Palette.hermesOrange }]}
                            >
                              <Text style={styles.weekChipText} numberOfLines={1}>
                                {j.address?.city || j.title}
                              </Text>
                            </View>
                          ))}
                          {dayJobs.length > 2 && (
                            <Text style={styles.weekMore}>+{dayJobs.length - 2}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
      <>
      {/* Crew board — one column per person, hours down the side.
          Only for contractors who actually have a crew; a solo contractor
          falls through to the single-lane timeline below, unchanged. */}
      {crewMode ? (
        <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} stickyHeaderIndices={[]}>
            <View>
              {/* Lane headers: name, booked/capacity, and how many sites that
                  person is expected at today. A day split across three sites
                  is a different day from three jobs at one address. */}
              <View style={styles.laneHeaderRow}>
                <View style={{ width: TIME_COL_WIDTH }} />
                {lanes.map((lane) => {
                  const booked = lane.jobs.reduce((sum, j) => sum + j.duration, 0);
                  const sites = new Set(lane.jobs.map((j) => j.site).filter(Boolean));
                  return (
                    <View key={lane.id ?? 'none'} style={styles.laneHeader}>
                      <View style={[styles.laneDot, { backgroundColor: lane.color }]} />
                      <Text style={styles.laneName} numberOfLines={1}>{lane.name}</Text>
                      <Text style={styles.laneMeta} numberOfLines={1}>
                        {booked > 0
                          ? t('schedule.crewUtil', {
                              booked: t('common.durationH', { defaultValue: '{{h}}h', h: booked }),
                              capacity: t('common.durationH', { defaultValue: '{{h}}h', h: WORKDAY_HOURS }),
                            })
                          : t('schedule.laneFree')}
                      </Text>
                      {sites.size > 0 && (
                        <Text style={styles.laneSites} numberOfLines={1}>
                          {sites.size === 1
                            ? (Array.from(sites)[0] as string)
                            : t('schedule.sitesToday', { count: sites.size })}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {HOURS.map((hour) => (
                <View key={hour} style={styles.hourRow}>
                  <Text style={styles.hourLabel}>{hour}:00</Text>
                  {lanes.map((lane) => (
                    <View key={`${lane.id ?? 'none'}-${hour}`} style={styles.laneSlot}>
                      {lane.jobs.filter((j) => j.startHour === hour).map((job) => (
                        <BlockPressable
                          key={job.jobId}
                          job={job}
                          laneName={lane.name}
                          crewMode={crewMode}
                          items={crewMode ? reassignItems(job) : []}
                          onShowInfo={() => showJobInfo(job)}
                          onRemove={() => handleRemoveFromSchedule(job.jobId)}
                          reassignLabel={t('schedule.reassignTo')}
                          hoursToHM={hoursToHM}
                        >
                          <Text style={[styles.blockTitle, { color: job.color }]} numberOfLines={1}>{job.title}</Text>
                          {/* The site, not just the customer: on a multi-site
                              day "where" is the question the board answers. */}
                          {job.site ? (
                            <View style={styles.blockTime}>
                              <Ionicons name="location-outline" size={11} color={SemanticColors.textTertiary} />
                              <Text style={styles.blockTimeText} numberOfLines={1}>{job.site}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.blockTimeText} numberOfLines={1}>
                            {job.startHour}:00 – {hoursToHM(job.startHour + job.duration)}
                          </Text>
                        </BlockPressable>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
      /* Timeline */
      <ScrollView style={styles.timeline} showsVerticalScrollIndicator={false}>
        <View style={styles.timeGrid}>
          {HOURS.map(hour => (
            <View key={hour} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{hour}:00</Text>
              <View style={styles.hourSlot}>
                {/* Render scheduled jobs that start at this hour */}
                {schedule.filter(j => j.startHour === hour).map(job => (
                  <Pressable
                    key={job.jobId}
                    style={[styles.scheduledBlock, {
                      backgroundColor: job.color + '15',
                      borderLeftColor: job.color,
                      height: job.duration * SLOT_HEIGHT - 4,
                    }]}
                    onLongPress={() => handleRemoveFromSchedule(job.jobId)}
                    onPress={() => Alert.alert(job.title, `${job.customerName}\n${job.startHour}:00 – ${hoursToHM(job.startHour + job.duration)}\n${t('schedule.longPressToRemove', 'Houd ingedrukt om te verwijderen')}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${job.title}, ${job.customerName}, ${job.startHour}:00 to ${hoursToHM(job.startHour + job.duration)}`}
                    accessibilityHint="Tap for details, long press to remove"
                  >
                    <View style={styles.blockHeader}>
                      <Text style={[styles.blockTitle, { color: job.color }]} numberOfLines={1}>{job.title}</Text>
                      <Text style={styles.blockDuration}>{t('common.durationH', { defaultValue: '{{h}}h', h: job.duration })}</Text>
                    </View>
                    <Text style={styles.blockCustomer} numberOfLines={1}>{job.customerName}</Text>
                    <View style={styles.blockTime}>
                      <Ionicons name="time-outline" size={12} color={SemanticColors.textTertiary} />
                      <Text style={styles.blockTimeText}>{job.startHour}:00 – {hoursToHM(job.startHour + job.duration)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
      )}
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: SafeArea.side, paddingTop: SafeArea.top, paddingBottom: Spacing.xs },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 22, fontFamily: 'Archivo_900Black', color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 2 },
  exportButton: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: Palette.hermesOrange + '10', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  exportButtonText: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: Palette.hermesOrange },

  utilBar: { marginHorizontal: SafeArea.side, marginBottom: Spacing.sm },
  utilInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  utilLabel: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: SemanticColors.textSecondary },
  utilValue: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  utilTrack: { height: 6, backgroundColor: SemanticColors.borderDefault, borderRadius: 3, overflow: 'hidden' },
  utilFill: { height: '100%', backgroundColor: Palette.hermesOrange, borderRadius: 3,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },

  poolSection: { marginBottom: Spacing.sm },
  poolTitle: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', color: SemanticColors.textSecondary, letterSpacing: 0.5, paddingHorizontal: SafeArea.side, marginBottom: 6 },
  poolContent: { paddingHorizontal: SafeArea.side, gap: 8 },
  poolCard: { width: 150, backgroundColor: SemanticColors.surfacePrimary, borderRadius: 12, padding: Spacing.sm, borderWidth: 1, borderColor: SemanticColors.borderDefault },
  // R21: queue-suggested job highlight — orange ring + tinted bg
  poolCardFocus: { borderColor: Palette.hermesOrange, borderWidth: 2, backgroundColor: Palette.hermesOrange + '14' },
  poolJobTitle: { fontSize: 13, fontFamily: 'Archivo_700Bold', color: SemanticColors.textPrimary },
  poolJobCustomer: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 2 },
  poolJobHours: { fontSize: 12, fontFamily: 'Archivo_800ExtraBold', color: Palette.hermesOrange, marginTop: 4 },
  poolAssignBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 6, backgroundColor: Palette.hermesOrange + '10', borderRadius: 8, paddingVertical: 6 },
  poolAssignText: { fontSize: 12, fontFamily: 'Archivo_700Bold', color: Palette.hermesOrange },

  timeline: { flex: 1, paddingHorizontal: SafeArea.side },
  timeGrid: {},
  hourRow: { flexDirection: 'row', height: SLOT_HEIGHT, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  hourLabel: { width: TIME_COL_WIDTH, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: SemanticColors.textTertiary, paddingTop: 4 },
  hourSlot: { flex: 1, position: 'relative' },

  scheduledBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 2,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 8,
    zIndex: 1,
  },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockTitle: { fontSize: 13, fontFamily: 'Archivo_800ExtraBold', flex: 1 },
  blockDuration: { fontSize: 11, fontFamily: 'Archivo_700Bold', color: SemanticColors.textTertiary },
  blockCustomer: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 2 },
  blockTime: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  poolSiteRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewToggle: {
    flexDirection: 'row', gap: 6, marginHorizontal: Spacing.lg, marginBottom: 8,
    backgroundColor: SemanticColors.surfaceSecondary, borderRadius: 10, padding: 3,
  },
  viewToggleBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  viewToggleBtnActive: { backgroundColor: SemanticColors.surfacePrimary },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: SemanticColors.textSecondary },
  viewToggleTextActive: { color: SemanticColors.textPrimary },
  gapCard: {
    marginHorizontal: Spacing.lg, marginBottom: 10, padding: 12,
    borderRadius: 12, borderLeftWidth: 3, borderLeftColor: Palette.orange500,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  gapHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  gapTitle: { fontSize: 13, fontWeight: '700', color: SemanticColors.textPrimary },
  gapLine: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  // The list is capped at 4. Saying how many were dropped beats a silent
  // truncation that reads as "that is all of them".
  gapMore: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 4 },
  weekLabel: {
    fontSize: 13, fontWeight: '600', color: SemanticColors.textSecondary,
    marginHorizontal: Spacing.lg, marginBottom: 8,
  },
  weekHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  weekDayName: {
    width: 56, textAlign: 'center', fontSize: 11,
    color: SemanticColors.textTertiary, textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row', alignItems: 'stretch', minHeight: 56,
    borderTopWidth: 1, borderTopColor: SemanticColors.borderMuted,
  },
  weekWho: { width: 96, paddingVertical: 8, paddingRight: 6 },
  weekWhoName: { fontSize: 13, fontWeight: '700', color: SemanticColors.textPrimary },
  weekWhoMeta: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 1 },
  weekWhoSites: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  weekCell: {
    width: 56, paddingVertical: 6, paddingHorizontal: 2, gap: 3,
    borderLeftWidth: 1, borderLeftColor: SemanticColors.borderMuted,
  },
  weekChip: { borderLeftWidth: 2, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2 },
  weekChipText: { fontSize: 9, color: SemanticColors.textPrimary },
  weekMore: { fontSize: 9, color: SemanticColors.textTertiary, textAlign: 'center' },
  laneHeaderRow: { flexDirection: 'row', paddingBottom: 6 },
  laneHeader: {
    width: LANE_WIDTH, paddingHorizontal: 8, paddingVertical: 6,
    borderLeftWidth: 1, borderLeftColor: SemanticColors.borderDefault,
  },
  laneDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  laneName: { fontSize: 13, fontWeight: '700', color: SemanticColors.textPrimary },
  laneMeta: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 1 },
  laneSites: { fontSize: 11, color: SemanticColors.textTertiary, marginTop: 1 },
  laneSlot: {
    width: LANE_WIDTH, height: SLOT_HEIGHT,
    borderLeftWidth: 1, borderLeftColor: SemanticColors.borderDefault,
    borderTopWidth: 1, borderTopColor: SemanticColors.borderMuted,
    paddingHorizontal: 4,
  },
  laneBlock: {
    borderLeftWidth: 3, borderRadius: 8, padding: 6,
    overflow: 'hidden',
  },
  blockTimeText: { fontSize: 11, color: SemanticColors.textTertiary },
});
