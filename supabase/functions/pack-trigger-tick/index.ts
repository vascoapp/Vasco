// =============================================================================
// PACK-TRIGGER-TICK — Supabase Edge Function (R66r49 #6)
// =============================================================================
// Server-side daily evaluation of the load-bearing workflow packs. Pre-fix,
// `evaluateTriggers` only fired on app open; contractors who didn't open the
// app for 4+ days missed Incasso reminder windows entirely. This function
// runs daily via pg_cron and pings contractors whose pack triggers have
// matches, deep-linking into the app where the client-side evaluator
// does the actual queue insertion.
//
// Scope (R66r49 #8 round): Incasso pack + Quote followup pack + Handover
// survey + Maintenance pack. Server-side covers all packs whose triggers
// fire days/months after a job event — contractors won't have the app
// open on day 365 of a year-old completed job otherwise. Welcome pack
// stays app-open-only because its triggers fire 0 days after quote_accepted
// / job_started (contractor is already in the app at those moments).
//
// Architecture choice: this function does NOT insert into the AI Action
// Queue directly (the queue lives in client AsyncStorage, not in DB).
// Instead it sends a push that wakes the contractor → opening the app
// fires evaluateTriggers → items queue locally with the correct
// templates + dedup. The push itself uses pack-aware copy so the
// contractor knows what they'll see when they open.
//
// Rate-limit: max 1 pack-tick push per contractor per tick (enforced by
// `pushedThisTick`, priority incasso > quotes > jobs) and a 24h dedupe per
// step via push_notification_log. daily-push-digest (18:00) skips anyone a
// push REACHED in the last 24h, so on a day a pack push lands the digest
// stays quiet.
//
// Schedule: 0 9 * * *  (09:00 UTC = 10/11 CET morning, before contractor
// reaches their first job site so the push lands during planning time).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pushOutcome } from '../_shared/pushOutcome.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
type IncassoStep = 'pre_due' | 'overdue_3' | 'overdue_7' | 'overdue_14' | 'overdue_30';
type QuoteStep = 'sent_3' | 'sent_7';
type JobStep = 'survey_7' | 'maintenance_335' | 'maintenance_365';

interface InvoiceRow {
  id: string;
  user_id: string;
  customer_id: string | null;
  status: string | null;
  due_date: string | null;
  sent_at: string | null;
}

// Contractor-facing push copy (DE/FR formal, NL/ES/IT informal). Every body is
// an explicit singular/plural pair: the old `${n} Auftrag${n>1?'aufträge':''}`
// rendered "2 Auftragaufträge", and several languages disagreed in number
// ("2 lavori completato", "2 facturen vervalt"). The push only OPENS the app —
// it says what is ready, never "tap to send", and claims nothing we have not
// measured (review 2026-09-24).
type Copy = { title: string; body: (n: number) => string };
const pl = (one: string, other: string) => (n: number) => (n === 1 ? one : other).replace('{n}', String(n));

