// =============================================================================
// AUTOMATION SERVICE — time-saving automations for contractors + site leads
// =============================================================================
import { formatMoney } from '../i18n/formatting';
import { MS_PER_DAY } from '../utils/timeConstants';
// PDF research: contractors spend 40-50% on admin. Key automations:
// 1. Auto-invoice from completed jobs (no "office time" needed)
// 2. Auto-reminder for overdue invoices
// 3. Auto-follow-up for stale quotes
// 4. Auto-schedule recurring service agreements
// 5. Auto-populate daily reports from schedule (site lead)
// 6. Auto-certify expiry alerts
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { findDocumentCustomer } from '../domain/customers';

const LAST_RUN_KEY = '@vasco_automation_last_run';
const RUN_INTERVAL_MS = 4 * 60 * 60 * 1000; // every 4 hours

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutomationResult {
  id: string;
  type: AutomationType;
  title: string;
  description: string;
  actionTaken: boolean;
  timestamp: string;
}

export type AutomationType =
  | 'auto_invoice'
  | 'auto_reminder'
  | 'auto_followup'
  | 'auto_schedule'
  | 'cert_expiry_alert'
  | 'daily_report_prefill';

export interface AutomationConfig {
  autoInvoiceEnabled: boolean;
  autoReminderDays: number; // days after due date to send reminder
  autoFollowupDays: number; // days after quote sent to follow up
  certExpiryWarningDays: number; // days before expiry to alert
}

const DEFAULT_CONFIG: AutomationConfig = {
  autoInvoiceEnabled: true,
  autoReminderDays: 7,
  autoFollowupDays: 3,
  certExpiryWarningDays: 30,
};

// ---------------------------------------------------------------------------
// Load/save config
// ---------------------------------------------------------------------------

