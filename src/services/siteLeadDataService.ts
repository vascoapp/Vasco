// =============================================================================
// SITE LEAD DATA SERVICE — Shared state for defects, reports, inspections
// =============================================================================
// Persists to AsyncStorage. Provides hooks for reactive UI updates.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { DEMO_MODE } from '../config/demo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordMetricSnapshot } from '../intelligence/learningStorage';

// ============================================
// TYPES
// ============================================

export type DefectSeverity = 'hoog' | 'middel' | 'laag';
export type DefectType = 'gebrek' | 'garantie';

export interface Defect {
  id: string;
  type: DefectType;
  title: string;
  location: string;
  description: string;
  severity: DefectSeverity;
  trade: string;
  date: string;
  status: 'open' | 'closed';
  photos: string[];
  guaranteeRef?: string;
  guaranteeExpiry?: string;
  closedAt?: string;
  // R247: scope to a specific aannemer project when the contractor is
  // running the site-lead view from a project context.
  projectId?: string;
}

export interface DailyReport {
  id: string;
  date: string;
  weather: string;
  temperature: string;
  workersPresent: number;
  workersPlanned: number;
  progressEntries: { zone: string; task: string; percent: number; notes: string }[];
  safetyIncidents: number;
  nearMisses: number;
  safetyNotes: string;
  deliveries: string;
  issues: string;
  generalNotes: string;
  photoCount: number;
  submittedAt: string;
  projectId?: string;
}

export interface InspectionRecord {
  id: string;
  date: string;
  location: string;
  checkedItems: string[];
  totalItems: number;
  notes: string;
  completedAt: string;
  projectId?: string;
}

export interface IncidentRecord {
  id: string;
  type: 'incident' | 'near-miss' | 'observation';
  date: string;
  location: string;
  description: string;
  severity: string;
  peopleInvolved: string;
  photoCount: number;
  submittedAt: string;
  projectId?: string;
}

// ============================================
// STORAGE KEYS
// ============================================

const KEYS = {
  defects: '@vasco_sl_defects',
  reports: '@vasco_sl_reports',
  inspections: '@vasco_sl_inspections',
  incidents: '@vasco_sl_incidents',
};

// ============================================
// SEED DATA
// ============================================