const PUSH_COPY: Record<Locale, Record<IncassoStep, Copy>> = {
  en: {
    pre_due: { title: 'Invoice due soon', body: pl('1 invoice is due in 3 days. A reminder is ready.', '{n} invoices are due in 3 days. Reminders are ready.') },
    overdue_3: { title: 'Friendly reminder ready', body: pl('1 invoice is 3 days overdue. A reminder is ready in the app.', '{n} invoices are 3 days overdue. Reminders are ready in the app.') },
    overdue_7: { title: 'Reminder ready', body: pl('1 invoice is 7 days overdue. A reminder is ready in the app.', '{n} invoices are 7 days overdue. Reminders are ready in the app.') },
    overdue_14: { title: 'Formal reminder ready', body: pl('1 invoice is 14 days overdue. A formal reminder with statutory interest is ready.', '{n} invoices are 14 days overdue. Formal reminders with statutory interest are ready.') },
    overdue_30: { title: 'Final notice ready', body: pl('1 invoice is 30 days overdue. A final notice is ready.', '{n} invoices are 30 days overdue. Final notices are ready.') },
  },
  nl: {
    pre_due: { title: 'Factuur vervalt binnenkort', body: pl('1 factuur vervalt over 3 dagen. Er staat een herinnering klaar.', '{n} facturen vervallen over 3 dagen. Er staan herinneringen klaar.') },
    overdue_3: { title: 'Vriendelijke herinnering klaar', body: pl('1 factuur is 3 dagen te laat. Er staat een herinnering klaar in de app.', '{n} facturen zijn 3 dagen te laat. Er staan herinneringen klaar in de app.') },
    overdue_7: { title: 'Herinnering klaar', body: pl('1 factuur is 7 dagen te laat. Er staat een herinnering klaar in de app.', '{n} facturen zijn 7 dagen te laat. Er staan herinneringen klaar in de app.') },
    overdue_14: { title: 'Aanmaning klaar', body: pl('1 factuur is 14 dagen te laat. Er staat een aanmaning met wettelijke handelsrente klaar.', '{n} facturen zijn 14 dagen te laat. Er staan aanmaningen met wettelijke handelsrente klaar.') },
    overdue_30: { title: 'Laatste herinnering klaar', body: pl('1 factuur is 30 dagen te laat. Er staat een laatste herinnering klaar.', '{n} facturen zijn 30 dagen te laat. Er staan laatste herinneringen klaar.') },
  },
  de: {
    pre_due: { title: 'Rechnung bald fällig', body: pl('1 Rechnung ist in 3 Tagen fällig. Eine Erinnerung liegt bereit.', '{n} Rechnungen sind in 3 Tagen fällig. Erinnerungen liegen bereit.') },
    overdue_3: { title: 'Freundliche Erinnerung bereit', body: pl('1 Rechnung ist 3 Tage überfällig. Eine Erinnerung liegt in der App bereit.', '{n} Rechnungen sind 3 Tage überfällig. Erinnerungen liegen in der App bereit.') },
    overdue_7: { title: 'Erinnerung bereit', body: pl('1 Rechnung ist 7 Tage überfällig. Eine Erinnerung liegt in der App bereit.', '{n} Rechnungen sind 7 Tage überfällig. Erinnerungen liegen in der App bereit.') },
    overdue_14: { title: 'Mahnung bereit', body: pl('1 Rechnung ist 14 Tage überfällig. Eine Mahnung mit Verzugszinsen liegt bereit.', '{n} Rechnungen sind 14 Tage überfällig. Mahnungen mit Verzugszinsen liegen bereit.') },
    overdue_30: { title: 'Letzte Mahnung bereit', body: pl('1 Rechnung ist 30 Tage überfällig. Eine letzte Mahnung liegt bereit.', '{n} Rechnungen sind 30 Tage überfällig. Letzte Mahnungen liegen bereit.') },
  },
  fr: {
    pre_due: { title: 'Facture bientôt échue', body: pl('1 facture arrive à échéance dans 3 jours. Un rappel est prêt.', '{n} factures arrivent à échéance dans 3 jours. Des rappels sont prêts.') },
    overdue_3: { title: 'Rappel amical prêt', body: pl('1 facture a 3 jours de retard. Un rappel vous attend dans l’app.', '{n} factures ont 3 jours de retard. Des rappels vous attendent dans l’app.') },
    overdue_7: { title: 'Relance prête', body: pl('1 facture a 7 jours de retard. Une relance vous attend dans l’app.', '{n} factures ont 7 jours de retard. Des relances vous attendent dans l’app.') },
    overdue_14: { title: 'Relance formelle prête', body: pl('1 facture a 14 jours de retard. Une relance avec intérêts de retard est prête.', '{n} factures ont 14 jours de retard. Des relances avec intérêts de retard sont prêtes.') },
    overdue_30: { title: 'Dernière relance prête', body: pl('1 facture a 30 jours de retard. Une dernière relance est prête.', '{n} factures ont 30 jours de retard. De dernières relances sont prêtes.') },
  },
  es: {
    pre_due: { title: 'Factura a punto de vencer', body: pl('1 factura vence en 3 días. Tienes un recordatorio listo.', '{n} facturas vencen en 3 días. Tienes recordatorios listos.') },
    overdue_3: { title: 'Recordatorio amable listo', body: pl('1 factura lleva 3 días vencida. Tienes un recordatorio listo en la app.', '{n} facturas llevan 3 días vencidas. Tienes recordatorios listos en la app.') },
    overdue_7: { title: 'Recordatorio listo', body: pl('1 factura lleva 7 días vencida. Tienes un recordatorio listo en la app.', '{n} facturas llevan 7 días vencidas. Tienes recordatorios listos en la app.') },
    overdue_14: { title: 'Requerimiento listo', body: pl('1 factura lleva 14 días vencida. Tienes un requerimiento con intereses de demora listo.', '{n} facturas llevan 14 días vencidas. Tienes requerimientos con intereses de demora listos.') },
    overdue_30: { title: 'Aviso final listo', body: pl('1 factura lleva 30 días vencida. Tienes un aviso final listo.', '{n} facturas llevan 30 días vencidas. Tienes avisos finales listos.') },
  },
  it: {
    pre_due: { title: 'Fattura in scadenza', body: pl('1 fattura scade tra 3 giorni. Hai un promemoria pronto.', '{n} fatture scadono tra 3 giorni. Hai dei promemoria pronti.') },
    overdue_3: { title: 'Promemoria gentile pronto', body: pl('1 fattura è in ritardo di 3 giorni. Hai un promemoria pronto nell’app.', '{n} fatture sono in ritardo di 3 giorni. Hai dei promemoria pronti nell’app.') },
    overdue_7: { title: 'Sollecito pronto', body: pl('1 fattura è in ritardo di 7 giorni. Hai un sollecito pronto nell’app.', '{n} fatture sono in ritardo di 7 giorni. Hai dei solleciti pronti nell’app.') },
    overdue_14: { title: 'Sollecito formale pronto', body: pl('1 fattura è in ritardo di 14 giorni. Hai un sollecito con interessi di mora pronto.', '{n} fatture sono in ritardo di 14 giorni. Hai dei solleciti con interessi di mora pronti.') },
    overdue_30: { title: 'Ultimo avviso pronto', body: pl('1 fattura è in ritardo di 30 giorni. Hai un ultimo avviso pronto.', '{n} fatture sono in ritardo di 30 giorni. Hai degli avvisi finali pronti.') },
  },
};

