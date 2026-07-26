// =============================================================================
// WORKFLOW VALIDATOR — Fail-state prevention before DB writes
// =============================================================================
// Harvey/Clutch pattern: deterministic validators sit between AI output and
// database commits. Catches missing data, duplicates, and rule violations
// BEFORE they corrupt state.
//
// Usage: call validate*() before addQuote/addInvoice/updateJobStatus etc.
// Returns { valid, errors[] } — block the write if !valid.
// =============================================================================

import i18n from '../i18n/i18n';
import { MS_PER_DAY } from '../utils/timeConstants';
import { formatMoney } from '../i18n/formatting';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// VAT rates by country
// ---------------------------------------------------------------------------

const VAT_RATES: Record<string, number> = {
  NL: 21, DE: 19, FR: 20, ES: 21, IT: 22, UK: 20,
};

// ---------------------------------------------------------------------------
// Quote validation
// ---------------------------------------------------------------------------

export function validateQuoteBeforeSend(quote: {
  customer?: string;
  amount?: number;
  lineItems?: any[];
  status?: string;
}, existingQuotes: any[], country?: string): ValidationResult {
  const t = i18n.t.bind(i18n);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Missing customer
  if (!quote.customer?.trim()) {
    errors.push({ code: 'QUOTE_NO_CUSTOMER', field: 'customer', message: t('validator.noCustomer', 'Quote has no customer assigned') });
  }

  // Zero amount
  if (!quote.amount || quote.amount <= 0) {
    errors.push({ code: 'QUOTE_ZERO_AMOUNT', field: 'amount', message: t('validator.zeroAmount', 'Quote total is {{zero}} — add line items', { zero: formatMoney(0) }) });
  }

  // No line items
  if (!quote.lineItems || quote.lineItems.length === 0) {
    errors.push({ code: 'QUOTE_NO_ITEMS', field: 'lineItems', message: t('validator.noLineItems', 'Quote has no line items') });
  }

  // Line items with zero price
  const zeroPriceItems = (quote.lineItems ?? []).filter((li: any) => !li.unitPrice || li.unitPrice <= 0);
  if (zeroPriceItems.length > 0) {
    warnings.push({ code: 'QUOTE_ZERO_PRICE_ITEMS', message: t('validator.zeroPriceItems', { defaultValue: '{{count}} line items have no price', count: zeroPriceItems.length }) });
  }

  // Duplicate detection: same customer + similar amount within 7 days
  if (quote.customer && quote.amount) {
    const duplicates = existingQuotes.filter((q: any) =>
      q.customer === quote.customer &&
      q.status !== 'rejected' &&
      Math.abs((q.amount || 0) - (quote.amount || 0)) < (quote.amount || 0) * 0.05 // within 5%
    );
    if (duplicates.length > 0) {
      warnings.push({ code: 'QUOTE_POSSIBLE_DUPLICATE', message: t('validator.possibleDuplicate', 'A similar quote for this customer already exists') });
    }
  }

  // VAT validation
  if (country && !VAT_RATES[country]) {
    warnings.push({ code: 'QUOTE_UNKNOWN_VAT', message: t('validator.unknownVAT', { defaultValue: 'No VAT rate configured for {{country}}', country }) });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Invoice validation
// ---------------------------------------------------------------------------

export function validateInvoiceBeforeCreate(invoice: {
  customer?: string;
  amount?: number;
  jobId?: string;
  dueDate?: string;
}, existingInvoices: any[], jobs: any[]): ValidationResult {
  const t = i18n.t.bind(i18n);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Missing customer
  if (!invoice.customer?.trim()) {
    errors.push({ code: 'INV_NO_CUSTOMER', field: 'customer', message: t('validator.invoiceNoCustomer', 'Invoice has no customer') });
  }

  // Zero amount
  if (!invoice.amount || invoice.amount <= 0) {
    errors.push({ code: 'INV_ZERO_AMOUNT', field: 'amount', message: t('validator.invoiceZeroAmount', 'Invoice amount is {{zero}}', { zero: formatMoney(0) }) });
  }

  // Job already invoiced
  if (invoice.jobId) {
    const existingForJob = existingInvoices.filter((inv: any) =>
      inv.jobId === invoice.jobId && inv.status !== 'cancelled'
    );
    if (existingForJob.length > 0) {
      warnings.push({ code: 'INV_JOB_ALREADY_INVOICED', message: t('validator.jobAlreadyInvoiced', 'This job already has an invoice') });
    }
  }

  // Duplicate amount detection: same customer + same amount within 7 days
  if (invoice.customer && invoice.amount) {
    const recentDuplicates = existingInvoices.filter((inv: any) => {
      if (inv.customer !== invoice.customer) return false;
      if (Math.abs((inv.amount || 0) - (invoice.amount || 0)) > 1) return false;
      const created = new Date(inv.createdAt || inv.lastUpdated || '').getTime();
      return Date.now() - created < 7 * MS_PER_DAY;
    });
    if (recentDuplicates.length > 0) {
      errors.push({ code: 'INV_DUPLICATE', field: 'amount', message: t('validator.duplicateInvoice', 'Duplicate: same customer + amount within 7 days') });
    }
  }

  // Missing due date
  if (!invoice.dueDate) {
    warnings.push({ code: 'INV_NO_DUE_DATE', message: t('validator.noDueDate', 'No due date set — defaults to 30 days') });
  }

  // Job not completed
  if (invoice.jobId) {
    const job = jobs.find((j: any) => j.id === invoice.jobId);
    if (job && job.status !== 'completed' && job.status !== 'gereed') {
      warnings.push({ code: 'INV_JOB_NOT_COMPLETE', message: t('validator.jobNotComplete', 'Job is not marked as completed yet') });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Job status transition validation
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  'lead': ['quoted', 'scheduled', 'cancelled'],
  'quoted': ['accepted', 'scheduled', 'cancelled'],
  'accepted': ['scheduled', 'in-progress', 'cancelled'],
  'scheduled': ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  'completed': ['invoiced'],
  'invoiced': ['paid'],
  'paid': [],
  'cancelled': [],
  // Dutch status names
  'ingepland': ['in-progress', 'bezig', 'cancelled'],
  'bezig': ['completed', 'gereed', 'cancelled'],
  'gereed': ['invoiced', 'gefactureerd'],
  'gefactureerd': ['paid', 'betaald'],
  'betaald': [],
};

export function validateJobStatusChange(currentStatus: string, newStatus: string, job: any): ValidationResult {
  const t = i18n.t.bind(i18n);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Invalid transition
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    errors.push({
      code: 'JOB_INVALID_TRANSITION',
      field: 'status',
      message: t('validator.invalidTransition', { defaultValue: 'Cannot move from {{from}} to {{to}}', from: currentStatus, to: newStatus }),
    });
  }

  // Completing without time entries
  if (newStatus === 'completed' && (!job.timeEntries || job.timeEntries.length === 0)) {
    warnings.push({ code: 'JOB_NO_HOURS', message: t('validator.noHoursLogged', 'No hours logged — complete anyway?') });
  }

  // Scheduling without a date
  if (newStatus === 'scheduled' && !job.scheduledDate) {
    warnings.push({ code: 'JOB_NO_DATE', message: t('validator.noScheduleDate', 'No scheduled date set') });
  }

  // Starting without customer
  if (newStatus === 'in-progress' && !job.customerId) {
    warnings.push({ code: 'JOB_NO_CUSTOMER', message: t('validator.jobNoCustomer', 'Job has no customer assigned') });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Payment reminder validation
// ---------------------------------------------------------------------------

export function validateReminderBeforeSend(invoice: any, remindersAlreadySent: number): ValidationResult {
  const t = i18n.t.bind(i18n);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (invoice.status === 'paid') {
    errors.push({ code: 'REMIND_ALREADY_PAID', field: 'status', message: t('validator.alreadyPaid', 'Invoice is already paid') });
  }

  if (invoice.status === 'draft') {
    errors.push({ code: 'REMIND_NOT_SENT', field: 'status', message: t('validator.invoiceNotSent', 'Invoice has not been sent yet') });
  }

  if (remindersAlreadySent >= 5) {
    warnings.push({ code: 'REMIND_TOO_MANY', message: t('validator.tooManyReminders', '5+ reminders already sent — consider escalation') });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Cert validation before job start
// ---------------------------------------------------------------------------

export function validateCertBeforeJobStart(
  job: { trade?: string; title?: string },
  certs: { name?: string; type?: string; trade?: string; expiryDate?: string; status?: string }[],
): ValidationResult {
  const t = i18n.t.bind(i18n);
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const trade = job.trade || 'general';
  const now = Date.now();
  const dayMs = MS_PER_DAY;

  // Find certs that match the job's trade
  const tradeCerts = certs.filter(c => c.trade === trade || c.type === trade);

  if (tradeCerts.length === 0 && trade !== 'general') {
    warnings.push({
      code: 'CERT_NONE_FOR_TRADE',
      message: t('validator.noCertForTrade', {
        defaultValue: 'No certificates found for {{trade}} — check compliance',
        trade,
      }),
    });
  }

  for (const cert of tradeCerts) {
    if (!cert.expiryDate) continue;
    const expiry = new Date(cert.expiryDate).getTime();
    if (isNaN(expiry)) continue;

    if (expiry < now) {
      errors.push({
        code: 'CERT_EXPIRED',
        field: 'certs',
        message: t('validator.certExpired', {
          defaultValue: '{{name}} has expired — renew before starting {{job}}',
          name: cert.name || cert.type || 'Certificate',
          job: job.title || '',
        }),
      });
    } else if (expiry - now < 7 * dayMs) {
      warnings.push({
        code: 'CERT_EXPIRING_SOON',
        message: t('validator.certExpiringSoon', {
          defaultValue: '{{name}} expires within 7 days',
          name: cert.name || cert.type || 'Certificate',
        }),
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Batch validator — run all checks at once for a context
// ---------------------------------------------------------------------------

export function validateWorkflowState(context: {
  jobs: any[];
  invoices: any[];
  quotes: any[];
  country: string;
}): ValidationWarning[] {
  const t = i18n.t.bind(i18n);
  const warnings: ValidationWarning[] = [];

  // Jobs completed but not invoiced (> 7 days)
  const staleCompleted = context.jobs.filter((j: any) => {
    if (j.status !== 'completed' && j.status !== 'gereed') return false;
    const completed = new Date(j.completedAt || '').getTime();
    return completed && (Date.now() - completed) > 7 * MS_PER_DAY;
  });
  if (staleCompleted.length > 0) {
    warnings.push({ code: 'STALE_COMPLETED', message: t('validator.staleCompleted', { defaultValue: '{{count}} jobs completed 7+ days ago without invoice', count: staleCompleted.length }) });
  }

  // Quotes sent but never followed up (> 14 days)
  const staleQuotes = context.quotes.filter((q: any) => {
    if (q.status !== 'sent') return false;
    const sent = new Date(q.sentAt || q.lastUpdated || '').getTime();
    return sent && (Date.now() - sent) > 14 * MS_PER_DAY;
  });
  if (staleQuotes.length > 0) {
    warnings.push({ code: 'STALE_QUOTES', message: t('validator.staleQuotes', { defaultValue: '{{count}} quotes sent 14+ days ago without response', count: staleQuotes.length }) });
  }

  // Invoices overdue > 30 days without escalation
  const severelyOverdue = context.invoices.filter((i: any) => {
    if (i.status !== 'overdue') return false;
    const due = new Date(i.dueDate || '').getTime();
    return due && (Date.now() - due) > 30 * MS_PER_DAY;
  });
  if (severelyOverdue.length > 0) {
    warnings.push({ code: 'SEVERE_OVERDUE', message: t('validator.severeOverdue', { defaultValue: '{{count}} invoices 30+ days overdue — escalate', count: severelyOverdue.length }) });
  }

  return warnings;
}
