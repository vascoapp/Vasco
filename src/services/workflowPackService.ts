// =============================================================================
// WORKFLOW PACK SERVICE — Pre-built "set it and forget it" automations
// =============================================================================
// Contractors opt in to workflow packs during onboarding or in settings.
// Each pack is a collection of automated triggers → actions.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import i18n from '../i18n/i18n';
import { MS_PER_DAY } from '../utils/timeConstants';
import { addToQueue, getQueueHistory } from './aiActionQueueService';

const PACKS_KEY = '@vasco_workflow_packs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  trigger: string;           // When this happens
  delayDays: number;         // Wait X days
  action: string;            // Do this
  channel: 'email' | 'sms' | 'push' | 'in_app';
  template: string;          // Message template
}

export interface WorkflowPack {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'billing' | 'quotes' | 'maintenance' | 'admin' | 'customer';
  steps: WorkflowStep[];
  enabled: boolean;
  customizable: boolean;     // Can user edit timing/templates?
}

// ---------------------------------------------------------------------------
// Pre-built packs — opinionated defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PACKS: WorkflowPack[] = [
  {
    id: 'incasso_auto',
    name: 'Incasso Automatisch',
    description: 'Automatische betaalherinneringen na 3, 7, 14 en 30 dagen',
    icon: 'cash-outline',
    category: 'billing',
    customizable: true,
    enabled: true,
    steps: [
      { trigger: 'invoice_sent', delayDays: -3, action: 'send_pre_reminder', channel: 'email', template: 'Beste {{customer}}, uw factuur {{invoice}} van €{{amount}} vervalt over 3 dagen.' },
      { trigger: 'invoice_overdue', delayDays: 3, action: 'send_friendly_reminder', channel: 'email', template: 'Beste {{customer}}, dit is een vriendelijke herinnering voor factuur {{invoice}} van €{{amount}}.' },
      { trigger: 'invoice_overdue', delayDays: 7, action: 'send_reminder', channel: 'email', template: 'Beste {{customer}}, uw factuur {{invoice}} van €{{amount}} is 7 dagen over de vervaldatum.' },
      { trigger: 'invoice_overdue', delayDays: 14, action: 'send_urgent_reminder', channel: 'sms', template: 'Herinnering: factuur {{invoice}} €{{amount}} is 14 dagen achterstallig. Gelieve direct te betalen.' },
      { trigger: 'invoice_overdue', delayDays: 30, action: 'send_final_notice', channel: 'email', template: 'Laatste herinnering: factuur {{invoice}} is 30 dagen achterstallig. Zonder betaling binnen 7 dagen starten we incasso.' },
    ],
  },
  {
    id: 'offerte_opvolging',
    name: 'Offerte Opvolging',
    description: 'Automatisch opvolgen na 3 en 7 dagen zonder reactie',
    icon: 'document-text-outline',
    category: 'quotes',
    customizable: true,
    enabled: true,
    steps: [
      { trigger: 'quote_sent', delayDays: 3, action: 'send_quote_followup', channel: 'email', template: 'Beste {{customer}}, heeft u de offerte voor {{job}} van €{{amount}} kunnen bekijken? Ik hoor graag van u.' },
      { trigger: 'quote_sent', delayDays: 7, action: 'send_quote_reminder', channel: 'email', template: 'Beste {{customer}}, ter herinnering: de offerte voor {{job}} is nog 7 dagen geldig. Laat u het weten als u vragen heeft?' },
    ],
  },
  {
    id: 'onderhoud_herinnering',
    name: 'Onderhoud Herinnering',
    description: 'Jaarlijks herinnering aan klanten voor onderhoud',
    icon: 'calendar-outline',
    category: 'maintenance',
    customizable: true,
    enabled: true,
    steps: [
      { trigger: 'job_completed', delayDays: 335, action: 'send_maintenance_reminder', channel: 'email', template: 'Beste {{customer}}, het is bijna een jaar geleden dat we {{job}} voor u hebben uitgevoerd. Tijd voor onderhoud?' },
      { trigger: 'job_completed', delayDays: 365, action: 'send_maintenance_followup', channel: 'sms', template: 'Herinnering: tijd voor jaarlijks onderhoud. Bel ons op {{phone}} voor een afspraak.' },
    ],
  },
  {
    id: 'einde_dag',
    name: 'Einde Dag Routine',
    description: 'Automatisch uren loggen, taken controleren, morgen voorbereiden',
    icon: 'moon-outline',
    category: 'admin',
    customizable: false,
    enabled: true,
    steps: [
      { trigger: 'daily_17:00', delayDays: 0, action: 'auto_log_hours', channel: 'in_app', template: 'Uren vandaag: {{hours}}u gewerkt op {{jobCount}} klussen.' },
      { trigger: 'daily_17:00', delayDays: 0, action: 'flag_incomplete_jobs', channel: 'push', template: '{{count}} klussen nog niet afgerond vandaag.' },
      { trigger: 'daily_17:00', delayDays: 0, action: 'prep_tomorrow', channel: 'in_app', template: 'Morgen: {{tomorrowJobs}} klussen gepland.' },
    ],
  },
  {
    id: 'nieuw_klant_welkom',
    name: 'Nieuw Klant Welkom',
    description: 'Automatisch welkomstbericht + tijdlijn na eerste offerte',
    icon: 'heart-outline',
    category: 'customer',
    customizable: true,
    enabled: true,
    steps: [
      { trigger: 'quote_accepted', delayDays: 0, action: 'send_welcome', channel: 'email', template: 'Welkom {{customer}}! Bedankt voor uw vertrouwen. Uw project {{job}} staat ingepland. U kunt de voortgang volgen via uw klantportaal.' },
      { trigger: 'job_started', delayDays: 0, action: 'send_start_notification', channel: 'sms', template: 'Goed nieuws: we zijn begonnen met {{job}}! Verwachte oplevering: {{endDate}}.' },
    ],
  },
  {
    id: 'klant_keuze_herinnering',
    name: 'Klant Keuze Herinnering',
    description: 'Herinner klanten aan openstaande keuzes na 3 en 7 dagen',
    icon: 'help-circle-outline',
    category: 'customer',
    customizable: true,
    enabled: false,
    steps: [
      { trigger: 'decision_pending', delayDays: 3, action: 'send_decision_reminder', channel: 'email', template: 'Beste {{customer}}, u heeft nog openstaande keuzes voor {{project}}. Laat het ons weten zodat we verder kunnen.' },
      { trigger: 'decision_pending', delayDays: 7, action: 'send_decision_urgent', channel: 'sms', template: '{{customer}}, uw keuzes voor {{project}} zijn nodig om vertraging te voorkomen. Reageer alstublieft vandaag.' },
    ],
  },
  {
    id: 'inkoop_automatisch',
    name: 'Inkoop Automatisch',
    description: 'Melding bij lage voorraad, prijsdalingen en bestelkansen',
    icon: 'cart-outline',
    category: 'admin',
    customizable: true,
    enabled: false,
    steps: [
      { trigger: 'stock_low', delayDays: 0, action: 'send_reorder_alert', channel: 'push', template: '{{material}} bijna op ({{stock}} over). Bestel bij {{supplier}} voor €{{price}}/stuk.' },
      { trigger: 'price_drop', delayDays: 0, action: 'send_price_alert', channel: 'in_app', template: '{{material}} is {{pct}}% goedkoper bij {{supplier}}. Bespaar €{{savings}} per bestelling.' },
      { trigger: 'bulk_opportunity', delayDays: 0, action: 'send_bulk_alert', channel: 'push', template: 'Combineer bestellingen voor {{material}} over {{jobCount}} klussen — bespaar €{{savings}} met bulkkorting.' },
    ],
  },
  {
    id: 'dagelijkse_update',
    name: 'Dagelijkse Klant Update',
    description: 'Automatisch voortgangsbericht naar klant na werkdag op klus',
    icon: 'chatbubble-outline',
    category: 'customer',
    customizable: true,
    enabled: true,
    steps: [
      { trigger: 'job_clockout', delayDays: 0, action: 'send_progress_note', channel: 'sms', template: 'Hi {{customer}}, update: {{hours}}u gewerkt aan {{job}} vandaag. Alles op schema. Vragen? Laat het weten!' },
    ],
  },
  {
    id: 'oplevering_pakket',
    name: 'Oplevering Pakket',
    description: "Automatisch opleveringspakket na afronding klus (foto's, uren, materialen)",
    icon: 'folder-open-outline',
    category: 'admin',
    customizable: false,
    enabled: true,
    steps: [
      { trigger: 'job_completed', delayDays: 0, action: 'prepare_handover', channel: 'in_app', template: "Opleveringspakket klaar: {{photoCount}} foto's, {{hours}}u gewerkt. Verstuur naar {{customer}}." },
      { trigger: 'job_completed', delayDays: 7, action: 'send_satisfaction_survey', channel: 'sms', template: 'Hi {{customer}}, hoe was je ervaring met {{job}}? Je feedback helpt ons verbeteren!' },
    ],
  },
  {
    id: 'vergunning_check',
    name: 'Vergunning & Permit Check',
    description: 'Automatisch controleren van vereiste vergunningen per land bij nieuwe klus',
    icon: 'shield-checkmark-outline',
    category: 'admin',
    customizable: false,
    enabled: true,
    steps: [
      { trigger: 'job_created', delayDays: 0, action: 'check_permits', channel: 'in_app', template: 'Vergunningscheck voor {{job}}: {{permitCount}} vereisten gevonden voor {{country}}.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function getWorkflowPacks(): Promise<WorkflowPack[]> {
  try {
    const raw = await AsyncStorage.getItem(PACKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PACKS;
}

export async function saveWorkflowPacks(packs: WorkflowPack[]): Promise<void> {
  await AsyncStorage.setItem(PACKS_KEY, JSON.stringify(packs)).catch(() => {});
}

export async function togglePack(packId: string, enabled: boolean): Promise<void> {
  const packs = await getWorkflowPacks();
  const pack = packs.find(p => p.id === packId);
  if (pack) {
    pack.enabled = enabled;
    await saveWorkflowPacks(packs);
  }
}

export async function updatePackStep(packId: string, stepIndex: number, updates: Partial<WorkflowStep>): Promise<void> {
  const packs = await getWorkflowPacks();
  const pack = packs.find(p => p.id === packId);
  if (pack && pack.steps[stepIndex]) {
    pack.steps[stepIndex] = { ...pack.steps[stepIndex], ...updates };
    await saveWorkflowPacks(packs);
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useWorkflowPacks() {
  const [packs, setPacks] = useState<WorkflowPack[]>(DEFAULT_PACKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkflowPacks().then(setPacks).finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(async (packId: string, enabled: boolean) => {
    await togglePack(packId, enabled);
    setPacks(prev => prev.map(p => p.id === packId ? { ...p, enabled } : p));
  }, []);

  const enabledCount = packs.filter(p => p.enabled).length;

  return { packs, loading, toggle, enabledCount };
}

// ---------------------------------------------------------------------------
// ROI calculation — compute return on investment per pack from queue history
// ---------------------------------------------------------------------------

export async function getPackROI(packId: string): Promise<{
  actionsTriggered: number;
  actionsApproved: number;
  estimatedRevenue: number;
  estimatedTimeSaved: number; // minutes
}> {
  const history = await getQueueHistory();
  const packActions = history.filter(h => h.sourceGeneratorId === `workflow_${packId}`);
  const approved = packActions.filter(h => h.status === 'approved');
  // Estimate revenue from approved invoice/reminder actions
  const revenue = approved.reduce((sum, a) => {
    if (a.type === 'draft_invoice') return sum + (a.preparedData?.amount ?? 0);
    if (a.type === 'draft_reminder') return sum + (a.preparedData?.amount ?? 0) * 0.3; // 30% recovery rate
    return sum;
  }, 0);
  return {
    actionsTriggered: packActions.length,
    actionsApproved: approved.length,
    estimatedRevenue: Math.round(revenue),
    estimatedTimeSaved: approved.length * 5, // 5 min saved per automated action
  };
}

// ---------------------------------------------------------------------------
// Pack execution check — called periodically by automationService
// ---------------------------------------------------------------------------

export async function getActiveAutomations(): Promise<{
  packId: string;
  packName: string;
  pendingActions: { action: string; template: string; scheduledFor: string }[];
}[]> {
  const packs = await getWorkflowPacks();
  return packs
    .filter(p => p.enabled)
    .map(p => ({
      packId: p.id,
      packName: p.name,
      pendingActions: [],
    }));
}

// ---------------------------------------------------------------------------
// TRIGGER EVALUATION — check real data against enabled pack triggers
// ---------------------------------------------------------------------------
// Called on app open alongside populateQueue(). Evaluates each enabled pack's
// trigger conditions against actual jobs/invoices/quotes and queues matching
// actions into the AI Action Queue for one-tap approval.
// ---------------------------------------------------------------------------

interface TriggerContext {
  invoices: Array<{ id: string; status?: string; amount?: number; total?: number; customer?: string; customerId?: string; sentAt?: string; createdAt?: string; lastUpdated?: string; dueDate?: string }>;
  quotes: Array<{ id: string; status?: string; amount?: number; customer?: string; customerId?: string; sentAt?: string; createdAt?: string; lastUpdated?: string; description?: string; job?: string }>;
  jobs: Array<{ id: string; status?: string; title?: string; customerId?: string | null; completedAt?: string; lastUpdated?: string }>;
  customers: Array<{ id: string; name?: string }>;
}

export async function evaluateTriggers(context: TriggerContext): Promise<number> {
  const packs = await getWorkflowPacks();
  const enabledPacks = packs.filter(p => p.enabled);
  const now = Date.now();
  let queued = 0;

  for (const pack of enabledPacks) {
    for (const step of pack.steps) {
      const matches = matchTrigger(step, context, now);
      for (const match of matches.slice(0, 2)) { // Max 2 per step to avoid queue spam
        try {
          const resolved = resolveTemplate(step.template, match);
          const id = await addToQueue({
            type: mapActionToQueueType(step.action),
            title: `${pack.name}: ${match.label || ''}`,
            description: resolved.slice(0, 100),
            preparedData: {
              template: resolved,
              channel: step.channel,
              customerId: match.customerId,
              entityId: match.entityId,
              packId: pack.id,
            },
            actionLabel: step.channel === 'email' || step.channel === 'sms' ? i18n.t('workflow.send') : i18n.t('workflow.view'),
            estimatedImpact: getImpactEstimate(step.action),
            expiresAt: new Date(now + 5 * MS_PER_DAY).toISOString(),
            sourceGeneratorId: `workflow_${pack.id}`,
          });
          if (id) queued++;
        } catch {
          // Skip this match if addToQueue fails — don't block other triggers
        }
      }
    }
  }
  return queued;
}

function matchTrigger(
  step: WorkflowStep,
  ctx: TriggerContext,
  now: number,
): { label: string; customerId?: string; entityId?: string; customer?: string; amount?: number; job?: string; invoice?: string }[] {
  const dayMs = MS_PER_DAY;
  // 2-day window so triggers aren't missed if the app isn't opened for a day
  const windowMs = 2 * dayMs;
  const results: { label: string; customerId?: string; entityId?: string; customer?: string; amount?: number; job?: string; invoice?: string }[] = [];

  switch (step.trigger) {
    case 'invoice_sent': {
      // Invoices sent X days ago (delayDays < 0 means before due date)
      const targetAge = Math.abs(step.delayDays) * dayMs;
      for (const inv of ctx.invoices) {
        if (!inv || inv.status !== 'sent') continue;
        const sentAt = new Date(inv.sentAt || inv.createdAt || inv.lastUpdated || '').getTime();
        if (!sentAt || isNaN(sentAt)) continue;
        const age = now - sentAt;
        if (age >= targetAge && age < targetAge + windowMs) {
          const cust = (ctx.customers ?? []).find((c: any) => c.id === inv.customerId);
          results.push({
            label: cust?.name || inv.customer || inv.id || '',
            customerId: inv.customerId,
            entityId: inv.id,
            customer: cust?.name || inv.customer || '',
            amount: inv.amount || inv.total || 0,
            invoice: inv.id || '',
          });
        }
      }
      break;
    }
    case 'invoice_overdue': {
      const targetAge = step.delayDays * dayMs;
      for (const inv of ctx.invoices) {
        if (!inv || inv.status !== 'overdue') continue;
        const dueAt = new Date(inv.dueDate || '').getTime();
        if (!dueAt || isNaN(dueAt)) continue;
        const overdueDays = now - dueAt;
        if (overdueDays >= targetAge && overdueDays < targetAge + windowMs) {
          const cust = (ctx.customers ?? []).find((c: any) => c.id === inv.customerId);
          results.push({
            label: cust?.name || inv.customer || inv.id || '',
            customerId: inv.customerId,
            entityId: inv.id,
            customer: cust?.name || inv.customer || '',
            amount: inv.amount || inv.total || 0,
            invoice: inv.id || '',
          });
        }
      }
      break;
    }
    case 'quote_sent': {
      const targetAge = step.delayDays * dayMs;
      for (const q of ctx.quotes) {
        if (!q || q.status !== 'sent') continue;
        const sentAt = new Date(q.sentAt || q.createdAt || q.lastUpdated || '').getTime();
        if (!sentAt || isNaN(sentAt)) continue;
        const age = now - sentAt;
        if (age >= targetAge && age < targetAge + windowMs) {
          const cust = (ctx.customers ?? []).find((c: any) => c.id === q.customerId);
          results.push({
            label: cust?.name || q.customer || q.id || '',
            customerId: q.customerId,
            entityId: q.id,
            customer: cust?.name || q.customer || '',
            amount: q.amount ?? 0,
            job: q.description || q.job || '',
          });
        }
      }
      break;
    }
    case 'job_completed': {
      const targetAge = step.delayDays * dayMs;
      for (const job of ctx.jobs) {
        if (!job || (job.status !== 'completed' && job.status !== 'gereed')) continue;
        const completedAt = new Date(job.completedAt || job.lastUpdated || '').getTime();
        if (!completedAt || isNaN(completedAt)) continue;
        const age = now - completedAt;
        if (age >= targetAge && age < targetAge + windowMs) {
          const cust = (ctx.customers ?? []).find((c: any) => c.id === job.customerId);
          results.push({
            label: cust?.name || job.title || '',
            customerId: job.customerId ?? undefined,
            entityId: job.id,
            customer: cust?.name || '',
            job: job.title || '',
          });
        }
      }
      break;
    }
    // daily_17:00 and decision_pending handled by background scheduler
  }
  return results;
}

function resolveTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === null) return '';
    if (typeof val === 'number') return val.toLocaleString(undefined);
    return String(val);
  });
}

function mapActionToQueueType(action: string): import('./aiActionQueueService').QueueItemType {
  if (action.includes('progress_note') || action.includes('progress')) return 'progress_note';
  if (action.includes('handover') || action.includes('prepare_handover')) return 'job_handover';
  if (action.includes('satisfaction') || action.includes('survey')) return 'satisfaction_survey';
  if (action.includes('permit') || action.includes('check_permits')) return 'permit_check';
  if (action.includes('reminder') || action.includes('notice')) return 'draft_reminder';
  if (action.includes('followup') || action.includes('follow')) return 'draft_followup';
  if (action.includes('maintenance')) return 'maintenance_due';
  if (action.includes('welcome') || action.includes('start')) return 'draft_followup';
  if (action.includes('reorder')) return 'reorder_materials';
  if (action.includes('price')) return 'price_alert';
  if (action.includes('decision')) return 'decision_reminder';
  return 'draft_followup';
}

function getImpactEstimate(action: string): string {
  const t = i18n.t.bind(i18n);
  if (action.includes('progress')) return t('workflow.customerSatisfaction');
  if (action.includes('handover')) return t('workflow.professionalFinish', 'Professional finish');
  if (action.includes('satisfaction')) return t('workflow.buildsReputation', 'Builds reputation');
  if (action.includes('permit')) return t('workflow.staysCompliant', 'Stays compliant');
  if (action.includes('reminder') || action.includes('notice')) return t('workflow.speedsUpPayment');
  if (action.includes('followup') || action.includes('quote')) return t('workflow.increasesAcceptance');
  if (action.includes('maintenance')) return t('workflow.recurringWork');
  if (action.includes('welcome') || action.includes('start')) return t('workflow.customerSatisfaction');
  if (action.includes('reorder')) return t('workflow.preventsDelay');
  return t('workflow.savesTime');
}