function localeFor(country: string | null | undefined): Locale {
  switch ((country ?? '').toUpperCase()) {
    case 'NL': return 'nl';
    case 'DE': return 'de';
    case 'FR': return 'fr';
    case 'ES': return 'es';
    case 'IT': return 'it';
    default: return 'en';
  }
}

// R66r49 #7: Quote followup push copy. 3d + 7d after quote sent.
const QUOTE_PUSH: Record<Locale, Record<QuoteStep, Copy>> = {
  en: {
    sent_3: { title: 'Quote follow-up ready', body: pl('1 quote was sent 3 days ago. A follow-up is ready.', '{n} quotes were sent 3 days ago. Follow-ups are ready.') },
    sent_7: { title: 'Quote follow-up ready', body: pl('1 quote was sent 7 days ago with no answer yet. A reminder is ready.', '{n} quotes were sent 7 days ago with no answer yet. Reminders are ready.') },
  },
  nl: {
    sent_3: { title: 'Offerte-opvolging klaar', body: pl('1 offerte is 3 dagen geleden verstuurd. Er staat een opvolging klaar.', '{n} offertes zijn 3 dagen geleden verstuurd. Er staan opvolgingen klaar.') },
    sent_7: { title: 'Offerte-opvolging klaar', body: pl('1 offerte is 7 dagen geleden verstuurd, nog geen reactie. Er staat een herinnering klaar.', '{n} offertes zijn 7 dagen geleden verstuurd, nog geen reactie. Er staan herinneringen klaar.') },
  },
  de: {
    sent_3: { title: 'Angebots-Nachfassen bereit', body: pl('1 Angebot wurde vor 3 Tagen versendet. Eine Nachfrage liegt bereit.', '{n} Angebote wurden vor 3 Tagen versendet. Nachfragen liegen bereit.') },
    sent_7: { title: 'Angebots-Nachfassen bereit', body: pl('1 Angebot wurde vor 7 Tagen versendet, noch ohne Antwort. Eine Erinnerung liegt bereit.', '{n} Angebote wurden vor 7 Tagen versendet, noch ohne Antwort. Erinnerungen liegen bereit.') },
  },
  fr: {
    sent_3: { title: 'Relance de devis prête', body: pl('1 devis a été envoyé il y a 3 jours. Une relance est prête.', '{n} devis ont été envoyés il y a 3 jours. Des relances sont prêtes.') },
    sent_7: { title: 'Relance de devis prête', body: pl('1 devis a été envoyé il y a 7 jours, toujours sans réponse. Un rappel est prêt.', '{n} devis ont été envoyés il y a 7 jours, toujours sans réponse. Des rappels sont prêts.') },
  },
  es: {
    sent_3: { title: 'Seguimiento de presupuesto listo', body: pl('1 presupuesto se envió hace 3 días. Tienes un seguimiento listo.', '{n} presupuestos se enviaron hace 3 días. Tienes seguimientos listos.') },
    sent_7: { title: 'Seguimiento de presupuesto listo', body: pl('1 presupuesto se envió hace 7 días y aún no hay respuesta. Tienes un recordatorio listo.', '{n} presupuestos se enviaron hace 7 días y aún no hay respuesta. Tienes recordatorios listos.') },
  },
  it: {
    sent_3: { title: 'Sollecito per preventivo pronto', body: pl('1 preventivo è stato inviato 3 giorni fa. Hai un sollecito pronto.', '{n} preventivi sono stati inviati 3 giorni fa. Hai dei solleciti pronti.') },
    sent_7: { title: 'Sollecito per preventivo pronto', body: pl('1 preventivo è stato inviato 7 giorni fa, ancora senza risposta. Hai un promemoria pronto.', '{n} preventivi sono stati inviati 7 giorni fa, ancora senza risposta. Hai dei promemoria pronti.') },
  },
};

