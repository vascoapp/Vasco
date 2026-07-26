// =============================================================================
// DAILY-PUSH-DIGEST — Supabase Edge Function (R226)
// =============================================================================
// Scheduled 18:00 UTC. For every user with at least one registered push
// token:
//   1. Fetch their current state (overdue invoices count/sum, pending EVE
//      queue items, quotes past cohort p75 accept-lag, jobs scheduled
//      tomorrow).
//   2. Ask the policy picker which single push to send (or none).
//   3. Rate-limit via push_notification_log (max 1/day, 24h dedupe on
//      (notif_type, entity_key)).
//   4. Fan out via the existing send-push Edge Function — no duplication
//      of the Expo Push API contract.
//
// Mirrors `src/services/pushDigestPolicy.ts` which is the jest-tested
// version. Keep the two in sync; the unit tests anchor the logic.
//
// Expected cron:
//   schedule = "0 18 * * *"   # 18:00 UTC daily
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_OVERDUE_COUNT = 1;
const MIN_OVERDUE_AMOUNT = 200;
const MIN_QUEUE = 2;
const MIN_STALING = 1;
const MIN_JOBS_TOMORROW = 1;

type PushType = 'overdue_invoices' | 'queue_waiting' | 'staling_quotes' | 'jobs_tomorrow' | 'license_expiring';
type PushLocale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

interface Decision {
  type: PushType;
  title: string;
  body: string;
  entityKey: string;
  params: { count: number; amount?: number; days?: number; licenseType?: string };
}

