// =============================================================================
// RECURRING JOBS SERVICE (R246)
// =============================================================================
// Stores recurring-job templates locally (AsyncStorage) and computes the
// next-due dates so the UI can show "5 maintenance jobs due this month."
//
// Workflow pack `onderhoud_herinnering` already exists; this service is
// the data backing for the surface UI that lets the contractor see and
// manage their recurring schedule explicitly.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_recurring_jobs';

export type RecurrenceCadence =
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom';

export interface RecurringJobTemplate {
  id: string;
  customerId: string;
  customerName?: string;
  title: string;
  description?: string;
  trade?: string;
  estimatedDurationHours?: number;
  estimatedAmount?: number;
  cadence: RecurrenceCadence;
  customIntervalDays?: number;          // when cadence === 'custom'
  startDate: string;                     // ISO date
  lastRunDate?: string;                   // ISO date
  paused: boolean;
  reminderDaysBeforeDue: number;          // default 7
  createdAt: string;
  updatedAt: string;
}

export interface RecurringJobInstance {
  template: RecurringJobTemplate;
  nextDueDate: string;
  daysUntilDue: number;
  overdue: boolean;
}

async function loadAll(): Promise<RecurringJobTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAll(rows: RecurringJobTemplate[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function cadenceToDays(c: RecurrenceCadence, customDays?: number): number {
  switch (c) {
    case 'monthly': return 30;
    case 'quarterly': return 90;
    case 'semiannual': return 182;
    case 'annual': return 365;
    case 'custom': return Math.max(7, Math.min(customDays ?? 90, 365));
  }
}

export function nextDueDate(template: RecurringJobTemplate): string {
  const last = template.lastRunDate ?? template.startDate;
  const interval = cadenceToDays(template.cadence, template.customIntervalDays);
  const next = new Date(last);
  next.setDate(next.getDate() + interval);
  return next.toISOString();
}

export async function getAllRecurring(): Promise<RecurringJobTemplate[]> {
  return loadAll();
}

export async function getRecurringInstances(opts: { withinDays?: number; includePaused?: boolean } = {}): Promise<RecurringJobInstance[]> {
  const all = await loadAll();
  const now = Date.now();
  const horizon = opts.withinDays ?? 60;
  return all
    .filter((t) => opts.includePaused || !t.paused)
    .map((template): RecurringJobInstance => {
      const next = nextDueDate(template);
      const daysUntilDue = Math.round((new Date(next).getTime() - now) / 86400000);
      return {
        template,
        nextDueDate: next,
        daysUntilDue,
        overdue: daysUntilDue < 0,
      };
    })
    .filter((inst) => inst.daysUntilDue <= horizon)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export async function createRecurring(input: Omit<RecurringJobTemplate, 'id' | 'createdAt' | 'updatedAt' | 'paused'> & { paused?: boolean }): Promise<RecurringJobTemplate> {
  const all = await loadAll();
  const now = new Date().toISOString();
  const template: RecurringJobTemplate = {
    ...input,
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    paused: input.paused ?? false,
    createdAt: now,
    updatedAt: now,
  };
  all.push(template);
  await saveAll(all);
  return template;
}

export async function updateRecurring(id: string, patch: Partial<RecurringJobTemplate>): Promise<RecurringJobTemplate | null> {
  const all = await loadAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, id: all[idx].id, updatedAt: new Date().toISOString() };
  await saveAll(all);
  return all[idx];
}

export async function deleteRecurring(id: string): Promise<void> {
  const all = await loadAll();
  await saveAll(all.filter((t) => t.id !== id));
}

export async function markRunNow(id: string): Promise<RecurringJobTemplate | null> {
  return updateRecurring(id, { lastRunDate: new Date().toISOString() });
}

export async function pause(id: string): Promise<RecurringJobTemplate | null> {
  return updateRecurring(id, { paused: true });
}

export async function resume(id: string): Promise<RecurringJobTemplate | null> {
  return updateRecurring(id, { paused: false });
}
