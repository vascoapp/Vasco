// =============================================================================
// RESOURCE HEATMAP SERVICE — DEPRECATED — DO NOT EXTEND (R19 audit)
// =============================================================================
// Status as of R19: 278 LoC of mock heatmap / zone-budget / schedule-block
// data, plus three rendering primitives in src/components/shared/:
//   - UtilizationHeatmapGrid.tsx (232 LoC)
//   - ScheduleBlockBoard.tsx     (395 LoC)
//   - BurnRateBar.tsx            (195 LoC)
//
// All three components are exported from `src/components/shared/index.ts`
// but have **zero mount sites** anywhere in app/ or src/components/. The
// header above claims "for the Site Lead dashboard" but SiteLeadDashboard
// has never imported them.
//
// Service uses pure mock data (hardcoded WorkerHeatmapRow grid, zone budgets,
// schedule blocks). No Supabase fetch. No persistence. No write-back when
// blocks are dragged/reassigned via `onReassign`.
//
// Aligned with R180 enterprise-dashboard skip + R299 team-tools deprecation —
// the multi-employee orchestration UX hasn't been validated.
//
// To make this real:
//  1. New BE tables: `worker_utilization_snapshots`,
//     `zone_budget_actuals`, `schedule_blocks` per project
//  2. RPCs to roll up clock-in / time-tracking / job-cost actuals
//  3. Mount the components on SiteLeadDashboard or a new
//     /(tabs)/capacity route
//  4. Wire `onReassign` and `onCellPress` to AppState mutations
//
// Until then: do not import. Same pattern as R288/R295/R296/R299/R18.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface HeatmapCell {
  hour: number; // 7–17
  utilization: number; // 0–100
  jobId?: string;
  jobTitle?: string;
  status: 'idle' | 'active' | 'travel' | 'break' | 'overtime';
}

export interface WorkerHeatmapRow {
  workerId: string;
  workerName: string;
  initials: string;
  trade: string;
  cells: HeatmapCell[];
  avgUtilization: number;
}

export interface HeatmapData {
  rows: WorkerHeatmapRow[];
  hourLabels: string[];
  overallUtilization: number;
  peakHour: number;
  understaffedHours: number[];
}

export interface ZoneBudget {
  zoneId: string;
  zoneName: string;
  budgetTotal: number;
  budgetSpent: number;
  budgetPercent: number;
  hoursPlanned: number;
  hoursUsed: number;
  status: 'on-track' | 'at-risk' | 'critical';
}

export interface BurnTrackingData {
  zones: ZoneBudget[];
  totalBudget: number;
  totalSpent: number;
  overallPercent: number;
  projectedOverrun: number;
}

export interface ScheduleBlock {
  id: string;
  jobTitle: string;
  jobId: string;
  assignedTo: string;
  assignedName: string;
  startHour: number;
  durationHours: number;
  zone: string;
  trade: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'unassigned';
  priority: 'urgent' | 'high' | 'normal' | 'low';
}

// =============================================================================
// MOCK DATA
// =============================================================================

