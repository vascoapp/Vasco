// =============================================================================
// WORKFLOW PACK SERVICE — Pre-built "set it and forget it" automations
// =============================================================================
// Contractors opt in to workflow packs during onboarding or in settings.
// Each pack is a collection of automated triggers → actions.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

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
      pendingActions: [], // Would be populated by checking trigger conditions against real data
    }));
}