// R66r49 #8: Job-completion-keyed push copy. Survey at +7d, pre-maintenance
// reminder at +335d, maintenance follow-up at +365d.
const JOB_PUSH: Record<Locale, Record<JobStep, Copy>> = {
  en: {
    survey_7: { title: 'Review request ready', body: pl('1 job was completed a week ago. A review request is ready.', '{n} jobs were completed a week ago. Review requests are ready.') },
    maintenance_335: { title: 'Annual maintenance coming up', body: pl('1 job is almost a year old. A maintenance message is ready.', '{n} jobs are almost a year old. Maintenance messages are ready.') },
    maintenance_365: { title: 'Annual maintenance due', body: pl('1 job was completed a year ago. A maintenance reminder is ready.', '{n} jobs were completed a year ago. Maintenance reminders are ready.') },
  },
  nl: {
    survey_7: { title: 'Review-verzoek klaar', body: pl('1 klus is een week geleden afgerond. Er staat een review-verzoek klaar.', '{n} klussen zijn een week geleden afgerond. Er staan review-verzoeken klaar.') },
    maintenance_335: { title: 'Jaarlijks onderhoud komt eraan', body: pl('1 klus is bijna een jaar oud. Er staat een onderhoudsbericht klaar.', '{n} klussen zijn bijna een jaar oud. Er staan onderhoudsberichten klaar.') },
    maintenance_365: { title: 'Jaarlijks onderhoud', body: pl('1 klus is een jaar geleden afgerond. Er staat een onderhoudsherinnering klaar.', '{n} klussen zijn een jaar geleden afgerond. Er staan onderhoudsherinneringen klaar.') },
  },
  de: {
    survey_7: { title: 'Bewertungsanfrage bereit', body: pl('1 Auftrag wurde vor einer Woche abgeschlossen. Eine Bewertungsanfrage liegt bereit.', '{n} Aufträge wurden vor einer Woche abgeschlossen. Bewertungsanfragen liegen bereit.') },
    maintenance_335: { title: 'Jahreswartung steht an', body: pl('1 Auftrag ist fast ein Jahr alt. Eine Wartungsnachricht liegt bereit.', '{n} Aufträge sind fast ein Jahr alt. Wartungsnachrichten liegen bereit.') },
    maintenance_365: { title: 'Jahreswartung fällig', body: pl('1 Auftrag wurde vor einem Jahr abgeschlossen. Eine Wartungserinnerung liegt bereit.', '{n} Aufträge wurden vor einem Jahr abgeschlossen. Wartungserinnerungen liegen bereit.') },
  },
  fr: {
    survey_7: { title: 'Demande d’avis prête', body: pl('1 chantier a été terminé il y a une semaine. Une demande d’avis est prête.', '{n} chantiers ont été terminés il y a une semaine. Des demandes d’avis sont prêtes.') },
    maintenance_335: { title: 'Entretien annuel à venir', body: pl('1 chantier a presque un an. Un message d’entretien est prêt.', '{n} chantiers ont presque un an. Des messages d’entretien sont prêts.') },
    maintenance_365: { title: 'Entretien annuel', body: pl('1 chantier a été terminé il y a un an. Un rappel d’entretien est prêt.', '{n} chantiers ont été terminés il y a un an. Des rappels d’entretien sont prêts.') },
  },
  es: {
    survey_7: { title: 'Petición de reseña lista', body: pl('1 trabajo se terminó hace una semana. Tienes una petición de reseña lista.', '{n} trabajos se terminaron hace una semana. Tienes peticiones de reseña listas.') },
    maintenance_335: { title: 'Mantenimiento anual próximo', body: pl('1 trabajo cumple casi un año. Tienes un mensaje de mantenimiento listo.', '{n} trabajos cumplen casi un año. Tienes mensajes de mantenimiento listos.') },
    maintenance_365: { title: 'Mantenimiento anual', body: pl('1 trabajo se terminó hace un año. Tienes un recordatorio de mantenimiento listo.', '{n} trabajos se terminaron hace un año. Tienes recordatorios de mantenimiento listos.') },
  },
  it: {
    survey_7: { title: 'Richiesta di recensione pronta', body: pl('1 lavoro è stato completato una settimana fa. Hai una richiesta di recensione pronta.', '{n} lavori sono stati completati una settimana fa. Hai delle richieste di recensione pronte.') },
    maintenance_335: { title: 'Manutenzione annuale in arrivo', body: pl('1 lavoro ha quasi un anno. Hai un messaggio di manutenzione pronto.', '{n} lavori hanno quasi un anno. Hai dei messaggi di manutenzione pronti.') },
    maintenance_365: { title: 'Manutenzione annuale', body: pl('1 lavoro è stato completato un anno fa. Hai un promemoria di manutenzione pronto.', '{n} lavori sono stati completati un anno fa. Hai dei promemoria di manutenzione pronti.') },
  },
};