// Mirror of src/services/pushDigestPolicy.ts — kept in sync via the jest
// suite on the policy file. If you change one, change both.
type TemplatePair = { title: string; body: string };
const TEMPLATES: Record<PushLocale, Record<PushType, { one?: TemplatePair; many?: TemplatePair; any?: TemplatePair }>> = {
  en: {
    overdue_invoices: { one: { title: '{amount} overdue', body: '{count} invoice past due. Send a reminder in 2 taps.' }, many: { title: '{amount} overdue', body: '{count} invoices past due. Send a reminder in 2 taps.' } },
    queue_waiting: { any: { title: '{count} actions waiting', body: 'Vasco prepared {count} things for you. Approve or skip.' } },
    staling_quotes: { one: { title: '{count} quote going stale', body: 'Cohort usually accepts within a week. A nudge often unsticks them.' }, many: { title: '{count} quotes going stale', body: 'Cohort usually accepts within a week. A nudge often unsticks them.' } },
    jobs_tomorrow: { one: { title: '{count} job tomorrow', body: 'Materials ready? Route planned? Tap to prep in 30 seconds.' }, many: { title: '{count} jobs tomorrow', body: 'Materials ready? Route planned? Tap to prep in 30 seconds.' } },
    // R80 US Phase 2: state-license expiry warning. Highest priority.
    license_expiring: { any: { title: 'License expiring in {days}d', body: 'Your {licenseType} renewal is due. Tap to review.' } },
  },
  nl: {
    overdue_invoices: { one: { title: '{amount} te laat', body: '{count} factuur staat open. Stuur herinnering in 2 tikken.' }, many: { title: '{amount} te laat', body: '{count} facturen staan open. Stuur herinnering in 2 tikken.' } },
    queue_waiting: { any: { title: '{count} acties wachten', body: 'Vasco heeft {count} dingen voor je klaarstaan. Keur goed of sla over.' } },
    staling_quotes: { one: { title: '{count} offerte loopt vast', body: 'Cohort accepteert meestal binnen een week. Een nudge helpt vaak.' }, many: { title: '{count} offertes lopen vast', body: 'Cohort accepteert meestal binnen een week. Een nudge helpt vaak.' } },
    jobs_tomorrow: { one: { title: '{count} klus morgen', body: 'Materiaal gereed? Route gepland? Tik om in 30s voor te bereiden.' }, many: { title: '{count} klussen morgen', body: 'Materiaal gereed? Route gepland? Tik om in 30s voor te bereiden.' } },
    // R80: license expiry is US-only; this stub satisfies the locale type
    // but never fires for non-US contractors.
    license_expiring: { any: { title: 'License expiring in {days}d', body: 'Your {licenseType} renewal is due.' } },
  },
  de: {
    overdue_invoices: { one: { title: '{amount} überfällig', body: '{count} Rechnung überfällig. In 2 Taps erinnern.' }, many: { title: '{amount} überfällig', body: '{count} Rechnungen überfällig. In 2 Taps erinnern.' } },
    queue_waiting: { any: { title: '{count} Aktionen warten', body: 'Vasco hat {count} Dinge vorbereitet. Genehmigen oder überspringen.' } },
    staling_quotes: { one: { title: '{count} Angebot bleibt hängen', body: 'Die Kohorte nimmt meist innerhalb einer Woche an. Ein Nachfassen hilft.' }, many: { title: '{count} Angebote bleiben hängen', body: 'Die Kohorte nimmt meist innerhalb einer Woche an. Ein Nachfassen hilft.' } },
    jobs_tomorrow: { one: { title: '{count} Auftrag morgen', body: 'Material bereit? Route geplant? 30 Sekunden bis startklar.' }, many: { title: '{count} Aufträge morgen', body: 'Material bereit? Route geplant? 30 Sekunden bis startklar.' } },
    license_expiring: { any: { title: 'License expiring in {days}d', body: 'Your {licenseType} renewal is due.' } },
  },
  fr: {
    overdue_invoices: { one: { title: '{amount} en retard', body: '{count} facture impayée. Relance en 2 taps.' }, many: { title: '{amount} en retard', body: '{count} factures impayées. Relance en 2 taps.' } },
    queue_waiting: { any: { title: '{count} actions en attente', body: 'Vasco a préparé {count} éléments. Approuvez ou passez.' } },
    staling_quotes: { one: { title: '{count} devis ralenti', body: 'La cohorte accepte habituellement en une semaine. Une relance aide.' }, many: { title: '{count} devis ralentis', body: 'La cohorte accepte habituellement en une semaine. Une relance aide.' } },
    jobs_tomorrow: { one: { title: '{count} chantier demain', body: 'Matériel prêt ? Itinéraire ? 30s pour tout préparer.' }, many: { title: '{count} chantiers demain', body: 'Matériel prêt ? Itinéraires ? 30s pour tout préparer.' } },
    license_expiring: { any: { title: 'License expiring in {days}d', body: 'Your {licenseType} renewal is due.' } },
  },
  es: {
    overdue_invoices: { one: { title: '{amount} vencidos', body: '{count} factura vencida. Envía recordatorio en 2 toques.' }, many: { title: '{amount} vencidos', body: '{count} facturas vencidas. Envía recordatorio en 2 toques.' } },
    queue_waiting: { any: { title: '{count} acciones esperando', body: 'Vasco preparó {count} cosas. Aprueba o salta.' } },
    staling_quotes: { one: { title: '{count} presupuesto atascado', body: 'La cohorte acepta en ~1 semana. Un recordatorio suele funcionar.' }, many: { title: '{count} presupuestos atascados', body: 'La cohorte acepta en ~1 semana. Un recordatorio suele funcionar.' } },
    jobs_tomorrow: { one: { title: '{count} obra mañana', body: '¿Materiales listos? ¿Ruta? 30s para prepararlo.' }, many: { title: '{count} obras mañana', body: '¿Materiales listos? ¿Rutas? 30s para prepararlo.' } },
    license_expiring: { any: { title: 'License expiring in {days}d', body: 'Your {licenseType} renewal is due.' } },
  },
  it: {
    overdue_invoices: { one: { title: '{amount} in scadenza', body: '{count} fattura scaduta. Invia sollecito in 2 tap.' }, many: { title: '{amount} in scadenza', body: '{count} fatture scadute. Invia sollecito in 2 tap.' } },
    queue_waiting: { any: { title: '{count} azioni in attesa', body: 'Vasco ha preparato {count} cose. Approva o salta.' } },
    staling_quotes: { one: { title: '{count} preventivo fermo', body: 'La coorte accetta di solito entro una settimana. Un sollecito aiuta.' }, many: { title: '{count} preventivi fermi', body: 'La coorte accetta di solito entro una settimana. Un sollecito aiuta.' } },
    jobs_tomorrow: { one: { title: '{count} cantiere domani', body: 'Materiali pronti? Percorso? 30s per prepararti.' }, many: { title: '{count} cantieri domani', body: 'Materiali pronti? Percorsi? 30s per prepararti.' } },
    license_expiring: { any: { title: 'License expiring in {days}d', body: 'Your {licenseType} renewal is due.' } },
  },
};

function localeForCountry(country: string | null | undefined): PushLocale {
  switch ((country ?? '').toUpperCase()) {
    case 'NL': return 'nl';
    case 'DE': return 'de';
    case 'FR': return 'fr';
    case 'ES': return 'es';
    case 'IT': return 'it';
    case 'UK':
    default:   return 'en';
  }
}

// Mirrors pushDigestPolicy.formatAmount. The symbol is no longer baked into
// the templates: 'en' serves UK and US as well, so a euro there reached a
// British lock screen. Deno has full Intl, so format from the country.
const PUSH_CURRENCY: Record<string, { currency: string; locale: string }> = {
  NL: { currency: 'EUR', locale: 'nl-NL' },
  DE: { currency: 'EUR', locale: 'de-DE' },
  FR: { currency: 'EUR', locale: 'fr-FR' },
  ES: { currency: 'EUR', locale: 'es-ES' },
  IT: { currency: 'EUR', locale: 'it-IT' },
  UK: { currency: 'GBP', locale: 'en-GB' },
  US: { currency: 'USD', locale: 'en-US' },
};

