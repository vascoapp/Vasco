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
import { addToQueue, getQueueHistory, getRequiredPermits } from './aiActionQueueService';
import { getCurrentCountry, getCurrentUserId } from '../lib/currentUser';
import { loadSubscription, getTierLimits } from './subscriptionService';
import { getAppStateSnapshot } from '../state/appStateSnapshot';
import { emitPackQueued } from '../intelligence/dataCollector';
import type { Country } from '../i18n/formatting';
import { formatDecimal1, formatCurrency, formatMoney2 } from '../i18n/formatting';
import { localDateKey } from '../utils/dateKey';

const PACKS_KEY = '@vasco_workflow_packs';
const MUTES_KEY = '@vasco_pack_mutes';

// ---------------------------------------------------------------------------
// Per-customer / per-entity mutes (R66r49 #6)
// ---------------------------------------------------------------------------
// Lets contractors silence a specific customer/invoice/quote for a given pack
// without disabling the whole pack. Common cases: "Mr. de Vries always pays
// in cash on Friday — stop reminding him" / "this quote is dead, stop the
// 7d follow-up." Without this escape valve, contractors disable the pack
// outright after one annoying repeat.
//
// Storage shape: `{ ${packId}|${customerId}|${entityId}: muted_until_iso }`.
// Use `'*'` for `customerId` or `entityId` to mute across the whole axis.
// Default mute window: 90 days. Past `muted_until` the entry expires.
// ---------------------------------------------------------------------------

export interface PackMute {
  packId: string;       // workflow pack id, or '*' to mute across all packs
  customerId?: string;  // specific customer, or '*' for any
  entityId?: string;    // specific invoice/quote/job, or '*' for any
  mutedUntil: string;   // ISO timestamp
  reason?: string;      // free-text label, surfaced in the mute admin UI
}

function muteKey(m: { packId: string; customerId?: string; entityId?: string }): string {
  return `${m.packId}|${m.customerId ?? '*'}|${m.entityId ?? '*'}`;
}

export async function getPackMutes(): Promise<Record<string, PackMute>> {
  try {
    const raw = await AsyncStorage.getItem(MUTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PackMute>;
    // Auto-prune expired mutes so the storage doesn't grow indefinitely.
    const now = Date.now();
    let pruned = false;
    for (const [k, v] of Object.entries(parsed)) {
      if (Date.parse(v.mutedUntil) < now) {
        delete parsed[k];
        pruned = true;
      }
    }
    if (pruned) AsyncStorage.setItem(MUTES_KEY, JSON.stringify(parsed)).catch(() => {});
    return parsed;
  } catch {
    return {};
  }
}

export async function addPackMute(mute: PackMute): Promise<void> {
  const all = await getPackMutes();
  all[muteKey(mute)] = mute;
  await AsyncStorage.setItem(MUTES_KEY, JSON.stringify(all)).catch(() => {});
}

export async function removePackMute(mute: { packId: string; customerId?: string; entityId?: string }): Promise<void> {
  const all = await getPackMutes();
  delete all[muteKey(mute)];
  await AsyncStorage.setItem(MUTES_KEY, JSON.stringify(all)).catch(() => {});
}

/** Default mute action: silence this pack for this customer for 90 days. */
export async function muteCustomerForPack(packId: string, customerId: string, days = 90): Promise<void> {
  const mutedUntil = new Date(Date.now() + days * MS_PER_DAY).toISOString();
  await addPackMute({ packId, customerId, mutedUntil, reason: 'manual_mute_customer' });
}

// ---------------------------------------------------------------------------
// Pack discovery hooks (R66r49 #6)
// ---------------------------------------------------------------------------
// Decisions pack ships OFF by default; Incasso ships ON by default but
// freshly-onboarded contractors don't realize it's about to fire when
// their first invoice goes out. Hooking suggestions to the natural value
// moments solves the discovery problem without spam:
//   - markInvoiceSent → suggest Incasso ("auto-remind customers when overdue?")
//   - first decision tracker created → suggest Decisions ("auto-nudge for unanswered choices?")
// Each suggestion fires at most once per contractor per pack (AsyncStorage gate).
// ---------------------------------------------------------------------------

const PACK_SUGGESTED_PREFIX = '@vasco_pack_suggested_';

export async function hasSuggestedPack(packId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PACK_SUGGESTED_PREFIX + packId)) === '1';
  } catch {
    return false;
  }
}

export async function markPackSuggested(packId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PACK_SUGGESTED_PREFIX + packId, '1');
  } catch {}
}

/** Fires a notification suggesting a pack the first time the trigger value
 *  moment occurs. Idempotent — subsequent calls no-op. The notification
 *  deep-links to /contractor/automations where the contractor can toggle. */
export async function suggestPackIfFirstTime(args: {
  packId: string;
  title: string;
  body: string;
}): Promise<boolean> {
  if (await hasSuggestedPack(args.packId)) return false;
  await markPackSuggested(args.packId);
  try {
    const { fireNotification } = await import('./notificationService');
    fireNotification('general', 'low', args.title, args.body, '/contractor/automations');
  } catch {}
  return true;
}