interface JobRow {
  id: string;
  user_id: string;
  status: string | null;
  completed_at: string | null;
  customer_id: string | null;
}

function classifyJob(job: JobRow, nowMs: number): JobStep | null {
  const dayMs = 86_400_000;
  if (job.status !== 'completed' && job.status !== 'gereed') return null;
  const completedMs = job.completed_at ? Date.parse(job.completed_at) : NaN;
  if (!Number.isFinite(completedMs)) return null;
  const ageDays = Math.floor((nowMs - completedMs) / dayMs);
  // ±1d windows so a daily cron lands in exactly one bucket.
  if (ageDays >= 7 && ageDays < 9) return 'survey_7';
  if (ageDays >= 335 && ageDays < 337) return 'maintenance_335';
  if (ageDays >= 365 && ageDays < 367) return 'maintenance_365';
  return null;
}

function classifyInvoice(inv: InvoiceRow, nowMs: number): IncassoStep | null {
  const dayMs = 86_400_000;
  const dueMs = inv.due_date ? Date.parse(inv.due_date) : NaN;
  if (!Number.isFinite(dueMs)) return null;
  const overdueDays = Math.floor((nowMs - dueMs) / dayMs);
  // ±1d window so a daily cron always lands in exactly one bucket.
  if (overdueDays >= -3 && overdueDays < -2 && inv.status === 'sent') return 'pre_due';
  if (inv.status !== 'overdue' && inv.status !== 'sent') return null;
  if (overdueDays >= 3 && overdueDays < 5) return 'overdue_3';
  if (overdueDays >= 7 && overdueDays < 9) return 'overdue_7';
  if (overdueDays >= 14 && overdueDays < 16) return 'overdue_14';
  if (overdueDays >= 30 && overdueDays < 32) return 'overdue_30';
  return null;
}