function formatAmount(n: number, country: string | null | undefined): string {
  const cfg = PUSH_CURRENCY[(country ?? '').toUpperCase()] ?? PUSH_CURRENCY.NL;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency', currency: cfg.currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function fillTemplate(
  tpl: string,
  params: { count: number; amount?: number; days?: number; licenseType?: string },
  locale: PushLocale,
  country: string | null | undefined,
): string {
  return tpl
    .replace('{count}', String(params.count))
    .replace('{amount}', params.amount != null ? formatAmount(params.amount, country) : '')
    .replace('{days}', params.days != null ? String(params.days) : '')
    .replace('{licenseType}', params.licenseType ?? 'license');
}

function formatForLocale(
  type: PushType,
  params: { count: number; amount?: number; days?: number; licenseType?: string },
  locale: PushLocale,
  country: string | null | undefined,
): { title: string; body: string } {
  const entry = (TEMPLATES[locale] ?? TEMPLATES.en)[type];
  const pluralKey = params.count > 1 ? 'many' : 'one';
  const pair = entry.any ?? (entry as any)[pluralKey] ?? entry.one ?? entry.many!;
  return {
    title: fillTemplate(pair.title, params, locale, country),
    body:  fillTemplate(pair.body,  params, locale, country),
  };
}