const HOUR_LABELS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const WORKER_HEATMAP_DATA: WorkerHeatmapRow[] = [
  {
    workerId: 'w1',
    workerName: 'Mohammed Al-Rashid',
    initials: 'MA',
    trade: 'Elektricien',
    cells: [
      { hour: 7, utilization: 80, jobId: 'j1', jobTitle: 'Groepenkast vervangen', status: 'active' },
      { hour: 8, utilization: 95, jobId: 'j1', jobTitle: 'Groepenkast vervangen', status: 'active' },
      { hour: 9, utilization: 90, jobId: 'j1', jobTitle: 'Groepenkast vervangen', status: 'active' },
      { hour: 10, utilization: 30, status: 'travel' },
      { hour: 11, utilization: 85, jobId: 'j2', jobTitle: 'Zonnepanelen aansluiten', status: 'active' },
      { hour: 12, utilization: 0, status: 'break' },
      { hour: 13, utilization: 90, jobId: 'j2', jobTitle: 'Zonnepanelen aansluiten', status: 'active' },
      { hour: 14, utilization: 85, jobId: 'j3', jobTitle: 'Stopcontacten plaatsen', status: 'active' },
      { hour: 15, utilization: 75, jobId: 'j3', jobTitle: 'Stopcontacten plaatsen', status: 'active' },
      { hour: 16, utilization: 40, status: 'idle' },
      { hour: 17, utilization: 0, status: 'idle' },
    ],
    avgUtilization: 61,
  },
  {
    workerId: 'w2',
    workerName: 'Pieter de Groot',
    initials: 'PG',
    trade: 'Loodgieter',
    cells: [
      { hour: 7, utilization: 70, jobId: 'j4', jobTitle: 'CV-ketel onderhoud', status: 'active' },
      { hour: 8, utilization: 85, jobId: 'j4', jobTitle: 'CV-ketel onderhoud', status: 'active' },
      { hour: 9, utilization: 90, jobId: 'j4', jobTitle: 'CV-ketel onderhoud', status: 'active' },
      { hour: 10, utilization: 95, jobId: 'j5', jobTitle: 'Lekkage reparatie', status: 'active' },
      { hour: 11, utilization: 80, jobId: 'j5', jobTitle: 'Lekkage reparatie', status: 'active' },
      { hour: 12, utilization: 0, status: 'break' },
      { hour: 13, utilization: 60, status: 'travel' },
      { hour: 14, utilization: 85, jobId: 'j6', jobTitle: 'Badkamer sanitair', status: 'active' },
      { hour: 15, utilization: 90, jobId: 'j6', jobTitle: 'Badkamer sanitair', status: 'active' },
      { hour: 16, utilization: 70, jobId: 'j6', jobTitle: 'Badkamer sanitair', status: 'active' },
      { hour: 17, utilization: 0, status: 'idle' },
    ],
    avgUtilization: 66,
  },
  {
    workerId: 'w3',
    workerName: 'Erik Jansen',
    initials: 'EJ',
    trade: 'Timmerman',
    cells: [
      { hour: 7, utilization: 0, status: 'idle' },
      { hour: 8, utilization: 50, status: 'travel' },
      { hour: 9, utilization: 85, jobId: 'j7', jobTitle: 'Kozijnen plaatsen', status: 'active' },
      { hour: 10, utilization: 95, jobId: 'j7', jobTitle: 'Kozijnen plaatsen', status: 'active' },
      { hour: 11, utilization: 90, jobId: 'j7', jobTitle: 'Kozijnen plaatsen', status: 'active' },
      { hour: 12, utilization: 0, status: 'break' },
      { hour: 13, utilization: 80, jobId: 'j7', jobTitle: 'Kozijnen plaatsen', status: 'active' },
      { hour: 14, utilization: 0, status: 'idle' },
      { hour: 15, utilization: 0, status: 'idle' },
      { hour: 16, utilization: 0, status: 'idle' },
      { hour: 17, utilization: 0, status: 'idle' },
    ],
    avgUtilization: 36,
  },
  {
    workerId: 'w4',
    workerName: 'Lisa Bakker',
    initials: 'LB',
    trade: 'Schilder',
    cells: [
      { hour: 7, utilization: 60, jobId: 'j8', jobTitle: 'Buitenschilderwerk', status: 'active' },
      { hour: 8, utilization: 85, jobId: 'j8', jobTitle: 'Buitenschilderwerk', status: 'active' },
      { hour: 9, utilization: 90, jobId: 'j8', jobTitle: 'Buitenschilderwerk', status: 'active' },
      { hour: 10, utilization: 85, jobId: 'j8', jobTitle: 'Buitenschilderwerk', status: 'active' },
      { hour: 11, utilization: 80, jobId: 'j8', jobTitle: 'Buitenschilderwerk', status: 'active' },
      { hour: 12, utilization: 0, status: 'break' },
      { hour: 13, utilization: 75, jobId: 'j9', jobTitle: 'Binnenschilderwerk trap', status: 'active' },
      { hour: 14, utilization: 80, jobId: 'j9', jobTitle: 'Binnenschilderwerk trap', status: 'active' },
      { hour: 15, utilization: 85, jobId: 'j9', jobTitle: 'Binnenschilderwerk trap', status: 'active' },
      { hour: 16, utilization: 70, jobId: 'j9', jobTitle: 'Binnenschilderwerk trap', status: 'active' },
      { hour: 17, utilization: 0, status: 'idle' },
    ],
    avgUtilization: 65,
  },
  {
    workerId: 'w5',
    workerName: 'Jan van Dijk',
    initials: 'JD',
    trade: 'Metselaar',
    cells: [
      { hour: 7, utilization: 90, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 8, utilization: 95, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 9, utilization: 95, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 10, utilization: 90, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 11, utilization: 85, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 12, utilization: 0, status: 'break' },
      { hour: 13, utilization: 90, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 14, utilization: 95, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 15, utilization: 85, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'active' },
      { hour: 16, utilization: 100, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'overtime' },
      { hour: 17, utilization: 60, jobId: 'j10', jobTitle: 'Gevel metselwerk', status: 'overtime' },
    ],
    avgUtilization: 80,
  },
  {
    workerId: 'w6',
    workerName: 'Sophie Visser',
    initials: 'SV',
    trade: 'Installateur',
    cells: [
      { hour: 7, utilization: 40, status: 'travel' },
      { hour: 8, utilization: 80, jobId: 'j11', jobTitle: 'Airco installatie', status: 'active' },
      { hour: 9, utilization: 90, jobId: 'j11', jobTitle: 'Airco installatie', status: 'active' },
      { hour: 10, utilization: 85, jobId: 'j11', jobTitle: 'Airco installatie', status: 'active' },
      { hour: 11, utilization: 90, jobId: 'j11', jobTitle: 'Airco installatie', status: 'active' },
      { hour: 12, utilization: 0, status: 'break' },
      { hour: 13, utilization: 70, status: 'travel' },
      { hour: 14, utilization: 80, jobId: 'j12', jobTitle: 'Warmtepomp check', status: 'active' },
      { hour: 15, utilization: 75, jobId: 'j12', jobTitle: 'Warmtepomp check', status: 'active' },
      { hour: 16, utilization: 0, status: 'idle' },
      { hour: 17, utilization: 0, status: 'idle' },
    ],
    avgUtilization: 55,
  },
];

