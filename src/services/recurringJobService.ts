// =============================================================================
// RECURRING JOB SERVICE — Service agreements & recurring schedules
// =============================================================================
// Manages recurring job patterns (weekly, monthly, quarterly, yearly).
// Generates next job instances from templates on app open.
// Persists to AsyncStorage.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import type { Job } from '../domain/jobs';
import { MS_PER_DAY } from '../utils/timeConstants';
import { localDateKey, todayKey } from '../utils/dateKey';

// =============================================================================
// TYPES
// =============================================================================

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringPattern {
  frequency: RecurringFrequency;
  nextDate: string;
  endDate?: string;
  autoInvoice: boolean;
  templateJobId: string;
}

export interface ServiceAgreement {
  id: string;
  customerId: string;
  customerName: string;
  jobTitle: string;
  description: string | null;
  trade?: string;
  frequency: RecurringFrequency;
  nextDate: string;
  endDate?: string;
  autoInvoice: boolean;
  templateJobId: string;
  amount: number;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  generatedJobIds: string[];
}

// =============================================================================
// STORAGE
// =============================================================================

const AGREEMENTS_KEY = '@vasco_service_agreements';

async function loadAgreements(): Promise<ServiceAgreement[]> {
  try {
    const raw = await AsyncStorage.getItem(AGREEMENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function saveAgreements(agreements: ServiceAgreement[]): Promise<void> {
  await AsyncStorage.setItem(AGREEMENTS_KEY, JSON.stringify(agreements)).catch(() => {});
}

// =============================================================================
// FREQUENCY HELPERS
// =============================================================================

function getFrequencyLabel(frequency: RecurringFrequency): string {
  switch (frequency) {
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Bi-weekly';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Yearly';
  }
}

function getFrequencyMultiplier(frequency: RecurringFrequency): number {
  switch (frequency) {
    case 'weekly': return 52;
    case 'biweekly': return 26;
    case 'monthly': return 12;
    case 'quarterly': return 4;
    case 'yearly': return 1;
  }
}

function computeNextDate(currentDate: string, frequency: RecurringFrequency): string {
  const d = new Date(currentDate);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return localDateKey(d);
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

export async function createRecurringJob(
  job: Job,
  pattern: Omit<RecurringPattern, 'templateJobId'>,
  customerName: string,
): Promise<string> {
  const agreements = await loadAgreements();
  const id = `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const agreement: ServiceAgreement = {
    id,
    customerId: job.customerId || '',
    customerName,
    jobTitle: job.title,
    description: job.description,
    trade: job.trade,
    frequency: pattern.frequency,
    nextDate: pattern.nextDate,
    endDate: pattern.endDate,
    autoInvoice: pattern.autoInvoice,
    templateJobId: job.id,
    amount: job.quotedAmount || job.agreedAmount || 0,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    generatedJobIds: [],
  };

  agreements.push(agreement);
  await saveAgreements(agreements);
  return id;
}

export async function generateNextOccurrence(
  agreementId: string,
): Promise<{ jobData: Partial<Job>; agreement: ServiceAgreement } | null> {
  const agreements = await loadAgreements();
  const agreement = agreements.find(a => a.id === agreementId);
  if (!agreement || agreement.status !== 'active') return null;

  // Check if end date has passed
  if (agreement.endDate && new Date(agreement.endDate) < new Date()) {
    agreement.status = 'cancelled';
    agreement.updatedAt = new Date().toISOString();
    await saveAgreements(agreements);
    return null;
  }

  const jobId = `j-rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const jobData: Partial<Job> = {
    id: jobId,
    customerId: agreement.customerId || null,
    title: agreement.jobTitle,
    description: agreement.description,
    status: 'scheduled',
    trade: agreement.trade,
    priority: 'normal',
    scheduledDate: agreement.nextDate,
    quotedAmount: agreement.amount,
    agreedAmount: agreement.amount,
  };

  // Advance the next date
  agreement.nextDate = computeNextDate(agreement.nextDate, agreement.frequency);
  agreement.generatedJobIds.push(jobId);
  agreement.updatedAt = new Date().toISOString();
  await saveAgreements(agreements);

  return { jobData, agreement };
}

export async function pauseRecurring(agreementId: string): Promise<void> {
  const agreements = await loadAgreements();
  const agreement = agreements.find(a => a.id === agreementId);
  if (agreement) {
    agreement.status = 'paused';
    agreement.updatedAt = new Date().toISOString();
    await saveAgreements(agreements);
  }
}

export async function resumeRecurring(agreementId: string): Promise<void> {
  const agreements = await loadAgreements();
  const agreement = agreements.find(a => a.id === agreementId);
  if (agreement && agreement.status === 'paused') {
    agreement.status = 'active';
    // If nextDate is in the past, advance to next future date
    const now = new Date();
    while (new Date(agreement.nextDate) < now) {
      agreement.nextDate = computeNextDate(agreement.nextDate, agreement.frequency);
    }
    agreement.updatedAt = new Date().toISOString();
    await saveAgreements(agreements);
  }
}

export async function cancelRecurring(agreementId: string): Promise<void> {
  const agreements = await loadAgreements();
  const agreement = agreements.find(a => a.id === agreementId);
  if (agreement) {
    agreement.status = 'cancelled';
    agreement.updatedAt = new Date().toISOString();
    await saveAgreements(agreements);
  }
}

export async function updateAgreement(
  agreementId: string,
  updates: Partial<Pick<ServiceAgreement, 'frequency' | 'nextDate' | 'endDate' | 'autoInvoice' | 'amount'>>,
): Promise<void> {
  const agreements = await loadAgreements();
  const agreement = agreements.find(a => a.id === agreementId);
  if (agreement) {
    Object.assign(agreement, updates);
    agreement.updatedAt = new Date().toISOString();
    await saveAgreements(agreements);
  }
}

// =============================================================================
// DUE CHECK — Run on app open to generate due recurring jobs
// =============================================================================

export async function checkAndGenerateDueJobs(): Promise<{
  dueAgreements: ServiceAgreement[];
  generatedJobs: Partial<Job>[];
}> {
  const agreements = await loadAgreements();
  const today = todayKey();
  const dueAgreements: ServiceAgreement[] = [];
  const generatedJobs: Partial<Job>[] = [];

  for (const agreement of agreements) {
    if (agreement.status !== 'active') continue;
    if (agreement.nextDate <= today) {
      const result = await generateNextOccurrence(agreement.id);
      if (result) {
        dueAgreements.push(result.agreement);
        generatedJobs.push(result.jobData);
      }
    }
  }

  return { dueAgreements, generatedJobs };
}

// =============================================================================
// REVENUE PROJECTION
// =============================================================================

export function calculateAnnualRevenue(agreements: ServiceAgreement[]): number {
  return agreements
    .filter(a => a.status === 'active')
    .reduce((sum, a) => sum + a.amount * getFrequencyMultiplier(a.frequency), 0);
}

export function calculateMonthlyRevenue(agreements: ServiceAgreement[]): number {
  return Math.round(calculateAnnualRevenue(agreements) / 12);
}

// =============================================================================
// REACT HOOK
// =============================================================================

export function useServiceAgreements() {
  const [agreements, setAgreements] = useState<ServiceAgreement[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await loadAgreements();
    setAgreements(data);
  }, []);

  useEffect(() => {
    loadAgreements().then(setAgreements).finally(() => setLoading(false));
  }, []);

  const pause = useCallback(async (id: string) => {
    await pauseRecurring(id);
    await refresh();
  }, [refresh]);

  const resume = useCallback(async (id: string) => {
    await resumeRecurring(id);
    await refresh();
  }, [refresh]);

  const cancel = useCallback(async (id: string) => {
    await cancelRecurring(id);
    await refresh();
  }, [refresh]);

  const activeCount = agreements.filter(a => a.status === 'active').length;
  const annualRevenue = calculateAnnualRevenue(agreements);
  const monthlyRevenue = calculateMonthlyRevenue(agreements);

  return {
    agreements,
    loading,
    refresh,
    pause,
    resume,
    cancel,
    activeCount,
    annualRevenue,
    monthlyRevenue,
  };
}

export { getFrequencyLabel, getFrequencyMultiplier, computeNextDate };