export async function getAutomationConfig(): Promise<AutomationConfig> {
  try {
    const raw = await AsyncStorage.getItem('@vasco_automation_config');
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveAutomationConfig(config: Partial<AutomationConfig>): Promise<void> {
  const current = await getAutomationConfig();
  await AsyncStorage.setItem('@vasco_automation_config', JSON.stringify({ ...current, ...config }));
}

// ---------------------------------------------------------------------------
// Automation checks — run periodically
// ---------------------------------------------------------------------------

export interface AutomationContext {
  jobs: Array<{ id: string; title: string; status: string; customerId: string; agreedAmount?: number; completedAt?: string }>;
  invoices: Array<{ id: string; customer: string; amount: number; status: string; dueInDays: number }>;
  quotes: Array<{ id: string; customer: string; amount: number; status: string; lastUpdated: string }>;
  customers: Array<{ id: string; name: string }>;
}

export function checkAutoInvoice(ctx: AutomationContext, config: AutomationConfig): AutomationResult[] {
  if (!config.autoInvoiceEnabled) return [];

  const completedWithoutInvoice = ctx.jobs.filter(j =>
    j.status === 'completed' &&
    !ctx.invoices.some(inv => inv.customer === j.customerId && inv.status === 'draft')
  );

  return completedWithoutInvoice.map(job => {
    const customer = ctx.customers.find(c => c.id === job.customerId);
    return {
      id: `auto_invoice_${job.id}`,
      type: 'auto_invoice' as AutomationType,
      title: `Factuur aanmaken: ${job.title}`,
      description: `Klus voor ${customer?.name ?? 'de klant'} is afgerond — factuur kan automatisch worden aangemaakt`,
      actionTaken: false,
      timestamp: new Date().toISOString(),
    };
  });
}

export function checkAutoReminder(ctx: AutomationContext, config: AutomationConfig): AutomationResult[] {
  const overdueInvoices = ctx.invoices.filter(inv =>
    inv.status === 'sent' && inv.dueInDays < -config.autoReminderDays
  );

  return overdueInvoices.map(inv => {
    const customer = findDocumentCustomer(ctx.customers, inv);
    const daysOverdue = Math.abs(inv.dueInDays);
    return {
      id: `auto_reminder_${inv.id}`,
      type: 'auto_reminder' as AutomationType,
      title: `Herinnering: ${customer?.name ?? inv.customer}`,
      description: `Factuur ${formatMoney(inv.amount)} is ${daysOverdue} dagen verlopen — automatische herinnering versturen`,
      actionTaken: false,
      timestamp: new Date().toISOString(),
    };
  });
}

export function checkAutoFollowup(ctx: AutomationContext, config: AutomationConfig): AutomationResult[] {
  const now = Date.now();
  const staleQuotes = ctx.quotes.filter(q => {
    if (q.status !== 'sent') return false;
    const sentTime = new Date(q.lastUpdated).getTime();
    return (now - sentTime) >= config.autoFollowupDays * MS_PER_DAY;
  });

  return staleQuotes.map(q => {
    const customer = findDocumentCustomer(ctx.customers, q);
    const days = Math.floor((now - new Date(q.lastUpdated).getTime()) / MS_PER_DAY);
    return {
      id: `auto_followup_${q.id}`,
      type: 'auto_followup' as AutomationType,
      title: `Opvolgen: ${customer?.name ?? q.customer}`,
      description: `Offerte ${formatMoney(q.amount)} is ${days} dagen geleden verstuurd — opvolgen verhoogt acceptatiekans`,
      actionTaken: false,
      timestamp: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Run all automations
// ---------------------------------------------------------------------------

export function runAllAutomations(ctx: AutomationContext, config: AutomationConfig): AutomationResult[] {
  return [
    ...checkAutoInvoice(ctx, config),
    ...checkAutoReminder(ctx, config),
    ...checkAutoFollowup(ctx, config),
  ];
}

// ---------------------------------------------------------------------------
// Time saved calculation
// ---------------------------------------------------------------------------

export interface TimeSavedMetrics {
  weeklyHoursSaved: number;
  monthlyHoursSaved: number;
  topSavingAreas: { area: string; hoursSaved: number }[];
  automationsRun: number;
}

export function calculateTimeSaved(ctx: AutomationContext): TimeSavedMetrics {
  // Based on PDF research: contractors spend 1-3h/week on invoicing, 2-6h/week on quotes,
  // ~1h/day on scheduling, 2-4h/month on VAT
  const invoiceCount = ctx.invoices.length;
  const quoteCount = ctx.quotes.length;
  const jobCount = ctx.jobs.length;

  // Each automated invoice saves ~15 min vs manual (Excel/Word)
  const invoiceSavings = invoiceCount * 0.25; // hours

  // Each quote with pricebook saves ~30 min vs manual calculation
  const quoteSavings = quoteCount * 0.5;

  // Scheduling automation saves ~5 min/job
  const scheduleSavings = jobCount * (5 / 60);

  // Automatic reminders save ~10 min each (vs manual phone/email)
  const reminderSavings = ctx.invoices.filter(i => i.status === 'sent' && i.dueInDays < 0).length * (10 / 60);

  const totalMonthly = invoiceSavings + quoteSavings + scheduleSavings + reminderSavings;
  const totalWeekly = totalMonthly / 4.3;

  return {
    weeklyHoursSaved: Math.round(totalWeekly * 10) / 10,
    monthlyHoursSaved: Math.round(totalMonthly * 10) / 10,
    topSavingAreas: [
      { area: 'Offertes', hoursSaved: Math.round(quoteSavings * 10) / 10 },
      { area: 'Facturen', hoursSaved: Math.round(invoiceSavings * 10) / 10 },
      { area: 'Planning', hoursSaved: Math.round(scheduleSavings * 10) / 10 },
      { area: 'Herinneringen', hoursSaved: Math.round(reminderSavings * 10) / 10 },
    ].filter(a => a.hoursSaved > 0).sort((a, b) => b.hoursSaved - a.hoursSaved),
    automationsRun: invoiceCount + quoteCount + jobCount,
  };
}

// ---------------------------------------------------------------------------
// React hook — run automations periodically
// ---------------------------------------------------------------------------

export function useAutomations(ctx: AutomationContext): {
  results: AutomationResult[];
  timeSaved: TimeSavedMetrics;
  config: AutomationConfig;
  updateConfig: (updates: Partial<AutomationConfig>) => void;
} {
  const [results, setResults] = useState<AutomationResult[]>([]);
  const [config, setConfig] = useState<AutomationConfig>(DEFAULT_CONFIG);
  const [timeSaved, setTimeSaved] = useState<TimeSavedMetrics>({ weeklyHoursSaved: 0, monthlyHoursSaved: 0, topSavingAreas: [], automationsRun: 0 });

  useEffect(() => {
    getAutomationConfig().then(setConfig);
  }, []);

  useEffect(() => {
    const automationResults = runAllAutomations(ctx, config);
    setResults(automationResults);
    setTimeSaved(calculateTimeSaved(ctx));
  }, [ctx.jobs.length, ctx.invoices.length, ctx.quotes.length, config]);

  const updateConfig = useCallback(async (updates: Partial<AutomationConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    await saveAutomationConfig(updates);
  }, [config]);

  return { results, timeSaved, config, updateConfig };
}
