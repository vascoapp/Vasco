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
// Scope (R66r49 #7 round): Incasso pack + Quote followup pack.
// Incasso (5 buckets) recovers real money. Quote followup (3d + 7d) is
// the second-most load-bearing because every stale quote is potentially
// a missed job. Other packs stay app-open-only until telemetry justifies
// porting them server-side.
//
// Architecture choice: this function does NOT insert into the AI Action
// Queue directly (the queue lives in client AsyncStorage, not in DB).
// Instead it sends a push that wakes the contractor → opening the app
// fires evaluateTriggers → items queue locally with the correct
// templates + dedup. The push itself uses pack-aware copy so the
// contractor knows what they'll see when they open.
//
// Rate-limit: max 1 pack-tick push per contractor per day, gated by
// push_notification_log (notif_type='pack_incasso_*'). Independent of
// daily-push-digest's own 1/day cap so the two can coexist (a contractor
// may receive both if both fire — acceptable noise for the value).
//
// Schedule: 0 9 * * *  (09:00 UTC = 10/11 CET morning, before contractor
// reaches their first job site so the push lands during planning time).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
type IncassoStep = 'pre_due' | 'overdue_3' | 'overdue_7' | 'overdue_14' | 'overdue_30';
type QuoteStep = 'sent_3' | 'sent_7';

interface InvoiceRow {
  id: string;
  user_id: string;
  number: string | null;
  amount: number | null;
  total: number | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string | null;
  due_date: string | null;
  sent_at: string | null;
}