const DEMO_SEED_DEFECTS: Defect[] = [
  { id: 'd1', type: 'gebrek', title: 'Lekkage CV-leiding', location: 'Blok B - Verdieping 1', description: 'Druppellekkage bij koppeling CV-leiding badkamer unit 12', severity: 'hoog', trade: 'Loodgieter', date: '2026-03-18', status: 'open', photos: [] },
  { id: 'd2', type: 'gebrek', title: 'Scheef kozijn woonkamer', location: 'Blok A - Begane grond', description: 'Kozijn 2mm uit lood, sluit niet goed', severity: 'middel', trade: 'Timmerman', date: '2026-03-17', status: 'open', photos: [] },
  { id: 'd3', type: 'gebrek', title: 'Verfblaren plafond', location: 'Blok C - Verdieping 3', description: 'Blaarvorming latex plafond na vochtproblemen', severity: 'laag', trade: 'Schilder', date: '2026-03-16', status: 'open', photos: [] },
  { id: 'd4', type: 'garantie', title: 'Defecte thermostaat', location: 'Blok A - Verdieping 2', description: 'Honeywell thermostaat reageert niet meer', severity: 'middel', trade: 'Elektricien', date: '2026-03-15', status: 'open', photos: [], guaranteeRef: 'GAR-2025-0041', guaranteeExpiry: '2027-03-15' },
  { id: 'd5', type: 'gebrek', title: 'Tegels loszittend', location: 'Blok B - Verdieping 1', description: 'Twee vloertegels badkamer zitten los', severity: 'hoog', trade: 'Metselaar', date: '2026-03-14', status: 'open', photos: [] },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const SEED_DEFECTS: Defect[] = DEMO_MODE ? DEMO_SEED_DEFECTS : [];

// ============================================
// SERVICE CLASS
// ============================================

type Listener = () => void;

class SiteLeadDataService {
  private defects: Defect[] = [];
  private reports: DailyReport[] = [];
  private inspections: InspectionRecord[] = [];
  private incidents: IncidentRecord[] = [];
  private listeners: Set<Listener> = new Set();
  private loaded = false;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  async load() {
    if (this.loaded) return;
    try {
      const [defectsJson, reportsJson, inspectionsJson, incidentsJson] = await Promise.all([
        AsyncStorage.getItem(KEYS.defects),
        AsyncStorage.getItem(KEYS.reports),
        AsyncStorage.getItem(KEYS.inspections),
        AsyncStorage.getItem(KEYS.incidents),
      ]);
      this.defects = defectsJson ? JSON.parse(defectsJson) : SEED_DEFECTS;
      this.reports = reportsJson ? JSON.parse(reportsJson) : [];
      this.inspections = inspectionsJson ? JSON.parse(inspectionsJson) : [];
      this.incidents = incidentsJson ? JSON.parse(incidentsJson) : [];
      this.loaded = true;
    } catch {
      this.defects = SEED_DEFECTS;
      this.loaded = true;
    }
  }

  private async save(key: string, data: any) {
    try { await AsyncStorage.setItem(key, JSON.stringify(data)); } catch {}
  }

  // ---- DEFECTS ----

  getDefects(status?: 'open' | 'closed'): Defect[] {
    if (status) return this.defects.filter(d => d.status === status);
    return this.defects;
  }

  addDefect(defect: Omit<Defect, 'id' | 'date' | 'status'>): Defect {
    const newDefect: Defect = {
      ...defect,
      id: `d-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      status: 'open',
    };
    this.defects = [newDefect, ...this.defects];
    this.save(KEYS.defects, this.defects);
    this.notify();
    return newDefect;
  }

  closeDefect(id: string) {
    this.defects = this.defects.map(d =>
      d.id === id ? { ...d, status: 'closed' as const, closedAt: new Date().toISOString() } : d
    );
    this.save(KEYS.defects, this.defects);
    this.notify();
    // Record metric for AI calibration
    const openCount = this.defects.filter(d => d.status === 'open').length;
    recordMetricSnapshot('defectCount', openCount).catch(() => {});
  }

  // ---- DAILY REPORTS ----

  getReports(): DailyReport[] { return this.reports; }

  addReport(report: Omit<DailyReport, 'id' | 'submittedAt'>): DailyReport {
    const newReport: DailyReport = {
      ...report,
      id: `rpt-${Date.now()}`,
      submittedAt: new Date().toISOString(),
    };
    this.reports = [newReport, ...this.reports];
    this.save(KEYS.reports, this.reports);
    this.notify();
    // Record workforce utilization for AI calibration
    if (report.workersPlanned > 0) {
      const utilization = Math.round((report.workersPresent / report.workersPlanned) * 100);
      recordMetricSnapshot('workforceUtilization', utilization).catch(() => {});
    }
    if (report.safetyIncidents > 0 || report.nearMisses > 0) {
      recordMetricSnapshot('incidentRate', report.safetyIncidents + report.nearMisses).catch(() => {});
    }
    return newReport;
  }

  // ---- INSPECTIONS ----

  getInspections(): InspectionRecord[] { return this.inspections; }

  addInspection(record: Omit<InspectionRecord, 'id' | 'completedAt'>): InspectionRecord {
    const newRecord: InspectionRecord = {
      ...record,
      id: `insp-${Date.now()}`,
      completedAt: new Date().toISOString(),
    };
    this.inspections = [newRecord, ...this.inspections];
    this.save(KEYS.inspections, this.inspections);
    this.notify();
    // Record inspection score for AI calibration
    if (record.totalItems > 0) {
      const score = Math.round((record.checkedItems.length / record.totalItems) * 100);
      recordMetricSnapshot('inspectionScore', score).catch(() => {});
    }
    return newRecord;
  }

  // ---- INCIDENTS ----

  getIncidents(): IncidentRecord[] { return this.incidents; }

  addIncident(record: Omit<IncidentRecord, 'id' | 'submittedAt'>): IncidentRecord {
    const newRecord: IncidentRecord = {
      ...record,
      id: `inc-${Date.now()}`,
      submittedAt: new Date().toISOString(),
    };
    this.incidents = [newRecord, ...this.incidents];
    this.save(KEYS.incidents, this.incidents);
    this.notify();
    // Record incident for AI calibration
    recordMetricSnapshot('incidentRate', this.incidents.length).catch(() => {});
    return newRecord;
  }
}

export const siteLeadDataService = new SiteLeadDataService();

// ============================================
// HOOKS
// ============================================

// R247: optional projectId scopes results to a specific aannemer project.
// When omitted, returns all rows (legacy behavior).
export function useDefects(status?: 'open' | 'closed', projectId?: string) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      const all = siteLeadDataService.getDefects(status);
      setDefects(projectId ? all.filter((d) => d.projectId === projectId) : all);
    };
    siteLeadDataService.load().then(() => { refresh(); setLoading(false); });
    return siteLeadDataService.subscribe(refresh);
  }, [status, projectId]);

  const addDefect = useCallback((defect: Omit<Defect, 'id' | 'date' | 'status'>) =>
    siteLeadDataService.addDefect({ ...defect, projectId: defect.projectId ?? projectId }), [projectId]);

  const closeDefect = useCallback((id: string) =>
    siteLeadDataService.closeDefect(id), []);

  return { defects, loading, addDefect, closeDefect };
}

export function useDailyReports(projectId?: string) {
  const [reports, setReports] = useState<DailyReport[]>([]);

  useEffect(() => {
    const refresh = () => {
      const all = siteLeadDataService.getReports();
      setReports(projectId ? all.filter((r) => r.projectId === projectId) : all);
    };
    siteLeadDataService.load().then(refresh);
    return siteLeadDataService.subscribe(refresh);
  }, [projectId]);

  const addReport = useCallback((report: Omit<DailyReport, 'id' | 'submittedAt'>) =>
    siteLeadDataService.addReport({ ...report, projectId: report.projectId ?? projectId }), [projectId]);

  return { reports, addReport };
}

export function useInspections(projectId?: string) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);

  useEffect(() => {
    const refresh = () => {
      const all = siteLeadDataService.getInspections();
      setInspections(projectId ? all.filter((r) => r.projectId === projectId) : all);
    };
    siteLeadDataService.load().then(refresh);
    return siteLeadDataService.subscribe(refresh);
  }, [projectId]);

  const addInspection = useCallback((record: Omit<InspectionRecord, 'id' | 'completedAt'>) =>
    siteLeadDataService.addInspection({ ...record, projectId: record.projectId ?? projectId }), [projectId]);

  return { inspections, addInspection };
}

export function useIncidents(projectId?: string) {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);

  useEffect(() => {
    const refresh = () => {
      const all = siteLeadDataService.getIncidents();
      setIncidents(projectId ? all.filter((r) => r.projectId === projectId) : all);
    };
    siteLeadDataService.load().then(refresh);
    return siteLeadDataService.subscribe(refresh);
  }, [projectId]);

  const addIncident = useCallback((record: Omit<IncidentRecord, 'id' | 'submittedAt'>) =>
    siteLeadDataService.addIncident({ ...record, projectId: record.projectId ?? projectId }), [projectId]);

  return { incidents, addIncident };
}