function pickDailyPush(input: {
  overdueInvoiceCount: number;
  overdueInvoiceAmount: number;
  queuePendingCount: number;
  stalingQuoteCount: number;
  jobsTomorrowCount: number;
  // R80 US Phase 2: license-expiry signal. Highest priority since a
  // lapsed license can void insurance + trigger per-job fines.
  expiringLicense?: { days: number; type: string; state: string };
}, locale: PushLocale, country: string | null | undefined): Decision | null {
  // License expiry — fire at 14, 7, 0 days only so the contractor doesn't
  // get daily spam between 30d and renewal.
  if (input.expiringLicense && [14, 7, 0].includes(input.expiringLicense.days)) {
    const params = { count: 1, days: input.expiringLicense.days, licenseType: input.expiringLicense.type.replace(/_/g, ' ') };
    const { title, body } = formatForLocale('license_expiring', params, locale, country);
    return {
      type: 'license_expiring',
      title,
      body,
      entityKey: `license:${input.expiringLicense.type}:${input.expiringLicense.state}:${input.expiringLicense.days}`,
      params,
    };
  }
  if (input.overdueInvoiceCount >= MIN_OVERDUE_COUNT && input.overdueInvoiceAmount >= MIN_OVERDUE_AMOUNT) {
    const params = { count: input.overdueInvoiceCount, amount: input.overdueInvoiceAmount };
    const { title, body } = formatForLocale('overdue_invoices', params, locale, country);
    return { type: 'overdue_invoices', title, body, entityKey: `overdue:${input.overdueInvoiceCount}:${input.overdueInvoiceAmount}`, params };
  }
  if (input.queuePendingCount >= MIN_QUEUE) {
    const params = { count: input.queuePendingCount };
    const { title, body } = formatForLocale('queue_waiting', params, locale, country);
    return { type: 'queue_waiting', title, body, entityKey: `queue:${input.queuePendingCount}`, params };
  }
  if (input.stalingQuoteCount >= MIN_STALING) {
    const params = { count: input.stalingQuoteCount };
    const { title, body } = formatForLocale('staling_quotes', params, locale, country);
    return { type: 'staling_quotes', title, body, entityKey: `staling:${input.stalingQuoteCount}`, params };
  }
  if (input.jobsTomorrowCount >= MIN_JOBS_TOMORROW) {
    const params = { count: input.jobsTomorrowCount };
    const { title, body } = formatForLocale('jobs_tomorrow', params, locale, country);
    return { type: 'jobs_tomorrow', title, body, entityKey: `tomorrow:${input.jobsTomorrowCount}`, params };
  }
  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return json({ error: 'missing env' }, 500);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Users with at least one push token registered.
  const { data: tokenRows } = await admin
    .from('push_tokens')
    .select('user_id')
    .not('user_id', 'is', null);

  const userIds = Array.from(new Set((tokenRows ?? []).map((t: any) => t.user_id))).filter(Boolean);
  if (userIds.length === 0) return json({ processed: 0, sent: 0 });

  const nowIso = new Date().toISOString();
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const results: Array<{ userId: string; decision: string; delivery: string }> = [];
  let sentCount = 0;

  for (const userId of userIds) {
    // Rate-limit: skip if any push sent to this user in the last 24h.
    const { count: recentPushes } = await admin
      .from('push_notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('sent_at', dayAgoIso);
    if ((recentPushes ?? 0) > 0) {
      results.push({ userId, decision: 'skip', delivery: 'rate-limited' });
      continue;
    }

    // R227: look up country → locale so push copy is localized. If the
    // business_settings row is missing we fall through to English.
    // R80: also pull `licenses` to evaluate the US expiry signal — empty
    // array for non-US contractors so the signal stays inert there.
    const { data: settings } = await admin
      .from('business_settings')
      .select('country, licenses')
      .eq('user_id', userId)
      .maybeSingle();
    const country = (settings as any)?.country;
    const locale = localeForCountry(country);

    // R80 US Phase 2: closest expiring license at 14/7/0-day boundaries.
    // We compute client-side rather than via get_expiring_licenses RPC
    // because we already have the row loaded — saves a round trip.
    let expiringLicense: { days: number; type: string; state: string } | undefined;
    if (country === 'US' && Array.isArray((settings as any)?.licenses)) {
      const today = new Date(); today.setUTCHours(12, 0, 0, 0);
      const todayMs = today.getTime();
      const MS_DAY = 24 * 60 * 60 * 1000;
      const candidates = ((settings as any).licenses as Array<{ type?: string; state?: string; expiryDate?: string }>)
        .map((l) => {
          if (!l?.expiryDate) return null;
          const expiry = new Date(`${l.expiryDate}T12:00:00.000Z`).getTime();
          const days = Math.round((expiry - todayMs) / MS_DAY);
          return { days, type: l.type ?? 'license', state: l.state ?? '' };
        })
        .filter((x): x is { days: number; type: string; state: string } => x !== null && [14, 7, 0].includes(x.days));
      candidates.sort((a, b) => a.days - b.days);
      if (candidates.length > 0) expiringLicense = candidates[0];
    }

    // 2. Fetch state.
    const [overdue, queue, staling, tomorrow] = await Promise.all([
      admin.from('documents')
        .select('total_amount')
        .eq('user_id', userId)
        .eq('doc_type', 'invoice')
        // 'overdue' is a COMPUTED state, never stored — filtering status='overdue'
        // returned zero rows. Overdue = sent (not paid) with a past due_date.
        .eq('status', 'sent')
        .lt('due_date', new Date().toISOString().slice(0, 10)),
      admin.from('ai_queue_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending'),
      admin.from('documents')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('doc_type', 'quote')
        .eq('status', 'sent')
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      admin.from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        // jobs has no `scheduled_at` — the column is `scheduled_date` (a date).
        .gte('scheduled_date', tomorrowStart.toISOString().slice(0, 10))
        .lt('scheduled_date', tomorrowEnd.toISOString().slice(0, 10)),
    ]);

    const overdueRows = (overdue.data ?? []) as Array<{ total_amount: number | null }>;
    const overdueAmount = Math.round(
      overdueRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0),
    );
    const decision = pickDailyPush({
      overdueInvoiceCount: overdueRows.length,
      overdueInvoiceAmount: overdueAmount,
      queuePendingCount: queue.count ?? 0,
      stalingQuoteCount: (staling.data ?? []).length,
      jobsTomorrowCount: tomorrow.count ?? 0,
      expiringLicense,
    }, locale, country);

    if (!decision) {
      results.push({ userId, decision: 'none', delivery: 'skipped' });
      continue;
    }

    // 3. 24h dedupe on (type, entity_key).
    const { count: dedup } = await admin
      .from('push_notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('notif_type', decision.type)
      .eq('entity_key', decision.entityKey)
      .gte('sent_at', dayAgoIso);
    if ((dedup ?? 0) > 0) {
      results.push({ userId, decision: decision.type, delivery: 'deduped' });
      continue;
    }

    // 4. Fan out via existing send-push Edge Function.
    let success = true;
    let err: string | null = null;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({
          userId,
          title: decision.title,
          body: decision.body,
          data: { type: decision.type, entityKey: decision.entityKey },
        }),
      });
      if (!res.ok) { success = false; err = `send-push ${res.status}`; }
    } catch (e) {
      success = false;
      err = (e as Error).message;
    }

    await admin.from('push_notification_log').insert({
      user_id: userId,
      notif_type: decision.type,
      entity_key: decision.entityKey,
      title: decision.title,
      body: decision.body,
      success,
      error: err,
      sent_at: nowIso,
    });

    if (success) sentCount += 1;
    results.push({ userId, decision: decision.type, delivery: success ? 'sent' : `failed:${err}` });
  }

  return json({ processed: userIds.length, sent: sentCount, results });
});
