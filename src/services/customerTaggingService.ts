// =============================================================================
// CUSTOMER TAGGING — auto-tag VIP / loyal / risky based on history
// =============================================================================
// Runs across {customers, jobs, invoices} and returns one tag per customer
// plus the numeric score that drove it. Used by the Klanten UI + by the AI
// queue's customer-context block (so a reminder to a VIP customer phrases
// the ask more gently than one to a risky payer).
// =============================================================================

import { formatMoney } from '../i18n/formatting';
import type { Customer, Job } from '../types/contractor';
import type { Invoice } from '../domain/documents';

export type CustomerTag = 'vip' | 'loyal' | 'new' | 'risky' | 'inactive';

export interface CustomerProfile {
  customerId: string;
  tag: CustomerTag;
  score: number;          // 0..100 composite
  lifetimeValue: number;
  jobsCompleted: number;
  onTimeRate: number;     // 0..1, paid-on-time / total paid
  lastActivityDays: number;
  reasoning: string;
}

interface Context {
  customer: Customer;
  jobs: Job[];
  invoices: Invoice[];
  now?: Date;
}

const DAY = 24 * 60 * 60 * 1000;

export function scoreCustomer(ctx: Context): CustomerProfile {
  const now = (ctx.now ?? new Date()).getTime();
  const myJobs = ctx.jobs.filter((j) => j.customerId === ctx.customer.id);
  const myInvoices = ctx.invoices.filter((i) => i.customer === ctx.customer.id);

  const jobsCompleted = myJobs.filter((j) => j.status === 'completed').length;
  const lifetimeValue = myInvoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + (i.amount ?? 0), 0);

  const paid = myInvoices.filter((i) => i.status === 'paid');
  const onTime = paid.filter((i) => (i as any).dueInDays >= 0 || (i as any).paidOnTime !== false);
  const onTimeRate = paid.length > 0 ? onTime.length / paid.length : 1;

  const lastActivity = [...myJobs, ...myInvoices]
    .map((x: any) => x.updatedAt ?? x.createdAt ?? x.paidAt)
    .filter(Boolean)
    .map((s) => new Date(s).getTime())
    .sort((a, b) => b - a)[0] ?? 0;
  const lastActivityDays = lastActivity ? Math.floor((now - lastActivity) / DAY) : 9999;

  // Composite score
  let score = 0;
  score += Math.min(40, lifetimeValue / 100);   // €10k LTV = 40pts
  score += Math.min(25, jobsCompleted * 5);      // 5 jobs = 25pts
  score += onTimeRate * 20;                       // all on-time = 20pts
  score += Math.max(0, 15 - lastActivityDays / 12); // fresh activity = up to 15pts
  score = Math.round(Math.min(100, Math.max(0, score)));

  // Classify
  let tag: CustomerTag;
  let reasoning: string;

  const hasUnpaidOverdue = myInvoices.some((i) => i.status === 'overdue');

  if (lastActivityDays > 365) {
    tag = 'inactive';
    reasoning = `No activity for ${Math.round(lastActivityDays / 30)} months`;
  } else if (hasUnpaidOverdue && onTimeRate < 0.5 && paid.length >= 2) {
    tag = 'risky';
    reasoning = `Only ${Math.round(onTimeRate * 100)}% of invoices paid on time, has overdue balance`;
  } else if (lifetimeValue >= 5000 && jobsCompleted >= 3 && onTimeRate >= 0.8) {
    tag = 'vip';
    reasoning = `€${Math.round(lifetimeValue)} lifetime, ${jobsCompleted} jobs, ${Math.round(onTimeRate * 100)}% on-time`;
  } else if (jobsCompleted >= 2) {
    tag = 'loyal';
    reasoning = `${jobsCompleted} completed jobs, €${Math.round(lifetimeValue)} lifetime`;
  } else {
    tag = 'new';
    reasoning = jobsCompleted === 0
      ? 'No completed jobs yet'
      : '1 completed job — build the relationship with a clean handover';
  }

  return {
    customerId: ctx.customer.id,
    tag,
    score,
    lifetimeValue,
    jobsCompleted,
    onTimeRate,
    lastActivityDays,
    reasoning,
  };
}

/** Bulk variant — compute profiles for every customer in one pass. */
export function scoreAllCustomers(customers: Customer[], jobs: Job[], invoices: Invoice[]): Map<string, CustomerProfile> {
  const now = new Date();
  const out = new Map<string, CustomerProfile>();
  for (const c of customers) {
    out.set(c.id, scoreCustomer({ customer: c, jobs, invoices, now }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// R21: contextLineFromProfile (canonical replacement for the contextLine
// produced by tradeContext.getCustomerIntelligence). Used by VascoCard's
// `customerContext` line — gives a one-shot summary like
// "Repeat customer, €5,200, 3 jobs, excellent payer".
//
// Closes R12 deferral: customerTaggingService is now the single canonical
// CRM surface. tradeContext.getCustomerIntelligence delegates here and is
// scheduled for removal once aiActionQueueService call sites migrate.
// ---------------------------------------------------------------------------

export function contextLineFromProfile(profile: CustomerProfile): string {
  const parts: string[] = [];
  if (profile.jobsCompleted >= 2) parts.push('Repeat customer');
  if (profile.lifetimeValue > 0) {
    parts.push(`${formatMoney(profile.lifetimeValue)}`);
  }
  if (profile.jobsCompleted > 0) {
    parts.push(`${profile.jobsCompleted} job${profile.jobsCompleted !== 1 ? 's' : ''}`);
  }
  if (profile.tag === 'vip') parts.push('VIP');
  else if (profile.tag === 'loyal') parts.push('loyal');
  else if (profile.tag === 'risky') parts.push('risky payer');
  else if (profile.tag === 'inactive') parts.push('inactive');
  else if (profile.onTimeRate >= 0.95 && profile.jobsCompleted >= 3) parts.push('excellent payer');
  return parts.join(', ');
}
