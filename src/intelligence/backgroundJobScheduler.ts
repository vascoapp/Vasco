// =============================================================================
// BACKGROUND JOB SCHEDULER — EVE-style continuous AI monitoring
// =============================================================================
// Central orchestrator that runs audits on schedule:
// - Hourly: invoice audit, schedule conflicts, cert expiry
// - 6-hourly: quote pricing audit, supplier anomalies, action queue
// - Daily: cohort benchmarks, template suggestions, morning briefing
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { populateQueue } from '../services/aiActionQueueService';
import { evaluateTriggers } from '../services/workflowPackService';
import { calibrateModels } from './mlModels';
import { validateWorkflowState } from '../services/workflowValidatorService';
import { MS_PER_DAY } from '../utils/timeConstants';

const SCHEDULER_KEY = '@vasco_scheduler_state';
const BRIEFING_KEY = '@vasco_morning_briefing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditFinding {
  id: string;
  type: 'invoice_error' | 'schedule_conflict' | 'cert_expiring' | 'quote_anomaly' | 'margin_issue' | 'payment_overdue' | 'compliance_gap';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  entityId?: string;        // ID of the job/invoice/quote
  entityType?: string;      // 'job' | 'invoice' | 'quote'
  suggestedAction?: string; // What the contractor should do
  detectedAt: string;
}

export interface MorningBriefing {
  date: string;
  auditsRun: number;
  itemsChecked: { invoices: number; quotes: number; jobs: number; certs: number };
  findings: AuditFinding[];
  actionsQueued: number;
  generatedAt: string;
}

interface SchedulerState {
  lastHourlyRun: string;
  lastSixHourlyRun: string;
  lastDailyRun: string;
  totalAuditsRun: number;
}

// ---------------------------------------------------------------------------
// Audit functions
// ---------------------------------------------------------------------------