const MOCK_ZONE_BUDGETS: ZoneBudget[] = [
  { zoneId: 'z1', zoneName: 'Begane Grond', budgetTotal: 12000, budgetSpent: 8400, budgetPercent: 70, hoursPlanned: 120, hoursUsed: 84, status: 'on-track' },
  { zoneId: 'z2', zoneName: 'Verdieping 1', budgetTotal: 9500, budgetSpent: 8550, budgetPercent: 90, hoursPlanned: 95, hoursUsed: 85, status: 'at-risk' },
  { zoneId: 'z3', zoneName: 'Kelder', budgetTotal: 6000, budgetSpent: 6600, budgetPercent: 110, hoursPlanned: 60, hoursUsed: 66, status: 'critical' },
  { zoneId: 'z4', zoneName: 'Dak', budgetTotal: 8000, budgetSpent: 4800, budgetPercent: 60, hoursPlanned: 80, hoursUsed: 48, status: 'on-track' },
];

const MOCK_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { id: 'sb1', jobTitle: 'Groepenkast vervangen', jobId: 'j1', assignedTo: 'w1', assignedName: 'Mohammed', startHour: 7, durationHours: 3, zone: 'Begane Grond', trade: 'Elektricien', status: 'completed', priority: 'high' },
  { id: 'sb2', jobTitle: 'Zonnepanelen aansluiten', jobId: 'j2', assignedTo: 'w1', assignedName: 'Mohammed', startHour: 11, durationHours: 2, zone: 'Dak', trade: 'Elektricien', status: 'in-progress', priority: 'normal' },
  { id: 'sb3', jobTitle: 'CV-ketel onderhoud', jobId: 'j4', assignedTo: 'w2', assignedName: 'Pieter', startHour: 7, durationHours: 3, zone: 'Kelder', trade: 'Loodgieter', status: 'completed', priority: 'normal' },
  { id: 'sb4', jobTitle: 'Lekkage reparatie', jobId: 'j5', assignedTo: 'w2', assignedName: 'Pieter', startHour: 10, durationHours: 2, zone: 'Verdieping 1', trade: 'Loodgieter', status: 'in-progress', priority: 'urgent' },
  { id: 'sb5', jobTitle: 'Kozijnen plaatsen', jobId: 'j7', assignedTo: 'w3', assignedName: 'Erik', startHour: 9, durationHours: 5, zone: 'Begane Grond', trade: 'Timmerman', status: 'in-progress', priority: 'normal' },
  { id: 'sb6', jobTitle: 'Buitenschilderwerk', jobId: 'j8', assignedTo: 'w4', assignedName: 'Lisa', startHour: 7, durationHours: 5, zone: 'Dak', trade: 'Schilder', status: 'in-progress', priority: 'low' },
  { id: 'sb7', jobTitle: 'Gevel metselwerk', jobId: 'j10', assignedTo: 'w5', assignedName: 'Jan', startHour: 7, durationHours: 10, zone: 'Begane Grond', trade: 'Metselaar', status: 'in-progress', priority: 'high' },
  { id: 'sb8', jobTitle: 'Airco installatie', jobId: 'j11', assignedTo: 'w6', assignedName: 'Sophie', startHour: 8, durationHours: 4, zone: 'Verdieping 1', trade: 'Installateur', status: 'completed', priority: 'normal' },
  { id: 'sb9', jobTitle: 'Dakgoot reparatie', jobId: 'j13', assignedTo: '', assignedName: '', startHour: 14, durationHours: 2, zone: 'Dak', trade: 'Loodgieter', status: 'unassigned', priority: 'high' },
  { id: 'sb10', jobTitle: 'Elektra keuring', jobId: 'j14', assignedTo: '', assignedName: '', startHour: 15, durationHours: 2, zone: 'Kelder', trade: 'Elektricien', status: 'unassigned', priority: 'urgent' },
];

