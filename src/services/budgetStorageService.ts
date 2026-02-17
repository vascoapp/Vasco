/**
 * Budget Storage Service — AsyncStorage persistence for budget workbooks.
 * Follows learningStorage.ts patterns: role-aware keys, schema versioning,
 * LRU trimming (max 3 workbooks), debounced saves.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BudgetExtractionResult } from '../ingestion/budgetExtractor';
import type { EnrichedBudgetLine } from './budgetEnrichmentService';
import type { ScenarioResult, OptimizationScenario, OptimizationConstraints } from './budgetOptimizerService';

// ── Types ──────────────────────────────────────────────────

export interface BudgetWorkbook {
  id: string;
  extractionResult: BudgetExtractionResult;
  enrichedLines: EnrichedBudgetLine[];
  scenarios: ScenarioResult[];
  selectedScenario: OptimizationScenario;
  approvals: Record<string, boolean>; // costCode -> approved (JSON-safe)
  constraints: OptimizationConstraints;
  savedAt: string; // ISO
}

export interface BudgetStorage {
  schemaVersion: number;
  workbooks: BudgetWorkbook[];
  currentWorkbookId: string | null;
  lastUpdated: string;
}

// ── Constants ──────────────────────────────────────────────

const STORAGE_KEY_PREFIX = '@vasco_budget';
const CURRENT_SCHEMA_VERSION = 1;
const MAX_WORKBOOKS = 3;
const DEBOUNCE_MS = 2000;

// ── Storage key ────────────────────────────────────────────

function getStorageKey(role: string): string {
  return `${STORAGE_KEY_PREFIX}_${role}`;
}

// ── Default ────────────────────────────────────────────────

function createDefaultStorage(): BudgetStorage {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workbooks: [],
    currentWorkbookId: null,
    lastUpdated: new Date().toISOString(),
  };
}

// ── Migration ──────────────────────────────────────────────

function migrateStorage(raw: Record<string, unknown>): BudgetStorage {
  // v1 is the initial version — no migrations yet
  const version = (raw.schemaVersion as number) || 0;
  if (version < 1) {
    raw.schemaVersion = 1;
    if (!raw.workbooks) raw.workbooks = [];
    if (!raw.currentWorkbookId) raw.currentWorkbookId = null;
    if (!raw.lastUpdated) raw.lastUpdated = new Date().toISOString();
  }
  return raw as unknown as BudgetStorage;
}

// ── Persistence ────────────────────────────────────────────

export async function loadBudgetStorage(role: string = 'contractor'): Promise<BudgetStorage> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(role));
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const storage = migrateStorage(parsed);
      return storage;
    }
  } catch {
    // Corrupted — start fresh
  }
  return createDefaultStorage();
}

export async function saveBudgetStorage(
  storage: BudgetStorage,
  role: string = 'contractor',
): Promise<void> {
  try {
    storage.lastUpdated = new Date().toISOString();
    await AsyncStorage.setItem(getStorageKey(role), JSON.stringify(storage));
  } catch {
    // Silent fail — non-critical
  }
}

// ── Debounced save ─────────────────────────────────────────

let pendingSave: ReturnType<typeof setTimeout> | null = null;
let cachedStorage: BudgetStorage | null = null;
let cachedRole: string = 'contractor';

function debouncedSave(storage: BudgetStorage, role: string): void {
  cachedStorage = storage;
  cachedRole = role;
  if (pendingSave) clearTimeout(pendingSave);
  pendingSave = setTimeout(() => {
    saveBudgetStorage(storage, role);
    pendingSave = null;
  }, DEBOUNCE_MS);
}

// ── CRUD ───────────────────────────────────────────────────

export async function saveWorkbook(
  workbook: BudgetWorkbook,
  role: string = 'contractor',
): Promise<void> {
  const storage = await loadBudgetStorage(role);

  // Replace existing or add new
  const existingIdx = storage.workbooks.findIndex((w) => w.id === workbook.id);
  if (existingIdx >= 0) {
    storage.workbooks[existingIdx] = workbook;
  } else {
    storage.workbooks.push(workbook);
  }

  // LRU trim: keep only the most recent MAX_WORKBOOKS
  if (storage.workbooks.length > MAX_WORKBOOKS) {
    storage.workbooks.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );
    storage.workbooks = storage.workbooks.slice(0, MAX_WORKBOOKS);
  }

  storage.currentWorkbookId = workbook.id;
  debouncedSave(storage, role);
}

export async function updateWorkbook(
  workbookId: string,
  updates: Partial<BudgetWorkbook>,
  role: string = 'contractor',
): Promise<void> {
  const storage = await loadBudgetStorage(role);
  const idx = storage.workbooks.findIndex((w) => w.id === workbookId);
  if (idx < 0) return;

  storage.workbooks[idx] = {
    ...storage.workbooks[idx],
    ...updates,
    savedAt: new Date().toISOString(),
  };

  debouncedSave(storage, role);
}

export async function getCurrentWorkbook(
  role: string = 'contractor',
): Promise<BudgetWorkbook | null> {
  const storage = await loadBudgetStorage(role);
  if (!storage.currentWorkbookId) return null;

  const workbook = storage.workbooks.find((w) => w.id === storage.currentWorkbookId);
  return workbook ?? null;
}

export async function deleteWorkbook(
  workbookId: string,
  role: string = 'contractor',
): Promise<void> {
  const storage = await loadBudgetStorage(role);
  storage.workbooks = storage.workbooks.filter((w) => w.id !== workbookId);

  if (storage.currentWorkbookId === workbookId) {
    storage.currentWorkbookId =
      storage.workbooks.length > 0 ? storage.workbooks[0].id : null;
  }

  debouncedSave(storage, role);
}

export async function listWorkbooks(
  role: string = 'contractor',
): Promise<Array<{ id: string; projectName: string; totalBudget: number; savedAt: string }>> {
  const storage = await loadBudgetStorage(role);
  return storage.workbooks
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .map((w) => ({
      id: w.id,
      projectName: w.extractionResult.projectName,
      totalBudget: w.extractionResult.totalBudget,
      savedAt: w.savedAt,
    }));
}

// ── Serialization helpers ──────────────────────────────────

export function approvalsToRecord(map: Map<string, boolean>): Record<string, boolean> {
  const record: Record<string, boolean> = {};
  for (const [k, v] of map) {
    record[k] = v;
  }
  return record;
}

export function recordToApprovals(record: Record<string, boolean>): Map<string, boolean> {
  return new Map(Object.entries(record));
}