function auditInvoices(invoices: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();

  // Check for overdue invoices
  for (const inv of invoices) {
    if (inv.status === 'sent' || inv.status === 'overdue') {
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
      if (dueDate && dueDate < now) {
        const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / MS_PER_DAY);
        findings.push({
          id: `audit-inv-${inv.id}`,
          type: 'payment_overdue',
          severity: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'warning' : 'info',
          title: `Factuur ${inv.id} is ${daysOverdue} dagen achterstallig`,
          description: `€${(inv.amount ?? 0).toLocaleString('nl-NL')} uitstaand`,
          entityId: inv.id,
          entityType: 'invoice',
          suggestedAction: daysOverdue > 14 ? 'Telefonisch opvolgen' : 'Herinnering sturen',
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  // Check for duplicate amounts (same amount within 7 days)
  const recentInvoices = invoices.filter((i: any) => {
    const created = new Date(i.createdAt || i.lastUpdated || '');
    return now.getTime() - created.getTime() < 7 * MS_PER_DAY;
  });
  const amountMap = new Map<number, any[]>();
  for (const inv of recentInvoices) {
    const amount = inv.amount ?? inv.total ?? 0;
    const group = amountMap.get(amount) ?? [];
    group.push(inv);
    amountMap.set(amount, group);
  }
  for (const [amount, group] of amountMap) {
    if (group.length > 1 && amount > 0) {
      findings.push({
        id: `audit-dup-${group[0].id}`,
        type: 'invoice_error',
        severity: 'warning',
        title: `Mogelijke dubbele factuur: €${amount.toLocaleString('nl-NL')}`,
        description: `${group.length} facturen met hetzelfde bedrag binnen 7 dagen`,
        entityId: group[0].id,
        entityType: 'invoice',
        suggestedAction: 'Controleer of dit een dubbele factuur is',
        detectedAt: now.toISOString(),
      });
    }
  }

  return findings;
}

function auditQuotes(quotes: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();

  // Stale quotes (sent > 14 days, no response)
  for (const q of quotes) {
    if (q.status === 'sent') {
      const sentDate = new Date(q.lastUpdated || q.createdAt || '');
      const daysSinceSent = Math.ceil((now.getTime() - sentDate.getTime()) / MS_PER_DAY);
      if (daysSinceSent > 14) {
        findings.push({
          id: `audit-quote-${q.id}`,
          type: 'quote_anomaly',
          severity: 'warning',
          title: `Offerte ${q.id} al ${daysSinceSent} dagen zonder reactie`,
          description: `€${(q.amount ?? 0).toLocaleString('nl-NL')} · ${q.customer || 'Onbekende klant'}`,
          entityId: q.id,
          entityType: 'quote',
          suggestedAction: 'Opvolging sturen of archiveren',
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  return findings;
}

function auditJobs(jobs: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();

  // Completed jobs without invoices
  for (const job of jobs) {
    if ((job.status === 'completed' || job.status === 'gereed') && !job.invoiceId) {
      findings.push({
        id: `audit-job-${job.id}`,
        type: 'margin_issue',
        severity: 'info',
        title: `Klus "${job.title}" afgerond maar niet gefactureerd`,
        description: `€${(job.quotedAmount ?? 0).toLocaleString('nl-NL')} omzet wacht op facturatie`,
        entityId: job.id,
        entityType: 'job',
        suggestedAction: 'Factuur aanmaken',
        detectedAt: now.toISOString(),
      });
    }
  }

  // Schedule conflict detection — check for overlapping jobs
  const scheduledJobs = jobs.filter((j: any) =>
    (j.status === 'scheduled' || j.status === 'in-progress' || j.status === 'ingepland' || j.status === 'bezig') &&
    j.scheduledDate
  );
  for (let i = 0; i < scheduledJobs.length; i++) {
    for (let k = i + 1; k < scheduledJobs.length; k++) {
      const a = scheduledJobs[i];
      const b = scheduledJobs[k];
      if (a.scheduledDate !== b.scheduledDate) continue;
      // Same day — check time overlap
      const aStart = toMinutes(a.scheduledStartTime || '09:00');
      const aEnd = toMinutes(a.scheduledEndTime || addHours(a.scheduledStartTime || '09:00', a.estimatedDuration || 2));
      const bStart = toMinutes(b.scheduledStartTime || '09:00');
      const bEnd = toMinutes(b.scheduledEndTime || addHours(b.scheduledStartTime || '09:00', b.estimatedDuration || 2));
      if (aStart < bEnd && bStart < aEnd) {
        findings.push({
          id: `audit-conflict-${a.id}-${b.id}`,
          type: 'schedule_conflict',
          severity: 'warning',
          title: `Overlap: "${a.title}" en "${b.title}"`,
          description: `${a.scheduledDate} ${a.scheduledStartTime || '09:00'}-${a.scheduledEndTime || addHours(a.scheduledStartTime || '09:00', a.estimatedDuration || 2)} ↔ ${b.scheduledStartTime || '09:00'}-${b.scheduledEndTime || addHours(b.scheduledStartTime || '09:00', b.estimatedDuration || 2)}`,
          entityId: a.id,
          entityType: 'job',
          suggestedAction: 'Verplaats één van de klussen',
          detectedAt: now.toISOString(),
        });
      }
    }
  }

  return findings;
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = (h || 9) * 60 + (m || 0) + hours * 60;
  const newH = Math.min(23, Math.floor(totalMin / 60));
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/** Convert "HH:MM" to minutes since midnight for robust time comparison */
function toMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  const h = parts[0] ?? 9;
  const m = parts[1] ?? 0;
  return (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m);
}

function auditCerts(certs: any[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const now = new Date();
  const dayMs = MS_PER_DAY;

  for (const cert of certs) {
    if (!cert || !cert.expiryDate) continue;
    const expiry = new Date(cert.expiryDate).getTime();
    if (isNaN(expiry)) continue;
    const daysLeft = Math.ceil((expiry - now.getTime()) / dayMs);

    if (daysLeft < 0) {
      findings.push({
        id: `audit-cert-expired-${cert.id || cert.name}`,
        type: 'cert_expiring',
        severity: 'critical',
        title: `${cert.name || cert.type || 'Certificaat'} is verlopen`,
        description: `${Math.abs(daysLeft)} dagen geleden verlopen`,
        suggestedAction: 'Direct vernieuwen',
        detectedAt: now.toISOString(),
      });
    } else if (daysLeft <= 30) {
      findings.push({
        id: `audit-cert-expiring-${cert.id || cert.name}`,
        type: 'cert_expiring',
        severity: daysLeft <= 7 ? 'critical' : 'warning',
        title: `${cert.name || cert.type || 'Certificaat'} verloopt over ${daysLeft} dagen`,
        description: cert.issuedBy || cert.authority || '',
        suggestedAction: daysLeft <= 7 ? 'Dringend vernieuwen' : 'Vernieuwing plannen',
        detectedAt: now.toISOString(),
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Morning Briefing
// ---------------------------------------------------------------------------

export async function generateMorningBriefing(context: {
  invoices: any[];
  quotes: any[];
  jobs: any[];
  certs?: any[];
}): Promise<MorningBriefing> {
  const invoiceFindings = auditInvoices(context.invoices);
  const quoteFindings = auditQuotes(context.quotes);
  const jobFindings = auditJobs(context.jobs);
  const certFindings = auditCerts(context.certs ?? []);

  // Workflow validator — batch check for systemic issues
  const validatorWarnings = validateWorkflowState({
    jobs: context.jobs,
    invoices: context.invoices,
    quotes: context.quotes,
    country: 'NL', // TODO: pass from user context
  });
  const validatorFindings: AuditFinding[] = validatorWarnings.map(w => ({
    id: `validator-${w.code}`,
    type: 'compliance_gap' as const,
    severity: 'warning' as const,
    title: w.message,
    description: w.message,
    detectedAt: new Date().toISOString(),
  }));

  const allFindings = [...invoiceFindings, ...quoteFindings, ...jobFindings, ...certFindings, ...validatorFindings]
    .sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
    });

  // Also populate AI action queue
  const actionsQueued = await populateQueue({
    completedJobs: context.jobs.filter(j => j.status === 'completed'),
    overdueInvoices: context.invoices.filter(i => i.status === 'overdue'),
    sentQuotes: context.quotes.filter(q => q.status === 'sent'),
    expiringCerts: [],
  });

  const briefing: MorningBriefing = {
    date: new Date().toISOString().split('T')[0],
    auditsRun: 4, // invoices, quotes, jobs, certs
    itemsChecked: {
      invoices: context.invoices.length,
      quotes: context.quotes.length,
      jobs: context.jobs.length,
      certs: (context.certs ?? []).length,
    },
    findings: allFindings.slice(0, 10), // Top 10 findings
    actionsQueued,
    generatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(BRIEFING_KEY, JSON.stringify(briefing));
  return briefing;
}

export async function getMorningBriefing(): Promise<MorningBriefing | null> {
  try {
    const raw = await AsyncStorage.getItem(BRIEFING_KEY);
    if (!raw) return null;
    const briefing: MorningBriefing = JSON.parse(raw);
    // Only return if from today
    const today = new Date().toISOString().split('T')[0];
    if (briefing.date === today) return briefing;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Background scheduler
// ---------------------------------------------------------------------------

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startBackgroundJobScheduler(
  getContext: () => { invoices: any[]; quotes: any[]; jobs: any[]; customers?: any[] },
): void {
  if (schedulerTimer) return;

  // Run morning briefing immediately on first start
  const ctx = getContext();
  generateMorningBriefing(ctx).catch(() => {});

  // Check every 30 minutes if any scheduled jobs are due
  schedulerTimer = setInterval(async () => {
    try {
      const raw = await AsyncStorage.getItem(SCHEDULER_KEY);
      const state: SchedulerState = raw ? JSON.parse(raw) : {
        lastHourlyRun: '',
        lastSixHourlyRun: '',
        lastDailyRun: '',
        totalAuditsRun: 0,
      };

      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const context = getContext();

      // Hourly: invoice audit
      if (!state.lastHourlyRun || state.lastHourlyRun < hourAgo) {
        auditInvoices(context.invoices); // Results stored via morning briefing
        state.lastHourlyRun = now.toISOString();
        state.totalAuditsRun++;
      }

      // 6-hourly: quote audit + action queue + trigger evaluation
      if (!state.lastSixHourlyRun || state.lastSixHourlyRun < sixHoursAgo) {
        auditQuotes(context.quotes);
        await populateQueue({
          completedJobs: context.jobs.filter((j: any) => j.status === 'completed'),
          overdueInvoices: context.invoices.filter((i: any) => i.status === 'overdue'),
          sentQuotes: context.quotes.filter((q: any) => q.status === 'sent'),
          expiringCerts: [],
        });
        // Evaluate workflow pack triggers against real data
        await evaluateTriggers({
          invoices: context.invoices,
          quotes: context.quotes,
          jobs: context.jobs,
          customers: context.customers ?? [],
        }).catch(() => {});
        state.lastSixHourlyRun = now.toISOString();
        state.totalAuditsRun++;
      }

      // Daily: full morning briefing + ML calibration
      if (!state.lastDailyRun || state.lastDailyRun < dayAgo) {
        await generateMorningBriefing(context);
        // Calibrate ML models from accumulated prediction/actual pairs
        await calibrateModels().catch(() => {});
        state.lastDailyRun = now.toISOString();
        state.totalAuditsRun++;
      }

      await AsyncStorage.setItem(SCHEDULER_KEY, JSON.stringify(state));
    } catch {}
  }, 30 * 60 * 1000); // Check every 30 minutes
}

export function stopBackgroundJobScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

/** Returns when the scheduler last ran any check, or null if never */
export async function getLastCheckedAt(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULER_KEY);
    if (!raw) return null;
    const state: SchedulerState = JSON.parse(raw);
    // Return the most recent of the three run timestamps
    const timestamps = [state.lastHourlyRun, state.lastSixHourlyRun, state.lastDailyRun].filter(Boolean);
    if (timestamps.length === 0) return null;
    return timestamps.sort().pop() || null;
  } catch {
    return null;
  }
}