const PUSH_COPY: Record<Locale, Record<IncassoStep, { title: string; body: (n: number) => string }>> = {
  en: {
    pre_due: { title: 'Invoice due in 3 days', body: (n) => `${n} invoice${n > 1 ? 's' : ''} due soon. Vasco prepared a pre-reminder.` },
    overdue_3: { title: 'Friendly reminder ready', body: (n) => `${n} invoice${n > 1 ? 's' : ''} 3 days overdue. Tap to send.` },
    overdue_7: { title: 'Reminder ready', body: (n) => `${n} invoice${n > 1 ? 's' : ''} 7 days overdue. Vasco wrote the chase.` },
    overdue_14: { title: 'Statutory reminder ready', body: (n) => `${n} invoice${n > 1 ? 's' : ''} 14 days overdue. Includes EU 2011/7/EU disclosure.` },
    overdue_30: { title: 'Final notice ready', body: (n) => `${n} invoice${n > 1 ? 's' : ''} 30 days overdue. Last warning before debt collection.` },
  },
  nl: {
    pre_due: { title: 'Factuur vervalt binnenkort', body: (n) => `${n} factu${n > 1 ? 'ren' : 'ur'} vervalt over 3 dagen. Vasco heeft een pre-herinnering klaarstaan.` },
    overdue_3: { title: 'Vriendelijke herinnering klaar', body: (n) => `${n} factu${n > 1 ? 'ren' : 'ur'} 3 dagen achterstallig. Tik om te versturen.` },
    overdue_7: { title: 'Herinnering klaar', body: (n) => `${n} factu${n > 1 ? 'ren' : 'ur'} 7 dagen achterstallig. Vasco heeft de tekst klaar.` },
    overdue_14: { title: 'Wettelijke aanmaning klaar', body: (n) => `${n} factu${n > 1 ? 'ren' : 'ur'} 14 dagen achterstallig. Met EU 2011/7/EU disclosure.` },
    overdue_30: { title: 'Laatste herinnering klaar', body: (n) => `${n} factu${n > 1 ? 'ren' : 'ur'} 30 dagen achterstallig. Laatste waarschuwing voor incasso.` },
  },
  de: {
    pre_due: { title: 'Rechnung läuft bald ab', body: (n) => `${n} Rechnung${n > 1 ? 'en' : ''} fällig in 3 Tagen. Vasco hat eine Vorab-Erinnerung vorbereitet.` },
    overdue_3: { title: 'Freundliche Erinnerung bereit', body: (n) => `${n} Rechnung${n > 1 ? 'en' : ''} 3 Tage überfällig. Tippen zum Senden.` },
    overdue_7: { title: 'Erinnerung bereit', body: (n) => `${n} Rechnung${n > 1 ? 'en' : ''} 7 Tage überfällig. Text liegt bereit.` },
    overdue_14: { title: 'Mahnung bereit', body: (n) => `${n} Rechnung${n > 1 ? 'en' : ''} 14 Tage überfällig. Mit EU 2011/7/EU-Hinweis.` },
    overdue_30: { title: 'Letzte Mahnung bereit', body: (n) => `${n} Rechnung${n > 1 ? 'en' : ''} 30 Tage überfällig. Letzte Warnung vor Inkasso.` },
  },
  fr: {
    pre_due: { title: 'Facture à échéance proche', body: (n) => `${n} facture${n > 1 ? 's' : ''} à échéance dans 3 jours. Pré-rappel prêt.` },
    overdue_3: { title: 'Rappel amical prêt', body: (n) => `${n} facture${n > 1 ? 's' : ''} en retard de 3 jours. Tapez pour envoyer.` },
    overdue_7: { title: 'Relance prête', body: (n) => `${n} facture${n > 1 ? 's' : ''} en retard de 7 jours. Texte prêt.` },
    overdue_14: { title: 'Mise en demeure prête', body: (n) => `${n} facture${n > 1 ? 's' : ''} en retard de 14 jours. Avec mention Directive UE 2011/7/UE.` },
    overdue_30: { title: 'Dernière relance prête', body: (n) => `${n} facture${n > 1 ? 's' : ''} en retard de 30 jours. Dernier avis avant recouvrement.` },
  },
  es: {
    pre_due: { title: 'Factura vence pronto', body: (n) => `${n} factura${n > 1 ? 's' : ''} vence en 3 días. Pre-recordatorio listo.` },
    overdue_3: { title: 'Recordatorio amable listo', body: (n) => `${n} factura${n > 1 ? 's' : ''} 3 días vencidas. Toca para enviar.` },
    overdue_7: { title: 'Recordatorio listo', body: (n) => `${n} factura${n > 1 ? 's' : ''} 7 días vencidas. Texto preparado.` },
    overdue_14: { title: 'Recordatorio legal listo', body: (n) => `${n} factura${n > 1 ? 's' : ''} 14 días vencidas. Con Directiva UE 2011/7/UE.` },
    overdue_30: { title: 'Aviso final listo', body: (n) => `${n} factura${n > 1 ? 's' : ''} 30 días vencidas. Último aviso antes del recobro.` },
  },
  it: {
    pre_due: { title: 'Fattura in scadenza', body: (n) => `${n} fattur${n > 1 ? 'e' : 'a'} scade tra 3 giorni. Pre-promemoria pronto.` },
    overdue_3: { title: 'Promemoria amichevole pronto', body: (n) => `${n} fattur${n > 1 ? 'e' : 'a'} in ritardo di 3 giorni. Tocca per inviare.` },
    overdue_7: { title: 'Sollecito pronto', body: (n) => `${n} fattur${n > 1 ? 'e' : 'a'} in ritardo di 7 giorni. Testo pronto.` },
    overdue_14: { title: 'Sollecito legale pronto', body: (n) => `${n} fattur${n > 1 ? 'e' : 'a'} in ritardo di 14 giorni. Con Direttiva UE 2011/7/UE.` },
    overdue_30: { title: 'Avviso finale pronto', body: (n) => `${n} fattur${n > 1 ? 'e' : 'a'} in ritardo di 30 giorni. Ultimo avviso prima del recupero.` },
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
const QUOTE_PUSH: Record<Locale, Record<QuoteStep, { title: string; body: (n: number) => string }>> = {
  en: {
    sent_3: { title: 'Quote followup ready', body: (n) => `${n} quote${n > 1 ? 's' : ''} sent 3 days ago. Vasco prepared a "did you get a chance to look?" nudge.` },
    sent_7: { title: 'Quote expiring soon', body: (n) => `${n} quote${n > 1 ? 's' : ''} sent 7 days ago. A reminder now often unsticks them.` },
  },
  nl: {
    sent_3: { title: 'Offerte-opvolging klaar', body: (n) => `${n} offerte${n > 1 ? 's' : ''} 3 dagen geleden verstuurd. Vasco heeft een nudge klaarstaan.` },
    sent_7: { title: 'Offerte verloopt binnenkort', body: (n) => `${n} offerte${n > 1 ? 's' : ''} 7 dagen geleden verstuurd. Een herinnering helpt vaak.` },
  },
  de: {
    sent_3: { title: 'Angebots-Nachfass bereit', body: (n) => `${n} Angebot${n > 1 ? 'e' : ''} vor 3 Tagen versendet. Erinnerung liegt bereit.` },
    sent_7: { title: 'Angebot läuft bald ab', body: (n) => `${n} Angebot${n > 1 ? 'e' : ''} vor 7 Tagen versendet. Eine Erinnerung hilft oft.` },
  },
  fr: {
    sent_3: { title: 'Relance devis prête', body: (n) => `${n} devis envoyé${n > 1 ? 's' : ''} il y a 3 jours. Une relance est prête.` },
    sent_7: { title: 'Devis bientôt expiré', body: (n) => `${n} devis envoyé${n > 1 ? 's' : ''} il y a 7 jours. Une relance débloque souvent.` },
  },
  es: {
    sent_3: { title: 'Seguimiento de presupuesto listo', body: (n) => `${n} presupuesto${n > 1 ? 's' : ''} enviado hace 3 días. Recordatorio listo.` },
    sent_7: { title: 'Presupuesto pronto a vencer', body: (n) => `${n} presupuesto${n > 1 ? 's' : ''} enviado hace 7 días. Un recordatorio suele desbloquear.` },
  },
  it: {
    sent_3: { title: 'Sollecito preventivo pronto', body: (n) => `${n} preventiv${n > 1 ? 'i' : 'o'} inviato 3 giorni fa. Nudge pronto.` },
    sent_7: { title: 'Preventivo in scadenza', body: (n) => `${n} preventiv${n > 1 ? 'i' : 'o'} inviato 7 giorni fa. Un sollecito spesso sblocca.` },
  },
};

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
      // Pull this user's open invoices from documents (status sent or overdue).
      const { data: invoices } = await admin
        .from('documents')
        .select('id, user_id, number, amount, total, customer_id, customer_name, status, due_date, sent_at, country')
        .eq('user_id', userId)
        .eq('doc_type', 'invoice')
        .in('status', ['sent', 'overdue']);

      const stepCounts = new Map<IncassoStep, number>();
      let country: string | null = null;
      for (const inv of (invoices as any[]) ?? []) {
        const step = classifyInvoice(inv as InvoiceRow, nowMs);
        if (!step) continue;
        stepCounts.set(step, (stepCounts.get(step) ?? 0) + 1);
        country = country ?? inv.country ?? null;
      }
      if (stepCounts.size === 0) {
        skipped++;
        continue;
      }

      // Pick the most-urgent step that has matches (30 > 14 > 7 > 3 > pre_due).
      const priority: IncassoStep[] = ['overdue_30', 'overdue_14', 'overdue_7', 'overdue_3', 'pre_due'];
      const step = priority.find((s) => stepCounts.has(s));
      if (!step) {
        skipped++;
        continue;
      }
      const count = stepCounts.get(step) ?? 0;

      // Dedupe via push_notification_log: skip if same (notif_type, user) fired today.
      const sinceIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
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
        continue;
      }

      const locale = localeFor(country);
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

      await admin.from('push_notification_log').insert({
        user_id: userId,
        notif_type: notifType,
        entity_key: step,
        title: copy.title,
        body: copy.body(count),
        success: !!sendJson?.ok,
        error: sendJson?.ok ? null : (sendJson?.error ?? 'unknown'),
      });

      if (sendJson?.ok) pushed++;
      else errors.push({ userId, error: sendJson?.error ?? 'send-push failed' });

      // ─── Quote followup pack (R66r49 #7) ─────────────────────────────────
      // Same dedup contract as Incasso (24h same-type-key window via
      // push_notification_log). Independent rate limit — a contractor with
      // overdue invoices AND staling quotes can receive both pushes today.
      const { data: quotes } = await admin
        .from('documents')
        .select('id, user_id, status, sent_at, customer_id, country')
        .eq('user_id', userId)
        .eq('doc_type', 'quote')
        .eq('status', 'sent');

      const quoteCounts = new Map<QuoteStep, number>();
      for (const q of (quotes as any[]) ?? []) {
        const qstep = classifyQuote(q as QuoteRow, nowMs);
        if (qstep) quoteCounts.set(qstep, (quoteCounts.get(qstep) ?? 0) + 1);
      }
      if (quoteCounts.size === 0) continue;

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
      if (qRecent && qRecent.length > 0) continue;

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

      await admin.from('push_notification_log').insert({
        user_id: userId,
        notif_type: qNotifType,
        entity_key: qStep,
        title: qCopy.title,
        body: qCopy.body(qCount),
        success: !!qSendJson?.ok,
        error: qSendJson?.ok ? null : (qSendJson?.error ?? 'unknown'),
      });

      if (qSendJson?.ok) pushed++;
      else errors.push({ userId, error: qSendJson?.error ?? 'quote send-push failed' });
    } catch (err) {
      errors.push({ userId, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, pushed, skipped, errors }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