// =============================================================================
// HOOKS
// =============================================================================

export function useHeatmapData(_date?: Date): HeatmapData {
  return useMemo(() => {
    const rows = WORKER_HEATMAP_DATA;
    const overallUtilization = Math.round(
      rows.reduce((sum, r) => sum + r.avgUtilization, 0) / rows.length
    );

    // Find peak hour
    const hourTotals: number[] = [];
    for (let h = 0; h < 11; h++) {
      const total = rows.reduce((sum, r) => sum + r.cells[h].utilization, 0);
      hourTotals.push(total);
    }
    const peakHour = 7 + hourTotals.indexOf(Math.max(...hourTotals));

    // Understaffed hours: where average utilization > 85%
    const understaffedHours = hourTotals
      .map((total, i) => ({ hour: 7 + i, avg: total / rows.length }))
      .filter(h => h.avg > 85)
      .map(h => h.hour);

    return {
      rows,
      hourLabels: HOUR_LABELS,
      overallUtilization,
      peakHour,
      understaffedHours,
    };
  }, [_date]);
}

export function useBurnTracking(): BurnTrackingData {
  return useMemo(() => {
    const zones = MOCK_ZONE_BUDGETS;
    const totalBudget = zones.reduce((s, z) => s + z.budgetTotal, 0);
    const totalSpent = zones.reduce((s, z) => s + z.budgetSpent, 0);
    return {
      zones,
      totalBudget,
      totalSpent,
      overallPercent: Math.round((totalSpent / totalBudget) * 100),
      projectedOverrun: totalSpent > totalBudget * 0.8 ? Math.round(totalSpent * 1.1 - totalBudget) : 0,
    };
  }, []);
}

export function useScheduleBlocks(_date?: Date): { blocks: ScheduleBlock[]; unassigned: ScheduleBlock[]; workers: { id: string; name: string; trade: string }[] } {
  return useMemo(() => {
    const assigned = MOCK_SCHEDULE_BLOCKS.filter(b => b.status !== 'unassigned');
    const unassigned = MOCK_SCHEDULE_BLOCKS.filter(b => b.status === 'unassigned');
    const workers = WORKER_HEATMAP_DATA.map(w => ({ id: w.workerId, name: w.workerName, trade: w.trade }));
    return { blocks: assigned, unassigned, workers };
  }, [_date]);
}