/** @internal exported for unit testing — see workflowPackHelpers.test.ts */
export function isMatchMuted(mutes: Record<string, PackMute>, packId: string, customerId?: string, entityId?: string): boolean {
  // Check 4 increasingly-specific keys: any, by-customer, by-entity, by-both.
  const keys = [
    `*|*|*`,
    `${packId}|*|*`,
    `${packId}|${customerId ?? '*'}|*`,
    `${packId}|*|${entityId ?? '*'}`,
    `${packId}|${customerId ?? '*'}|${entityId ?? '*'}`,
  ];
  return keys.some((k) => Boolean(mutes[k]));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LocaleCode = 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it';

export interface WorkflowStep {
  trigger: string;           // When this happens
  delayDays: number;         // Wait X days
  action: string;            // Do this
  channel: 'email' | 'sms' | 'push' | 'in_app';
  /** Literal message template — used as fallback when i18nKey not resolvable
   *  AND when the contractor has customized the copy. NL by default. */
  template: string;
  /** Optional i18n key under `workflowPacks.*`. When set, evaluateTriggers
   *  resolves this against the contractor's locale at run time, so a DE
   *  contractor gets German default copy instead of Dutch. Customizing
   *  the pack swaps to the literal `template` field. */
  i18nKey?: string;
  /** R66r49 #5: optional locale-keyed literal defaults. Used when
   *  i18n.t(i18nKey) returns the key unchanged (translation missing).
   *  Without this, non-NL contractors fell back to the Dutch literal
   *  `template`. Order: i18nKey → defaults[locale] → template (NL). */
  defaults?: Partial<Record<LocaleCode, string>>;
  /** R66r49 #5: when true, this step's trigger isn't fired by `matchTrigger`
   *  on its own — another service (e.g. purchasingAgentService) is the
   *  upstream signal. Skipped silently in evaluateTriggers, kept in
   *  DEFAULT_PACKS for documentation + UI display. */
  deprecated?: boolean;
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
      // R66r49 #5: WhatsApp-friendly templates (no formal "Beste" salutation,
      // shorter, conversational), {{currency}} placeholder for UK contractors,
      // EU Directive 2011/7/EU statutory text on 14d + 30d (legal requirement
      // in NL/DE for enforceability of statutory interest + €40 recovery fee).
      {
        trigger: 'invoice_sent', delayDays: -3, action: 'send_pre_reminder', channel: 'email',
        i18nKey: 'workflowPacks.incasso.preReminder',
        template: 'Hi {{customer}}, factuur {{invoice}} ({{amount}}) vervalt over 3 dagen. Alvast bedankt!',
        defaults: {
          en: 'Hi {{customer}}, invoice {{invoice}} ({{amount}}) is due in 3 days. Thanks!',
          de: 'Hallo {{customer}}, Rechnung {{invoice}} ({{amount}}) ist in 3 Tagen fällig. Danke!',
          fr: 'Bonjour {{customer}}, la facture {{invoice}} ({{amount}}) arrive à échéance dans 3 jours. Merci !',
          es: 'Hola {{customer}}, la factura {{invoice}} ({{amount}}) vence en 3 días. ¡Gracias!',
          it: 'Ciao {{customer}}, la fattura {{invoice}} ({{amount}}) scade tra 3 giorni. Grazie!',
        },
      },
      {
        trigger: 'invoice_overdue', delayDays: 3, action: 'send_friendly_reminder', channel: 'email',
        i18nKey: 'workflowPacks.incasso.friendlyReminder',
        template: 'Hi {{customer}}, een vriendelijke herinnering: factuur {{invoice}} ({{amount}}) is 3 dagen over de vervaldatum. Vragen? Laat het weten.',
        defaults: {
          en: 'Hi {{customer}}, a friendly reminder: invoice {{invoice}} ({{amount}}) is 3 days overdue. Any questions, let me know.',
          de: 'Hallo {{customer}}, eine freundliche Erinnerung: Rechnung {{invoice}} ({{amount}}) ist 3 Tage überfällig. Bei Fragen melden Sie sich gerne.',
          fr: 'Bonjour {{customer}}, rappel amical : la facture {{invoice}} ({{amount}}) a 3 jours de retard. Une question ? Faites-moi signe.',
          es: 'Hola {{customer}}, recordatorio amable: la factura {{invoice}} ({{amount}}) lleva 3 días vencida. ¿Dudas? Avísame.',
          it: 'Ciao {{customer}}, promemoria amichevole: la fattura {{invoice}} ({{amount}}) è in ritardo di 3 giorni. Domande? Fammi sapere.',
        },
      },
      {
        trigger: 'invoice_overdue', delayDays: 7, action: 'send_reminder', channel: 'email',
        i18nKey: 'workflowPacks.incasso.reminder',
        template: 'Hi {{customer}}, factuur {{invoice}} ({{amount}}) staat al 7 dagen open. Mag ik je vragen deze deze week te voldoen?',
        defaults: {
          en: 'Hi {{customer}}, invoice {{invoice}} ({{amount}}) has been outstanding for 7 days. Could you settle it this week?',
          de: 'Hallo {{customer}}, Rechnung {{invoice}} ({{amount}}) ist seit 7 Tagen offen. Könnten Sie sie diese Woche begleichen?',
          fr: 'Bonjour {{customer}}, la facture {{invoice}} ({{amount}}) est impayée depuis 7 jours. Pouvez-vous régler cette semaine ?',
          es: 'Hola {{customer}}, la factura {{invoice}} ({{amount}}) lleva 7 días pendiente. ¿Podrías saldarla esta semana?',
          it: 'Ciao {{customer}}, la fattura {{invoice}} ({{amount}}) è in sospeso da 7 giorni. Puoi saldarla questa settimana?',
        },
      },
      {
        trigger: 'invoice_overdue', delayDays: 14, action: 'send_urgent_reminder', channel: 'sms',
        i18nKey: 'workflowPacks.incasso.urgentReminder',
        // EU Directive 2011/7/EU on combating late payment in commercial transactions:
        // statutory interest + €40 recovery fee accrue automatically once overdue.
        // Including the disclosure makes statutory recovery enforceable in NL/DE.
        template: 'Herinnering: factuur {{invoice}} ({{amount}}) is 14 dagen achterstallig. Conform EU Richtlijn 2011/7/EU brengen wij vanaf nu wettelijke rente + €40 incassokosten in rekening. Gelieve direct te betalen.',
        defaults: {
          en: 'Reminder: invoice {{invoice}} ({{amount}}) is 14 days overdue. Under EU Directive 2011/7/EU, statutory interest + €40 recovery fee now apply. Please pay immediately.',
          de: 'Erinnerung: Rechnung {{invoice}} ({{amount}}) ist 14 Tage überfällig. Gemäß EU-Richtlinie 2011/7/EU fallen ab jetzt gesetzliche Verzugszinsen + 40 € Mahnpauschale an. Bitte umgehend zahlen.',
          fr: 'Rappel : la facture {{invoice}} ({{amount}}) a 14 jours de retard. Conformément à la Directive UE 2011/7/UE, les intérêts légaux + 40 € de frais de recouvrement s\'appliquent désormais. Paiement immédiat svp.',
          es: 'Recordatorio: la factura {{invoice}} ({{amount}}) lleva 14 días vencida. Conforme a la Directiva UE 2011/7/UE, ahora aplican intereses legales + €40 de gastos de recuperación. Por favor, pague de inmediato.',
          it: 'Promemoria: la fattura {{invoice}} ({{amount}}) è in ritardo di 14 giorni. Ai sensi della Direttiva UE 2011/7/UE si applicano ora interessi di mora + €40 di indennizzo. Si prega di pagare subito.',
        },
      },
      {
        trigger: 'invoice_overdue', delayDays: 30, action: 'send_final_notice', channel: 'email',
        i18nKey: 'workflowPacks.incasso.finalNotice',
        template: 'Laatste herinnering: factuur {{invoice}} ({{amount}}) is 30 dagen achterstallig. Conform EU Richtlijn 2011/7/EU rekenen wij wettelijke rente + €40 incassokosten. Zonder betaling binnen 7 dagen geven wij de vordering uit handen aan een incassobureau, met bijkomende kosten voor uw rekening.',
        defaults: {
          en: 'Final notice: invoice {{invoice}} ({{amount}}) is 30 days overdue. Under EU Directive 2011/7/EU we charge statutory interest + €40 recovery fee. If unpaid in 7 days, we hand the claim to a debt collection agency at your additional cost.',
          de: 'Letzte Mahnung: Rechnung {{invoice}} ({{amount}}) ist 30 Tage überfällig. Gemäß EU-Richtlinie 2011/7/EU berechnen wir gesetzliche Verzugszinsen + 40 € Mahnpauschale. Ohne Zahlung innerhalb 7 Tagen geben wir die Forderung an ein Inkassobüro ab — Mehrkosten zu Ihren Lasten.',
          fr: 'Dernière relance : la facture {{invoice}} ({{amount}}) a 30 jours de retard. Conformément à la Directive UE 2011/7/UE, nous appliquons intérêts légaux + 40 € de frais de recouvrement. Sans paiement sous 7 jours, le dossier est transmis à un cabinet de recouvrement, frais supplémentaires à votre charge.',
          es: 'Aviso final: la factura {{invoice}} ({{amount}}) lleva 30 días vencida. Conforme a la Directiva UE 2011/7/UE aplicamos intereses legales + €40 de gastos. Sin pago en 7 días, traspasamos el cobro a una agencia de recuperación, con costes adicionales a su cargo.',
          it: 'Avviso finale: la fattura {{invoice}} ({{amount}}) è in ritardo di 30 giorni. Ai sensi della Direttiva UE 2011/7/UE applichiamo interessi di mora + €40 di indennizzo. Senza pagamento entro 7 giorni, trasmettiamo il credito a un\'agenzia di recupero, con costi aggiuntivi a carico vostro.',
        },
      },
    ],
  },
  {
    id: 'afspraak_herinnering',
    name: 'Afspraak Herinnering',
    description: "Herinner de klant een dag vooraf en bevestig 's ochtends dat je komt",
    icon: 'alarm-outline',
    category: 'customer',
    customizable: true,
    // ON by default. A customer who is not home is a wasted trip for the
    // contractor and the most common complaint about trades in general; every
    // comparable product (Jobber, Housecall Pro) sends these as standard, and
    // a contractor has to opt OUT of professional rather than in.
    enabled: true,
    steps: [
      {
        // delayDays is negative for job_scheduled: -1 = the day before.
        trigger: 'job_scheduled', delayDays: -1, action: 'send_appointment_reminder', channel: 'sms',
        i18nKey: 'workflowPacks.appointment.dayBefore',
        template: 'Hoi {{customer}}, morgen om {{time}} komen we langs voor {{job}}. Schikt dat nog?',
        defaults: {
          en: 'Hi {{customer}}, we are coming tomorrow at {{time}} for {{job}}. Does that still suit you?',
          de: 'Hallo {{customer}}, wir kommen morgen um {{time}} für {{job}}. Passt das noch?',
          fr: 'Bonjour {{customer}}, nous passons demain à {{time}} pour {{job}}. Cela vous convient toujours ?',
          es: 'Hola {{customer}}, pasamos mañana a las {{time}} para {{job}}. ¿Te sigue viniendo bien?',
          it: 'Ciao {{customer}}, passiamo domani alle {{time}} per {{job}}. Ti va ancora bene?',
        },
      },
      {
        trigger: 'job_scheduled', delayDays: 0, action: 'send_on_my_way', channel: 'sms',
        i18nKey: 'workflowPacks.appointment.morningOf',
        template: 'Goedemorgen {{customer}}, we komen vandaag om {{time}} voor {{job}}. Tot straks!',
        defaults: {
          en: 'Good morning {{customer}}, we are coming today at {{time}} for {{job}}. See you soon!',
          de: 'Guten Morgen {{customer}}, wir kommen heute um {{time}} für {{job}}. Bis gleich!',
          fr: 'Bonjour {{customer}}, nous venons aujourd\'hui à {{time}} pour {{job}}. À tout à l\'heure !',
          es: 'Buenos días {{customer}}, vamos hoy a las {{time}} para {{job}}. ¡Hasta ahora!',
          it: 'Buongiorno {{customer}}, veniamo oggi alle {{time}} per {{job}}. A presto!',
        },
      },
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
      {
        trigger: 'quote_sent', delayDays: 3, action: 'send_quote_followup', channel: 'email',
        i18nKey: 'workflowPacks.quoteFollowup.day3',
        template: 'Hi {{customer}}, lukt het om naar de offerte voor {{job}} ({{amount}}) te kijken? Hoor graag van je.',
        defaults: {
          en: 'Hi {{customer}}, did you get a chance to look at the quote for {{job}} ({{amount}})? Let me know what you think.',
          de: 'Hallo {{customer}}, konnten Sie das Angebot für {{job}} ({{amount}}) schon ansehen? Sagen Sie mir gerne Bescheid.',
          fr: 'Bonjour {{customer}}, avez-vous pu jeter un œil au devis pour {{job}} ({{amount}}) ? Dites-moi.',
          es: 'Hola {{customer}}, ¿pudiste ver el presupuesto de {{job}} ({{amount}})? Cuéntame.',
          it: 'Ciao {{customer}}, sei riuscito a dare un\'occhiata al preventivo per {{job}} ({{amount}})? Fammi sapere.',
        },
      },
      {
        trigger: 'quote_sent', delayDays: 7, action: 'send_quote_reminder', channel: 'email',
        i18nKey: 'workflowPacks.quoteFollowup.day7',
        template: 'Hi {{customer}}, korte reminder: de offerte voor {{job}} is nog 7 dagen geldig. Vragen? Bel of app me.',
        defaults: {
          en: 'Hi {{customer}}, quick reminder: the quote for {{job}} is valid for 7 more days. Any questions, call or message me.',
          de: 'Hallo {{customer}}, kurze Erinnerung: das Angebot für {{job}} ist noch 7 Tage gültig. Fragen? Ruf an oder schreib mir.',
          fr: 'Bonjour {{customer}}, petit rappel : le devis pour {{job}} est valide encore 7 jours. Une question ? Appelez ou envoyez un message.',
          es: 'Hola {{customer}}, recordatorio rápido: el presupuesto de {{job}} es válido 7 días más. ¿Dudas? Llámame o escríbeme.',
          it: 'Ciao {{customer}}, breve promemoria: il preventivo per {{job}} è valido ancora 7 giorni. Domande? Chiamami o scrivimi.',
        },
      },
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
      {
        trigger: 'job_completed', delayDays: 335, action: 'send_maintenance_reminder', channel: 'email',
        i18nKey: 'workflowPacks.maintenance.reminder',
        template: 'Hi {{customer}}, het is bijna een jaar geleden dat we {{job}} voor je deden. Tijd voor onderhoud — zal ik een afspraak inplannen?',
        defaults: {
          en: 'Hi {{customer}}, it\'s been almost a year since we did {{job}}. Time for maintenance — shall I schedule a visit?',
          de: 'Hallo {{customer}}, es ist fast ein Jahr her, dass wir {{job}} gemacht haben. Zeit für die Wartung — soll ich einen Termin einplanen?',
          fr: 'Bonjour {{customer}}, cela fait presque un an depuis {{job}}. C\'est l\'heure de l\'entretien — je vous prends rendez-vous ?',
          es: 'Hola {{customer}}, casi hace un año desde {{job}}. Toca mantenimiento — ¿te programo una visita?',
          it: 'Ciao {{customer}}, è passato quasi un anno da {{job}}. Tempo di manutenzione — fisso un appuntamento?',
        },
      },
      {
        trigger: 'job_completed', delayDays: 365, action: 'send_maintenance_followup', channel: 'sms',
        i18nKey: 'workflowPacks.maintenance.followup',
        template: 'Reminder: tijd voor het jaarlijkse onderhoud. Bel of app me op {{phone}} voor een afspraak.',
        defaults: {
          en: 'Reminder: time for your annual maintenance. Call or message me at {{phone}} to book.',
          de: 'Erinnerung: Zeit für die Jahreswartung. Ruf an oder schreib mir unter {{phone}} für einen Termin.',
          fr: 'Rappel : c\'est le moment de l\'entretien annuel. Appelez ou écrivez au {{phone}} pour fixer un rendez-vous.',
          es: 'Recordatorio: toca el mantenimiento anual. Llámame o escríbeme al {{phone}} para reservar.',
          it: 'Promemoria: tempo della manutenzione annuale. Chiama o scrivimi al {{phone}} per prenotare.',
        },
      },
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
      {
        trigger: 'daily_17:00', delayDays: 0, action: 'auto_log_hours', channel: 'in_app',
        i18nKey: 'workflowPacks.endOfDay.logHours',
        template: 'Uren vandaag: {{hours}}u gewerkt op {{jobCount}} klussen.',
        defaults: {
          en: 'Hours today: {{hours}}h on {{jobCount}} jobs.',
          de: 'Stunden heute: {{hours}}h auf {{jobCount}} Aufträgen.',
          fr: 'Heures aujourd\'hui : {{hours}}h sur {{jobCount}} chantiers.',
          es: 'Horas hoy: {{hours}}h en {{jobCount}} trabajos.',
          it: 'Ore oggi: {{hours}}h su {{jobCount}} lavori.',
        },
      },
      {
        trigger: 'daily_17:00', delayDays: 0, action: 'flag_incomplete_jobs', channel: 'push',
        i18nKey: 'workflowPacks.endOfDay.incompleteJobs',
        // Count AFTER a colon, deliberately. These strings are rendered by
        // resolveTemplate (plain {{}} substitution), NOT by i18next, so there
        // is no plural machinery available here — "{{count}} klussen" printed
        // "1 klussen" in the AI queue. Putting the number last sidesteps
        // noun agreement in every locale.
        template: 'Klussen niet afgerond vandaag: {{count}}',
        defaults: {
          en: 'Jobs not finished today: {{count}}',
          nl: 'Klussen niet afgerond vandaag: {{count}}',
          de: 'Heute nicht abgeschlossene Aufträge: {{count}}',
          fr: "Chantiers non terminés aujourd'hui : {{count}}",
          es: 'Trabajos sin terminar hoy: {{count}}',
          it: 'Lavori non completati oggi: {{count}}',
        },
      },
      {
        trigger: 'daily_17:00', delayDays: 0, action: 'prep_tomorrow', channel: 'in_app',
        i18nKey: 'workflowPacks.endOfDay.prepTomorrow',
        template: 'Morgen: {{tomorrowJobs}} klussen gepland.',
        defaults: {
          en: 'Tomorrow: {{tomorrowJobs}} jobs scheduled.',
          de: 'Morgen: {{tomorrowJobs}} Aufträge geplant.',
          fr: 'Demain : {{tomorrowJobs}} chantiers planifiés.',
          es: 'Mañana: {{tomorrowJobs}} trabajos programados.',
          it: 'Domani: {{tomorrowJobs}} lavori in programma.',
        },
      },
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
      {
        trigger: 'quote_accepted', delayDays: 0, action: 'send_welcome', channel: 'email',
        i18nKey: 'workflowPacks.newCustomer.welcome',
        // The first thing a new customer hears after saying yes. Warm and
        // explicitly grateful for the collaboration, not a scheduling notice.
        // Register per locale: informal nl/es/it, formal de/fr — customer-facing
        // copy keeps the same convention as the dunning templates.
        template: 'Welkom {{customer}}, en heel erg bedankt voor je vertrouwen! Ik vind het echt leuk dat we samen aan {{job}} gaan werken. Het staat ingepland en ik hou je onderweg op de hoogte — vragen mag je me altijd stellen.',
        defaults: {
          en: 'Welcome {{customer}}, and thank you so much for your trust! I\'m really glad we get to work together on {{job}}. It\'s scheduled, I\'ll keep you posted along the way, and you can always reach out with questions.',
          de: 'Willkommen {{customer}}, und ganz herzlichen Dank für Ihr Vertrauen! Ich freue mich sehr auf die Zusammenarbeit an {{job}}. Der Termin steht, ich halte Sie unterwegs auf dem Laufenden — bei Fragen melden Sie sich jederzeit.',
          fr: 'Bienvenue {{customer}}, et un grand merci pour votre confiance ! Je suis ravi de travailler avec vous sur {{job}}. C\'est planifié, je vous tiens au courant tout au long, et n\'hésitez pas si vous avez des questions.',
          es: 'Bienvenido {{customer}}, y muchísimas gracias por tu confianza. Me alegra mucho que trabajemos juntos en {{job}}. Ya está programado, te mantengo informado durante todo el proceso y puedes preguntarme lo que necesites.',
          it: 'Benvenuto {{customer}}, e grazie mille per la fiducia! Sono davvero contento di lavorare insieme a te su {{job}}. È in programma, ti tengo aggiornato lungo il percorso e per qualsiasi domanda sono qui.',
        },
      },
      {
        trigger: 'job_started', delayDays: 0, action: 'send_start_notification', channel: 'sms',
        i18nKey: 'workflowPacks.newCustomer.start',
        template: 'Goed nieuws: we zijn begonnen met {{job}}! Verwachte oplevering: {{endDate}}.',
        defaults: {
          en: 'Good news: we\'ve started {{job}}! Expected completion: {{endDate}}.',
          de: 'Gute Nachricht: wir haben mit {{job}} begonnen! Voraussichtliche Fertigstellung: {{endDate}}.',
          fr: 'Bonne nouvelle : nous avons commencé {{job}} ! Achèvement prévu : {{endDate}}.',
          es: 'Buenas noticias: hemos empezado {{job}}. Finalización prevista: {{endDate}}.',
          it: 'Buone notizie: abbiamo iniziato {{job}}! Completamento previsto: {{endDate}}.',
        },
      },
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
      {
        trigger: 'decision_pending', delayDays: 3, action: 'send_decision_reminder', channel: 'email',
        i18nKey: 'workflowPacks.decisions.reminder',
        template: 'Hi {{customer}}, er staan nog wat keuzes open voor {{project}}. Vul je ze even in dan gaan we door.',
        defaults: {
          en: 'Hi {{customer}}, you still have a few decisions pending for {{project}}. Fill them in so we can keep going.',
          de: 'Hallo {{customer}}, für {{project}} sind noch ein paar Entscheidungen offen. Tragen Sie sie ein, dann machen wir weiter.',
          fr: 'Bonjour {{customer}}, il reste quelques choix à faire pour {{project}}. Renseignez-les pour qu\'on avance.',
          es: 'Hola {{customer}}, faltan algunas decisiones para {{project}}. Rellénalas y seguimos.',
          it: 'Ciao {{customer}}, restano alcune scelte da fare per {{project}}. Compilale e proseguiamo.',
        },
      },
      {
        trigger: 'decision_pending', delayDays: 7, action: 'send_decision_urgent', channel: 'sms',
        i18nKey: 'workflowPacks.decisions.urgent',
        template: '{{customer}}, je keuzes voor {{project}} houden ons tegen — kun je vandaag reageren?',
        defaults: {
          en: '{{customer}}, your decisions for {{project}} are blocking us — can you reply today?',
          de: '{{customer}}, Ihre Entscheidungen für {{project}} blockieren uns — könnten Sie heute antworten?',
          fr: '{{customer}}, vos choix pour {{project}} nous bloquent — pouvez-vous répondre aujourd\'hui ?',
          es: '{{customer}}, tus decisiones de {{project}} nos están frenando — ¿puedes responder hoy?',
          it: '{{customer}}, le tue scelte per {{project}} ci stanno bloccando — puoi rispondere oggi?',
        },
      },
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
      // R66r49 #5: all 3 steps marked deprecated. The purchasingAgentService
      // (R46) queues stock_low / price_drop / bulk_opportunity directly into
      // the AI Action Queue when its scheduled tick runs against real
      // material_purchases data. Firing here too would double-queue and
      // pollute the moat with synthetic signals. Templates kept for UI
      // documentation; evaluateTriggers skips them.
      {
        trigger: 'stock_low', delayDays: 0, action: 'send_reorder_alert', channel: 'push',
        i18nKey: 'workflowPacks.purchasing.stockLow',
        template: '{{material}} bijna op ({{stock}} over). Bestel bij {{supplier}} voor {{price}}/stuk.',
        deprecated: true,
        defaults: {
          en: '{{material}} running low ({{stock}} left). Order from {{supplier}} at {{price}}/unit.',
          de: '{{material}} fast leer ({{stock}} übrig). Bestelle bei {{supplier}} für {{price}}/Stück.',
          fr: '{{material}} bientôt épuisé ({{stock}} restants). Commandez chez {{supplier}} à {{price}}/unité.',
          es: '{{material}} casi agotado ({{stock}} restantes). Pídelo a {{supplier}} a {{price}}/ud.',
          it: '{{material}} in esaurimento ({{stock}} rimasti). Ordina da {{supplier}} a {{price}}/pezzo.',
        },
      },
      {
        trigger: 'price_drop', delayDays: 0, action: 'send_price_alert', channel: 'in_app',
        i18nKey: 'workflowPacks.purchasing.priceDrop',
        template: '{{material}} is {{pct}}% goedkoper bij {{supplier}}. Bespaar {{savings}} per bestelling.',
        deprecated: true,
        defaults: {
          en: '{{material}} is {{pct}}% cheaper at {{supplier}}. Save {{savings}} per order.',
          de: '{{material}} ist bei {{supplier}} {{pct}}% günstiger. Spare {{savings}} pro Bestellung.',
          fr: '{{material}} est {{pct}}% moins cher chez {{supplier}}. Économisez {{savings}} par commande.',
          es: '{{material}} está {{pct}}% más barato en {{supplier}}. Ahorra {{savings}} por pedido.',
          it: '{{material}} è {{pct}}% più economico da {{supplier}}. Risparmia {{savings}} per ordine.',
        },
      },
      {
        trigger: 'bulk_opportunity', delayDays: 0, action: 'send_bulk_alert', channel: 'push',
        i18nKey: 'workflowPacks.purchasing.bulk',
        template: 'Combineer bestellingen voor {{material}} over {{jobCount}} klussen — bespaar {{savings}} met bulkkorting.',
        deprecated: true,
        defaults: {
          en: 'Combine {{material}} orders across {{jobCount}} jobs — save {{savings}} with bulk pricing.',
          de: 'Bestellungen für {{material}} über {{jobCount}} Aufträge bündeln — spare {{savings}} mit Mengenrabatt.',
          fr: 'Regroupez les commandes de {{material}} sur {{jobCount}} chantiers — économisez {{savings}} avec le tarif volume.',
          es: 'Agrupa pedidos de {{material}} en {{jobCount}} trabajos — ahorra {{savings}} con descuento por volumen.',
          it: 'Raggruppa ordini di {{material}} su {{jobCount}} lavori — risparmia {{savings}} con lo sconto quantità.',
        },
      },
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
      // R66r49 #5: deprecated until time_entries / clockout signal ships.
      // Pack stays visible (default OFF) but evaluateTriggers skips this
      // step. Re-enable when clockoutService starts emitting events.
      {
        trigger: 'job_clockout', delayDays: 0, action: 'send_progress_note', channel: 'sms',
        i18nKey: 'workflowPacks.dailyUpdate.progress',
        template: 'Hi {{customer}}, update: {{hours}}u gewerkt aan {{job}} vandaag. Alles op schema!',
        deprecated: true,
        defaults: {
          en: 'Hi {{customer}}, update: {{hours}}h on {{job}} today. All on track!',
          de: 'Hallo {{customer}}, Update: {{hours}}h an {{job}} heute. Alles im Plan!',
          fr: 'Bonjour {{customer}}, point : {{hours}}h sur {{job}} aujourd\'hui. Tout est en bonne voie !',
          es: 'Hola {{customer}}, novedades: {{hours}}h en {{job}} hoy. Todo en marcha.',
          it: 'Ciao {{customer}}, aggiornamento: {{hours}}h su {{job}} oggi. Tutto in linea!',
        },
      },
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
      {
        trigger: 'job_completed', delayDays: 0, action: 'prepare_handover', channel: 'in_app',
        i18nKey: 'workflowPacks.handover.ready',
        template: "Opleveringspakket klaar: {{photoCount}} foto's, {{hours}}u gewerkt. Verstuur naar {{customer}}.",
        defaults: {
          en: 'Handover package ready: {{photoCount}} photos, {{hours}}h logged. Send to {{customer}}.',
          de: 'Übergabepaket bereit: {{photoCount}} Fotos, {{hours}}h erfasst. An {{customer}} senden.',
          fr: 'Dossier de livraison prêt : {{photoCount}} photos, {{hours}}h enregistrées. Envoyer à {{customer}}.',
          es: 'Paquete de entrega listo: {{photoCount}} fotos, {{hours}}h registradas. Envíalo a {{customer}}.',
          it: 'Pacchetto consegna pronto: {{photoCount}} foto, {{hours}}h registrate. Invia a {{customer}}.',
        },
      },
      {
        trigger: 'job_completed', delayDays: 7, action: 'send_satisfaction_survey', channel: 'sms',
        i18nKey: 'workflowPacks.handover.survey',
        template: 'Hi {{customer}}, hoe was je ervaring met {{job}}? Een korte review op Google helpt mij enorm!',
        defaults: {
          en: 'Hi {{customer}}, how was your experience with {{job}}? A quick Google review helps me a ton!',
          de: 'Hallo {{customer}}, wie war Ihre Erfahrung mit {{job}}? Eine kurze Google-Bewertung hilft mir enorm!',
          fr: 'Bonjour {{customer}}, comment s\'est passé {{job}} ? Un avis rapide sur Google m\'aide beaucoup !',
          es: 'Hola {{customer}}, ¿qué tal {{job}}? Una reseña rápida en Google me ayudaría mucho.',
          it: 'Ciao {{customer}}, com\'è andato {{job}}? Una recensione veloce su Google mi aiuta tantissimo!',
        },
      },
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
      {
        trigger: 'job_created', delayDays: 0, action: 'check_permits', channel: 'in_app',
        i18nKey: 'workflowPacks.permits.check',
        template: 'Vergunningscheck voor {{job}}: {{permitCount}} vereisten gevonden voor {{country}}.',
        defaults: {
          en: 'Permit check for {{job}}: {{permitCount}} requirements found for {{country}}.',
          de: 'Genehmigungsprüfung für {{job}}: {{permitCount}} Anforderungen für {{country}} gefunden.',
          fr: 'Vérification des autorisations pour {{job}} : {{permitCount}} exigences trouvées pour {{country}}.',
          es: 'Comprobación de permisos para {{job}}: {{permitCount}} requisitos encontrados para {{country}}.',
          it: 'Verifica autorizzazioni per {{job}}: {{permitCount}} requisiti trovati per {{country}}.',
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pack display names — localised at render time, not at seed time
// ---------------------------------------------------------------------------
// The `name`/`description` literals above are hardcoded Dutch and were rendered
// raw, so an English/German/French contractor saw "Incasso Automatisch" and
// "Automatische betaalherinneringen na 3, 7, 14 en 30 dagen" sitting directly
// above their correctly-translated step labels ("After 3 days: Send friendly
// reminder"). Found by walking /contractor/automations on Android in English.
//
// Resolution is keyed off `pack.id`, deliberately NOT off a `nameKey` field on
// the pack object: packs are persisted to AsyncStorage, and `getWorkflowPacks`
// returns the STORED object for any id it already knows. Every contractor who
// has ever opened this screen therefore has a stored pack that predates this
// fix — a new field on the interface would be `undefined` for exactly the
// users who have the bug. The id survives round-tripping; a new field does not.
//
// The Dutch literal stays as the `defaultValue` so an unknown id (a pack added
// later without a matching namespace) degrades to the old behaviour instead of
// rendering a raw key.
// ---------------------------------------------------------------------------

export const PACK_I18N_NS: Record<string, string> = {
  incasso_auto: 'incasso',
  afspraak_herinnering: 'appointment',
  offerte_opvolging: 'quoteFollowup',
  onderhoud_herinnering: 'maintenance',
  einde_dag: 'endOfDay',
  nieuw_klant_welkom: 'newCustomer',
  klant_keuze_herinnering: 'decisions',
  inkoop_automatisch: 'purchasing',
  dagelijkse_update: 'dailyUpdate',
  oplevering_pakket: 'handover',
  vergunning_check: 'permits',
};

export function resolvePackName(pack: { id: string; name: string }): string {
  const ns = PACK_I18N_NS[pack.id];
  if (!ns) return pack.name;
  return i18n.t(`workflowPacks.${ns}.name`, { defaultValue: pack.name });
}

export function resolvePackDescription(pack: { id: string; description: string }): string {
  const ns = PACK_I18N_NS[pack.id];
  if (!ns) return pack.description;
  return i18n.t(`workflowPacks.${ns}.description`, { defaultValue: pack.description });
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function getWorkflowPacks(): Promise<WorkflowPack[]> {
  try {
    const raw = await AsyncStorage.getItem(PACKS_KEY);
    if (!raw) return DEFAULT_PACKS;
    const stored = JSON.parse(raw) as WorkflowPack[];
    // R66r49 #5: merge missing packs from DEFAULT_PACKS. Pre-fix, contractors
    // who saved their pack list before R306 (which added dailyUpdate /
    // handover / permits) had stale arrays missing those 3 newer packs —
    // toggling them was impossible because they didn't exist in storage.
    // Now: union by id, preserving the user's enabled state for known
    // packs, splicing in defaults (with their default `enabled`) for any
    // pack id present in DEFAULT_PACKS but missing from storage.
    const byId = new Map(stored.map((p) => [p.id, p]));
    // Cosmetic fields (name/description/icon/category) are refreshed from
    // DEFAULT_PACKS; user state (`enabled`) and edited `steps` are kept from
    // storage. Pre-fix this returned the stored object wholesale, so a stored
    // pack froze its presentation at whatever shipped the day the contractor
    // first opened the screen — a corrected description or a changed icon
    // reached new installs only. `steps` must NOT be refreshed: updatePackStep
    // persists per-step timing/channel edits into this same blob.
    const merged: WorkflowPack[] = DEFAULT_PACKS.map((d) => {
      const s = byId.get(d.id);
      return s
        ? { ...s, name: d.name, description: d.description, icon: d.icon, category: d.category }
        : d;
    });
    // If we added missing packs, write the merged list back so future reads
    // are stable (and a fresh JSON.parse of stored bytes returns all 10).
    if (merged.length !== stored.length) {
      AsyncStorage.setItem(PACKS_KEY, JSON.stringify(merged)).catch(() => {});
    }
    return merged;
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
// Pack health (R66r49 #7) — surface real signal instead of estimates
// ---------------------------------------------------------------------------
// Replaces the implicit "actionsApproved/actionsTriggered" math the UI was
// computing on the fly. Now also surfaces:
//   - approveRate / dismissRate (excluding still-pending so a fresh pack
//     doesn't read as 0% approve rate before the contractor has acted)
//   - mutedCustomerCount (specific to this pack)
//   - status: 'new' (<5 settled), 'healthy' (≥40% approve), 'low' (<40%)
// The 40% threshold is conservative — for customer-facing nudges,
// industry baseline is 30-50% so anything under 40% likely means the
// template needs work.
// ---------------------------------------------------------------------------

export type PackHealthStatus = 'new' | 'healthy' | 'low';

export interface PackHealth {
  packId: string;
  queued: number;
  approved: number;
  dismissed: number;
  pending: number;
  approveRate: number; // 0-1; excludes pending. 0 when nothing settled.
  dismissRate: number; // 0-1; excludes pending.
  mutedCustomerCount: number;
  lastQueuedAt: string | null;
  status: PackHealthStatus;
}

export async function getPackHealth(packId: string): Promise<PackHealth> {
  const history = await getQueueHistory();
  const packActions = history.filter((h) => h.sourceGeneratorId === `workflow_${packId}`);
  const approved = packActions.filter((h) => h.status === 'approved').length;
  const dismissed = packActions.filter((h) => h.status === 'rejected' || h.status === 'expired').length;
  const pending = packActions.filter((h) => h.status === 'pending').length;
  const settled = approved + dismissed;
  const approveRate = settled > 0 ? approved / settled : 0;
  const dismissRate = settled > 0 ? dismissed / settled : 0;
  const lastQueuedAt = packActions.length > 0
    ? packActions.map((h) => h.createdAt).sort().slice(-1)[0]
    : null;

  const mutes = await getPackMutes();
  const mutedCustomerCount = Object.values(mutes).filter(
    (m) => m.packId === packId && m.customerId && m.customerId !== '*',
  ).length;

  let status: PackHealthStatus;
  if (settled < 5) status = 'new';
  else if (approveRate >= 0.4) status = 'healthy';
  else status = 'low';

  return {
    packId,
    queued: packActions.length,
    approved,
    dismissed,
    pending,
    approveRate,
    dismissRate,
    mutedCustomerCount,
    lastQueuedAt,
    status,
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
      packName: resolvePackName(p),
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
  // `reference` / `invoiceNumber` are the human document numbers. They were
  // missing from this shape, which is why the templates fell back to `inv.id`
  // and sent a raw row id to customers — the type hid the mistake.
  invoices: Array<{ id: string; status?: string; amount?: number; total?: number; customer?: string; customerId?: string; sentAt?: string; createdAt?: string; lastUpdated?: string; dueDate?: string; reference?: string; invoiceNumber?: string }>;
  quotes: Array<{ id: string; status?: string; amount?: number; customer?: string; customerId?: string; sentAt?: string; createdAt?: string; lastUpdated?: string; description?: string; job?: string }>;
  // `scheduledDate` / `scheduledStartTime` were absent, which is why no pack
  // could fire BEFORE a visit — every trigger keyed off invoice/quote state or
  // a job that had already started or finished. The call site
  // (app/(contractor)/index.tsx) has always passed AppState jobs, which carry
  // both; only this type and the switch below omitted them.
  jobs: Array<{ id: string; status?: string; title?: string; customerId?: string | null; completedAt?: string; lastUpdated?: string; trade?: string; scheduledDate?: string; scheduledStartTime?: string; address?: unknown; actualHours?: number }>;
  // R66r49 #6: phone added so evaluateTriggers can resolve customer.phone →
  // E.164 → wa.me URL, queueing into preparedData.affiliateUrl. The shareable
  // executor branch then prefers Linking.openURL over Share.share when the
  // affiliateUrl is a wa.me link (1 tap to WhatsApp chat with text pre-filled
  // vs. 3 taps through the iOS share sheet).
  customers: Array<{ id: string; name?: string; phone?: string }>;
}

// R66r49 #5: country → currency symbol. UK contractors got € on £ amounts
// pre-fix because templates hardcoded `€{{amount}}`. Now `{{currency}}`
// resolves via this map, so a UK invoice reminder reads "£2,450.00"
// instead of "€2.450,00".
const COUNTRY_CURRENCY: Record<string, string> = {
  UK: '£', NL: '€', DE: '€', FR: '€', ES: '€', IT: '€',
};

function getContractorCurrency(country?: string): string {
  return COUNTRY_CURRENCY[country ?? 'NL'] ?? '€';
}

// R66r49 #6 (WhatsApp deep-link): country → E.164 country code. wa.me
// expects digits-only including country code, so a NL contractor's
// customer with phone "06 12345678" becomes "31612345678".
const COUNTRY_DIAL: Record<string, string> = {
  UK: '44', NL: '31', DE: '49', FR: '33', ES: '34', IT: '39',
};

/** @internal exported for unit testing — see workflowPackHelpers.test.ts */
export function toE164(phone: string | undefined, contractorCountry?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D+/g, '');
  if (!digits) return null;
  const dial = COUNTRY_DIAL[contractorCountry ?? 'NL'] ?? '31';
  if (digits.startsWith('00')) digits = digits.slice(2);            // 0031… → 31…
  else if (digits.startsWith('0')) digits = dial + digits.slice(1); // 0612… → 3161…
  else if (!digits.startsWith(dial) && digits.length <= 10) digits = dial + digits;
  return digits;
}

/** @internal exported for unit testing — see workflowPackHelpers.test.ts */
export function buildWhatsAppUrl(e164: string, message: string): string {
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

function getContractorLocale(): LocaleCode {
  const lang = (i18n.language ?? 'nl').slice(0, 2).toLowerCase();
  return (['nl', 'en', 'de', 'fr', 'es', 'it'].includes(lang) ? lang : 'nl') as LocaleCode;
}

/** @internal exported for unit testing — see workflowPackHelpers.test.ts */
export function pickTemplateForLocale(step: WorkflowStep, locale: LocaleCode): string {
  // R66r49 #5: priority is `defaults[locale] → i18nKey → step.template`.
  // The in-code `defaults` map wins over i18n because the i18n keys still
  // hold the pre-R49 templates (no {{currency}}, no EU 2011/7/EU text);
  // shipping the new copy via code beats waiting for translator review.
  // i18nKey kept as legacy fallback so older builds keep working.
  if (step.defaults?.[locale]) return step.defaults[locale]!;
  if (step.i18nKey) {
    const v = i18n.t(step.i18nKey, { defaultValue: '' });
    if (v && v !== step.i18nKey) return v;
  }
  return step.template;
}

export async function evaluateTriggers(context: TriggerContext): Promise<number> {
  // R66r49 #5: tier gate. Pre-fix, free contractors got all 10 packs queueing
  // items into their AI queue despite the freemium plan reserving automation
  // packs for Advanced+. `hasAutomationPacks` lives on TierLimits per
  // subscriptionService.ts:41 — read once per evaluation, fast no-op for
  // free-tier contractors.
  try {
    const sub = await loadSubscription();
    const limits = getTierLimits(sub.tier);
    if (!limits.hasAutomationPacks) return 0;
  } catch {
    // If subscription read fails, fall through (don't block paid contractors).
  }

  const packs = await getWorkflowPacks();
  const enabledPacks = packs.filter(p => p.enabled);
  const now = Date.now();
  const country = (getCurrentCountry() ?? 'NL') as Country;
  const currency = getContractorCurrency(country);
  const locale = getContractorLocale();

  // R66r49 #5: phone for {{phone}} interpolation in maintenance.followup.
  // Pre-fix the literal "{{phone}}" placeholder shipped to customers.
  // Read from currentUser BusinessProfile via app-state snapshot.
  let businessPhone = '';
  try {
    const snap = getAppStateSnapshot();
    businessPhone = (snap as any)?.businessProfile?.phone ?? '';
  } catch {}

  // R66r49 #5: hydrate decision_pending matches before the loop so the sync
  // matchTrigger can read them via the synthetic ctx field. Items with
  // status='pending' and a dueDate ≥ N days past today.
  try {
    const raw = await AsyncStorage.getItem('@vasco_decision_trackers');
    if (raw) {
      const trackers = JSON.parse(raw) as Array<any>;
      const pending: Array<{ trackerId: string; itemId: string; itemName: string; customer: string; project: string; daysOverdue: number }> = [];
      for (const tr of trackers) {
        if (tr.status !== 'active') continue;
        for (const cat of tr.categories ?? []) {
          for (const item of cat.items ?? []) {
            if (item.status !== 'pending') continue;
            const due = new Date(item.dueDate || '').getTime();
            if (!due || isNaN(due)) continue;
            const daysOverdue = Math.floor((now - due) / MS_PER_DAY);
            if (daysOverdue < 0) continue;
            pending.push({
              trackerId: tr.id,
              itemId: item.id,
              itemName: item.name,
              customer: tr.customerName,
              project: tr.templateName ?? cat.name,
              daysOverdue,
            });
          }
        }
      }
      (context as any).__pendingDecisions = pending;
    }
  } catch {}

  // R66r49 #5: per-day dedup gate for daily_17:00. Without this, every app
  // open after 17:00 would re-queue the einde_dag steps. Single AsyncStorage
  // key with the local YYYY-MM-DD; matches on this date skip the daily_17:00
  // step entirely.
  let dailyAlreadyFired = false;
  try {
    const today = localDateKey(new Date(now));
    const last = await AsyncStorage.getItem('@vasco_pack_daily_17_last_fired');
    if (last === today) dailyAlreadyFired = true;
  } catch {}

  // R66r49 #5: cross-pack dedup within a single evaluation tick. Pre-fix,
  // a customer with overdue invoice + active job + decision_pending could
  // get 3 simultaneous nudges (Incasso + Daily Update + Decisions). Now
  // we dedup by `${customerId}|${entityId}` so each customer-entity pair
  // queues at most once per run.
  const firedKeys = new Set<string>();
  // R66r49 #6: per-customer / per-entity mutes. Loaded once per run; mutes
  // the rare "stop nudging Mr. de Vries on this invoice" case without
  // forcing the contractor to disable the whole pack.
  const mutes = await getPackMutes();
  let queued = 0;
  let firedDailyThisRun = false;

  for (const pack of enabledPacks) {
    for (const step of pack.steps) {
      // R66r49 #5: skip dormant steps explicitly. `purchasingAgentService`
      // queues stock_low/price_drop/bulk_opportunity directly; firing them
      // here would double-queue. Other deprecated triggers have no
      // upstream signal yet (job_clockout — needs timesheet table).
      if (step.deprecated) continue;
      if (step.trigger === 'daily_17:00' && dailyAlreadyFired) continue;
      const matches = matchTrigger(step, context, now);
      for (const match of matches.slice(0, 2)) { // Max 2 per step to avoid queue spam
        const dedupKey = `${match.customerId ?? ''}|${match.entityId ?? ''}`;
        if (dedupKey !== '|' && firedKeys.has(dedupKey)) continue;
        if (isMatchMuted(mutes, pack.id, match.customerId, match.entityId)) continue;
        try {
          const baseTemplate = pickTemplateForLocale(step, locale);
          const resolved = resolveTemplate(baseTemplate, {
            ...match,
            currency,
            // Money slots format through Intl against the CONTRACTOR's country,
            // so the symbol sits where that market writes it.
            country,
            phone: businessPhone,
          });
          // R66r49 #6: WhatsApp deep-link wire. For customer-facing channels
          // (email/sms), if we have customer.phone, build a wa.me URL and
          // attach it as preparedData.affiliateUrl. queueItemExecutor's
          // shareable branch prefers Linking.openURL on this URL (1-tap
          // into WA Business chat) over the iOS share picker (3+ taps).
          let affiliateUrl: string | undefined;
          if ((step.channel === 'sms' || step.channel === 'email') && match.customerId) {
            const cust = context.customers?.find((c) => c.id === match.customerId);
            const e164 = toE164(cust?.phone, country);
            if (e164) affiliateUrl = buildWhatsAppUrl(e164, resolved);
          }

          const id = await addToQueue({
            type: mapActionToQueueType(step.action),
            title: `${resolvePackName(pack)}: ${match.label || ''}`,
            description: resolved.slice(0, 100),
            preparedData: {
              template: resolved,
              channel: step.channel,
              customerId: match.customerId,
              entityId: match.entityId,
              packId: pack.id,
              ...(affiliateUrl ? { affiliateUrl } : {}),
            },
            actionLabel: step.channel === 'email' || step.channel === 'sms' ? i18n.t('workflow.send') : i18n.t('workflow.view'),
            estimatedImpact: getImpactEstimate(step.action),
            expiresAt: new Date(now + 5 * MS_PER_DAY).toISOString(),
            sourceGeneratorId: `workflow_${pack.id}`,
          });
          if (id) {
            queued++;
            if (dedupKey !== '|') firedKeys.add(dedupKey);
            if (step.trigger === 'daily_17:00') firedDailyThisRun = true;
            // R66r49 #6: telemetry. emit fire-and-forget so a failed
            // emit doesn't break queueing.
            const uid = getCurrentUserId();
            if (uid && uid !== 'current-user') {
              emitPackQueued(uid, id, {
                packId: pack.id,
                stepIndex: pack.steps.indexOf(step),
                trigger: step.trigger,
                channel: step.channel,
                locale,
                customerId: match.customerId,
                entityId: match.entityId,
              }).catch(() => {});
            }
          }
        } catch {
          // Skip this match if addToQueue fails — don't block other triggers
        }
      }
    }
  }
  // Persist daily-fire timestamp so subsequent app opens today skip the
  // einde_dag steps. Cleared on day rollover (next day's slice() differs).
  if (firedDailyThisRun) {
    try {
      const today = localDateKey(new Date(now));
      await AsyncStorage.setItem('@vasco_pack_daily_17_last_fired', today);
    } catch {}
  }
  return queued;
}

function matchTrigger(
  step: WorkflowStep,
  ctx: TriggerContext,
  now: number,
): { label: string; customerId?: string; entityId?: string; customer?: string; amount?: number; job?: string; invoice?: string; permitCount?: number; country?: string; time?: string; date?: string }[] {
  const dayMs = MS_PER_DAY;
  // 2-day window so triggers aren't missed if the app isn't opened for a day
  const windowMs = 2 * dayMs;
  const results: { label: string; customerId?: string; entityId?: string; customer?: string; amount?: number; job?: string; invoice?: string; permitCount?: number; country?: string; time?: string; date?: string }[] = [];

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
            label: cust?.name || inv.customer || inv.reference || '',
            customerId: inv.customerId,
            entityId: inv.id,
            customer: cust?.name || inv.customer || '',
            amount: inv.amount || inv.total || 0,
            // CUSTOMER-FACING: this fills {{invoice}} in a WhatsApp/email body.
            // Must be the document number a customer can recognise — never the
            // row id (was sending "factuur inv-seed-1 is 14 dagen achterstallig").
            invoice: inv.reference || inv.invoiceNumber || '',
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
            label: cust?.name || inv.customer || inv.reference || '',
            customerId: inv.customerId,
            entityId: inv.id,
            customer: cust?.name || inv.customer || '',
            amount: inv.amount || inv.total || 0,
            // CUSTOMER-FACING: this fills {{invoice}} in a WhatsApp/email body.
            // Must be the document number a customer can recognise — never the
            // row id (was sending "factuur inv-seed-1 is 14 dagen achterstallig").
            invoice: inv.reference || inv.invoiceNumber || '',
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
            label: cust?.name || q.customer || q.job || '',
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
    case 'job_scheduled': {
      // Fires BEFORE the visit. `delayDays` is negative here and means "this
      // many days ahead": -1 is the day before, 0 is the morning of.
      //
      // Every other trigger in this switch looks backwards at something that
      // already happened. This one looks forward, which is what an appointment
      // reminder needs and why none existed.
      const daysAhead = Math.abs(step.delayDays);
      const today = new Date();
      const targetKey = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead);
      // Compare on the LOCAL calendar day. toISOString() would shift the day
      // between midnight and the UTC offset -- the same bug the werk/planning
      // split had (see localDateKey in utils/dateKey).
      const pad = (n: number) => String(n).padStart(2, '0');
      const wanted = `${targetKey.getFullYear()}-${pad(targetKey.getMonth() + 1)}-${pad(targetKey.getDate())}`;

      for (const job of ctx.jobs) {
        if (!job?.scheduledDate) continue;
        // Only work that is still going to happen. A cancelled or already
        // finished job must never trigger "see you tomorrow".
        if (job.status === 'cancelled' || job.status === 'completed') continue;
        if (job.scheduledDate.slice(0, 10) !== wanted) continue;

        const cust = (ctx.customers ?? []).find((c: any) => c.id === job.customerId);
        // No customer means nobody to remind; queueing it would produce an
        // action the contractor cannot send.
        if (!cust) continue;

        results.push({
          label: cust.name || job.title || '',
          customerId: job.customerId ?? undefined,
          entityId: job.id,
          customer: cust.name || '',
          job: job.title || '',
          // Customer-facing: the time they should expect someone, not a raw
          // timestamp. Falls back to the date alone when no start time is set.
          time: job.scheduledStartTime || '',
          date: job.scheduledDate.slice(0, 10),
        });
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
    // R306: 3 more trigger types added to close R6 dormancy gap. Six packs
    // had 0 firing triggers because their trigger types fell through this
    // switch silently (welcome / permits / decisions / etc.).
    case 'quote_accepted': {
      const targetAge = step.delayDays * dayMs;
      for (const q of ctx.quotes) {
        if (!q || q.status !== 'accepted') continue;
        const at = new Date((q as any).acceptedAt || q.lastUpdated || '').getTime();
        if (!at || isNaN(at)) continue;
        const age = now - at;
        if (age >= targetAge && age < targetAge + windowMs) {
          const cust = (ctx.customers ?? []).find((c: any) => c.id === q.customerId);
          results.push({
            label: cust?.name || q.customer || q.job || '',
            customerId: q.customerId,
            entityId: q.id,
            customer: cust?.name || q.customer || '',
            amount: q.amount || 0,
            job: q.job || q.description || '',
          });
        }
      }
      break;
    }
    case 'job_started': {
      const targetAge = step.delayDays * dayMs;
      for (const job of ctx.jobs) {
        if (!job || (job.status !== 'in-progress' && job.status !== 'bezig')) continue;
        const startedAt = new Date(job.lastUpdated || '').getTime();
        if (!startedAt || isNaN(startedAt)) continue;
        const age = now - startedAt;
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
    case 'job_created': {
      // Permit-check pack — fires on newly-created jobs (created within 2d window).
      const targetAge = step.delayDays * dayMs;
      const permitCountry = getCurrentCountry() ?? 'NL';
      for (const job of ctx.jobs) {
        if (!job) continue;
        const createdAt = new Date((job as any).createdAt || job.lastUpdated || '').getTime();
        if (!createdAt || isNaN(createdAt)) continue;
        const age = now - createdAt;
        if (age >= targetAge && age < targetAge + windowMs) {
          // The template reads "{{permitCount}} vereisten gevonden voor
          // {{country}}" — neither was supplied, so it rendered as the
          // half-sentence "…: vereisten gevonden voor." Supply both, and skip
          // the card entirely when no permits apply rather than announcing a
          // permit check that found nothing (mirrors the automation_permit_check
          // producer in aiActionQueueService).
          const permits = getRequiredPermits(job.trade || 'general', permitCountry);
          if (permits.length === 0) continue;
          const cust = (ctx.customers ?? []).find((c: any) => c.id === job.customerId);
          results.push({
            label: cust?.name || job.title || '',
            customerId: job.customerId ?? undefined,
            entityId: job.id,
            customer: cust?.name || '',
            job: job.title || '',
            permitCount: permits.length,
            country: permitCountry,
          });
        }
      }
      break;
    }
    case 'daily_17:00': {
      // R66r49 #5: fires once per local-time day after 17:00 if a) the
      // contractor has at least 1 in-progress job today and b) we haven't
      // queued today already. The dedup gate lives in evaluateTriggersAsync
      // (AsyncStorage key `@vasco_pack_daily_17_last_fired`).
      const localHour = new Date(now).getHours();
      if (localHour < 17) break;
      const todayCount = ctx.jobs.filter((j) => j.status === 'in-progress' || j.status === 'bezig').length;
      const completedToday = ctx.jobs.filter((j) => {
        if (j.status !== 'completed' && j.status !== 'gereed') return false;
        const t = new Date(j.completedAt || '').getTime();
        return Number.isFinite(t) && now - t < dayMs;
      }).length;
      const tomorrow = ctx.jobs.filter((j) => j.status === 'scheduled' || j.status === 'gepland').length;
      const hoursToday = ctx.jobs.reduce((sum, j) => {
        const worked = typeof j.actualHours === 'number' ? j.actualHours : 0;
        if (!worked) return sum;
        // Only hours belonging to today: a job completed today, or one still
        // in progress today.
        if (j.status === 'in-progress' || j.status === 'bezig') return sum + worked;
        const done = new Date(j.completedAt || '').getTime();
        return Number.isFinite(done) && now - done < dayMs ? sum + worked : sum;
      }, 0);
      // The auto_log_hours step reports hours; with none recorded it has
      // nothing to report.
      if (step.action === 'auto_log_hours' && hoursToday <= 0) break;
      results.push({
        label: '17:00',
        customer: '',
        job: '',
        amount: completedToday + tomorrow + todayCount,
        // hours/jobCount/count/tomorrowJobs interpolation pulled from match.* in resolveTemplate
        // hours was the literal '7', so every contractor was told "Uren
        // vandaag: 7u" every single evening regardless of what they worked.
        // Sum the hours actually recorded against today's jobs instead; the
        // step is skipped entirely below when nothing was logged, because
        // "0u" is not worth a card and an invented 7 is worse.
        ...(({ hours: formatDecimal1(hoursToday, (getCurrentCountry() ?? 'NL') as Country), jobCount: String(todayCount + completedToday), count: String(todayCount), tomorrowJobs: String(tomorrow) }) as any),
      });
      break;
    }
    case 'decision_pending': {
      // R66r49 #5: read decision_trackers from local AsyncStorage. Items
      // with status='pending' whose dueDate is delayDays past now match.
      // matchTrigger is sync so we can't read AsyncStorage here — the
      // hydration happens in evaluateTriggers' awaited prelude. This case
      // pulls from the prelude-injected `__pendingDecisions` ctx field.
      const pending = (ctx as any).__pendingDecisions as Array<{ trackerId: string; itemId: string; itemName: string; customer: string; project: string; daysOverdue: number }> | undefined;
      if (!pending) break;
      for (const p of pending) {
        // delayDays defines how many days past the item's dueDate the
        // step fires. ±1d window so weekly app-opens still match.
        if (p.daysOverdue >= step.delayDays && p.daysOverdue < step.delayDays + 2) {
          results.push({
            label: p.customer,
            customerId: undefined,
            entityId: p.trackerId,
            customer: p.customer,
            job: p.itemName,
            ...(({ project: p.project }) as any),
          });
        }
      }
      break;
    }
    // Triggers handled elsewhere:
    //  - stock_low / price_drop / bulk_opportunity : purchasingAgentService (deprecated in DEFAULT_PACKS)
    //  - job_clockout : timesheet entries — deprecated until clockoutService ships
  }
  return results;
}

/** Exported for tests — this renders the text customers actually receive. */
/** Placeholders that hold the contractor's own money, so they render as currency. */
const MONEY_KEY = /^(amount|price|savings|total)$/i;

export function resolveTemplate(template: string, data: Record<string, any>): string {
  // R66r49 #5 parameterised the SYMBOL (a hardcoded euro became a currency
  // placeholder) so a UK contractor stopped sending € on £. But it left it
  // BEFORE the number, which is only correct for en-GB: German, French, Spanish
  // and Italian all write it after — "5.200,00 €", not "€5.200,00". The German
  // dunning message said "Rechnung (€5.200,00) … + 40 € Mahnpauschale", using
  // both conventions in one sentence, and the app's own formatMoney rendered
  // "5.200 €" correctly on the screen the contractor tapped to send it.
  //
  // Intl (via formatCurrency) places symbol AND separators per locale, so the
  // placeholder no longer needs a symbol beside it. A template a contractor
  // customised earlier may still carry the old currency placeholder in front
  // of a money slot, so strip it there rather than render "€5.200,00 €".
  const deduped = template.replace(/\{\{currency\}\}\s*(?=\{\{(?:amount|price|savings|total)\}\})/gi, '');
  const filled = deduped.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === null) return '';
    if (typeof val === 'number') {
      if (MONEY_KEY.test(key)) {
        // The contractor's country decides the currency — never the reader's
        // device, and never a default euro.
        return data.country
          ? formatCurrency(val, data.country as Country)
          : formatMoney2(val);
      }
      // Non-money numbers (counts, hours) keep locale grouping, no decimals.
      return val.toLocaleString(i18n.language ?? 'nl-NL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return String(val);
  });
  // A placeholder that resolves to '' (e.g. an invoice with no reference) would
  // otherwise leave "factuur  (€350,00)" or a space before punctuation in a
  // message sent to a customer. Tidy the seams rather than ship sloppy copy.
  return filled
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+([,.!?;:)])/g, '$1')
    .trim();
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