interface QuoteRow {
  id: string;
  user_id: string;
  status: string | null;
  sent_at: string | null;
  customer_id: string | null;
}

function classifyQuote(q: QuoteRow, nowMs: number): QuoteStep | null {
  const dayMs = 86_400_000;
  if (q.status !== 'sent') return null;
  const sentMs = q.sent_at ? Date.parse(q.sent_at) : NaN;
  if (!Number.isFinite(sentMs)) return null;
  const sentDays = Math.floor((nowMs - sentMs) / dayMs);
  if (sentDays >= 3 && sentDays < 5) return 'sent_3';
  if (sentDays >= 7 && sentDays < 9) return 'sent_7';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing service-role config' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const nowMs = Date.now();

  // Pull all paid-tier contractors with at least one push token. This is the
  // gating set: free contractors don't have automation packs (R66r49 #5),
  // and contractors without push tokens can't be reached via this path.
  const { data: tokens, error: tokenErr } = await admin
    .from('push_tokens')
    .select('user_id')
    .order('user_id');
  if (tokenErr) {
    return new Response(JSON.stringify({ ok: false, error: tokenErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userIds = Array.from(new Set((tokens ?? []).map((t) => t.user_id))).filter(Boolean);

  let pushed = 0;
  let skipped = 0;
  const errors: Array<{ userId: string; error: string }> = [];

  for (const userId of userIds) {
    try {
      // The contractor's country picks the push language — from the business
      // profile, which outranks the account (CLAUDE.md). It used to be read off
      // `documents.country`, a column that does not exist.
      const { data: settings } = await admin
        .from('business_settings')
        .select('country')
        .eq('user_id', userId)
        .maybeSingle();
      const country: string | null = (settings as any)?.country ?? null;

      // Each pack is its own block: "nothing to do" for one must not end the
      // others. A bare `continue` here skipped the quote and job packs for every
      // contractor without an overdue invoice (live-schema scan follow-up).
      // Shared by all three packs below (were block-local to the first).
      const sinceIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
      const locale = localeFor(country);

      // At most ONE pack push per contractor per tick (the header's contract;
      // with three independent blocks up to five could fire). Order is the
      // priority: money owed, then quotes waiting, then jobs.
      let pushedThisTick = false;

      incasso: {
      // Pull this user's open invoices from documents (status sent or overdue).
      // ONLY live columns: this select named number/amount/total/customer_name/
      // country, none of which exist, so it failed with 42703 on every tick and
      // — its error unread — looked like "no open invoices": the dunning pack
      // never pushed once (live-schema column scan, convergence plan P0.3).
      const { data: invoices, error: invErr } = await admin
        .from('documents')
        .select('id, user_id, customer_id, status, due_date, sent_at')
        .eq('user_id', userId)
        .eq('doc_type', 'invoice')
        .in('status', ['sent', 'overdue'])
        .is('deleted_at', null); // a deleted invoice is chased by nobody
      if (invErr) {
        errors.push({ userId, error: `invoices: ${invErr.message}` });
        break incasso;
      }

      const stepCounts = new Map<IncassoStep, number>();
      for (const inv of (invoices as any[]) ?? []) {
        const step = classifyInvoice(inv as InvoiceRow, nowMs);
        if (!step) continue;
        stepCounts.set(step, (stepCounts.get(step) ?? 0) + 1);
      }
      if (stepCounts.size === 0) {
        skipped++;
        break incasso;
      }

      // Pick the most-urgent step that has matches (30 > 14 > 7 > 3 > pre_due).
      const priority: IncassoStep[] = ['overdue_30', 'overdue_14', 'overdue_7', 'overdue_3', 'pre_due'];
      const step = priority.find((s) => stepCounts.has(s));
      if (!step) {
        skipped++;
        break incasso;
      }
      const count = stepCounts.get(step) ?? 0;

      // Dedupe via push_notification_log: skip if same (notif_type, user) fired today.
      const notifType = `pack_incasso_${step}`;
      const { data: recent } = await admin
        .from('push_notification_log')
        .select('id')
        .eq('user_id', userId)
        .eq('notif_type', notifType)
        .gte('sent_at', sinceIso)
        .limit(1);
      if (recent && recent.length > 0) {
        skipped++;
        break incasso;
      }

      const copy = PUSH_COPY[locale][step];

      // Fan out via send-push (already deployed). Deep-link to /(contractor)/geld
      // where the contractor sees overdue invoices + can tap to draft reminders.
      const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title: copy.title,
          body: copy.body(count),
          data: { type: 'overdue_invoice', packId: 'incasso_auto', step, count: String(count) },
        }),
      });
      const sendJson = await sendRes.json().catch(() => ({}));
      const sendJsonOutcome = pushOutcome(sendJson);

      // The dedupe row for this pack step: the 24-hour lookup above reads it,
      // so a dropped row lets the same automation nudge fire again on the
      // next tick — to the contractor, a pack that repeats itself (#353).
      const { error: incassoLogErr } = await admin.from('push_notification_log').insert({
        user_id: userId,
        notif_type: notifType,
        entity_key: step,
        title: copy.title,
        body: copy.body(count),
        success: sendJsonOutcome.delivered,
        error: sendJsonOutcome.error,
      });
      if (incassoLogErr) {
        console.error(`pack-trigger-tick: push sent but the dedupe row was not written (${incassoLogErr.message}) — this step can repeat`);
      }

      if (sendJsonOutcome.delivered) { pushed++; pushedThisTick = true; }
      else errors.push({ userId, error: sendJsonOutcome.error ?? 'send-push failed' });

      }

      quotes: {
        if (pushedThisTick) break quotes;
      // ─── Quote followup pack (R66r49 #7) ─────────────────────────────────
      // Same dedup contract as Incasso (24h same-type-key window via
      // push_notification_log). Independent rate limit — a contractor with
      // overdue invoices AND staling quotes can receive both pushes today.
      const { data: quotes, error: quoteErr } = await admin
        .from('documents')
        .select('id, user_id, status, sent_at, customer_id')
        .eq('user_id', userId)
        .eq('doc_type', 'quote')
        .eq('status', 'sent')
        .is('deleted_at', null);

      if (quoteErr) {
        errors.push({ userId, error: `quotes: ${quoteErr.message}` });
        break quotes;
      }
      const quoteCounts = new Map<QuoteStep, number>();
      for (const q of (quotes as any[]) ?? []) {
        const qstep = classifyQuote(q as QuoteRow, nowMs);
        if (qstep) quoteCounts.set(qstep, (quoteCounts.get(qstep) ?? 0) + 1);
      }
      if (quoteCounts.size === 0) break quotes;

      // Prefer 7d push over 3d when both have matches — older = more urgent.
      const qStep: QuoteStep = quoteCounts.has('sent_7') ? 'sent_7' : 'sent_3';
      const qCount = quoteCounts.get(qStep) ?? 0;
      const qNotifType = `pack_quote_${qStep}`;

      const { data: qRecent } = await admin
        .from('push_notification_log')
        .select('id')
        .eq('user_id', userId)
        .eq('notif_type', qNotifType)
        .gte('sent_at', sinceIso)
        .limit(1);
      if (qRecent && qRecent.length > 0) break quotes;

      const qCopy = QUOTE_PUSH[locale][qStep];
      const qSend = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title: qCopy.title,
          body: qCopy.body(qCount),
          data: { type: 'quote_followup', packId: 'offerte_opvolging', step: qStep, count: String(qCount) },
        }),
      });
      const qSendJson = await qSend.json().catch(() => ({}));
      const qSendJsonOutcome = pushOutcome(qSendJson);

      // The dedupe row for this pack step: the 24-hour lookup above reads it,
      // so a dropped row lets the same automation nudge fire again on the
      // next tick — to the contractor, a pack that repeats itself (#353).
      const { error: followupLogErr } = await admin.from('push_notification_log').insert({
        user_id: userId,
        notif_type: qNotifType,
        entity_key: qStep,
        title: qCopy.title,
        body: qCopy.body(qCount),
        success: qSendJsonOutcome.delivered,
        error: qSendJsonOutcome.error,
      });
      if (followupLogErr) {
        console.error(`pack-trigger-tick: push sent but the dedupe row was not written (${followupLogErr.message}) — this step can repeat`);
      }

      if (qSendJsonOutcome.delivered) { pushed++; pushedThisTick = true; }
      else errors.push({ userId, error: `quote: ${qSendJsonOutcome.error}` });

      }

      // ─── Job-completion packs (R66r49 #8) ──────────────────────────────
      // Handover-survey at +7d, maintenance pre-reminder at +335d,
      // maintenance follow-up at +365d. Each step is independently
      // rate-limited (different `notif_type` keys). All three derive from
      // the same `jobs` table query so we fetch once.
      const { data: jobs, error: jobsErr } = await admin
        .from('jobs')
        .select('id, user_id, status, completed_at, customer_id')
        .eq('user_id', userId)
        .in('status', ['completed', 'gereed']);

      if (jobsErr) errors.push({ userId, error: `jobs: ${jobsErr.message}` });
      const jobStepCounts = new Map<JobStep, number>();
      for (const job of (jobs as any[]) ?? []) {
        const js = classifyJob(job as JobRow, nowMs);
        if (js) jobStepCounts.set(js, (jobStepCounts.get(js) ?? 0) + 1);
      }

      // Loop through each step that has matches; each fires its own push.
      // Older buckets push first (maintenance_365 > maintenance_335 > survey_7)
      // so a contractor with 1-year + 1-week jobs still gets the older alert
      // (less likely to fire again).
      const jobOrder: JobStep[] = ['maintenance_365', 'maintenance_335', 'survey_7'];
      for (const jStep of jobOrder) {
        if (pushedThisTick) break;
        const jCount = jobStepCounts.get(jStep);
        if (!jCount) continue;

        // Per-step packId for telemetry attribution.
        const jPackId = jStep.startsWith('maintenance') ? 'onderhoud_herinnering' : 'oplevering_pakket';
        const jNotifType = `pack_job_${jStep}`;

        const { data: jRecent } = await admin
          .from('push_notification_log')
          .select('id')
          .eq('user_id', userId)
          .eq('notif_type', jNotifType)
          .gte('sent_at', sinceIso)
          .limit(1);
        if (jRecent && jRecent.length > 0) continue;

        const jCopy = JOB_PUSH[locale][jStep];
        const jSend = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            title: jCopy.title,
            body: jCopy.body(jCount),
            data: { type: 'job_milestone', packId: jPackId, step: jStep, count: String(jCount) },
          }),
        });
        const jSendJson = await jSend.json().catch(() => ({}));
        const jSendJsonOutcome = pushOutcome(jSendJson);

        // The dedupe row for this pack step: the 24-hour lookup above reads it,
        // so a dropped row lets the same automation nudge fire again on the
        // next tick — to the contractor, a pack that repeats itself (#353).
        const { error: milestoneLogErr } = await admin.from('push_notification_log').insert({
          user_id: userId,
          notif_type: jNotifType,
          entity_key: jStep,
          title: jCopy.title,
          body: jCopy.body(jCount),
          success: jSendJsonOutcome.delivered,
          error: jSendJsonOutcome.error,
        });
        if (milestoneLogErr) {
          console.error(`pack-trigger-tick: push sent but the dedupe row was not written (${milestoneLogErr.message}) — this step can repeat`);
        }

        if (jSendJsonOutcome.delivered) { pushed++; pushedThisTick = true; }
        else errors.push({ userId, error: `${jStep}: ${jSendJsonOutcome.error}` });
      }
    } catch (err) {
      errors.push({ userId, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, pushed, skipped, errors }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
