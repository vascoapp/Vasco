// =============================================================================
// PUSH DIGEST POLICY (R226)
// =============================================================================
// Pure function: given a user's current state (overdue invoice count,
// staling quote count, waiting queue items, jobs tomorrow), decide what
// SINGLE money-relevant push to send them today — or nothing.
//
// The matching Edge Function (`daily-push-digest`) mirrors this logic
// against live DB state. Kept in sync by hand; drift is caught by the
// jest suite here.
//
// Priority order (money first): overdue > queue > staling quotes > jobs.
// Only one push per user per day.
// =============================================================================

import { formatCurrency0, type Country } from '../i18n/formatting';

export type PushType =
  | 'overdue_invoices'
  | 'queue_waiting'
  | 'staling_quotes'
  | 'jobs_tomorrow';

export interface PushDigestInput {
  overdueInvoiceCount: number;
  overdueInvoiceAmount: number;      // rounded euros
  queuePendingCount: number;
  stalingQuoteCount: number;         // quotes past cohort p75 accept-lag, not yet decided
  jobsTomorrowCount: number;
}

export interface PushDecision {
  type: PushType;
  /** Formatted in English by default (backwards-compat with R226). Use
   *  `formatForLocale` to get localized variants. */
  title: string;
  body: string;
  entityKey: string;
  /** Raw numbers/strings consumed by format templates. Exposed so the
   *  Edge Function (Deno) can localize without re-deriving state. */
  params: {
    count: number;
    amount?: number;
  };
}

export type PushLocale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

/** Country → locale (UK is English; every other EU6 country uses its own). */
export function localeForCountry(country: string | null | undefined): PushLocale {
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

// Threshold floors — below these, the signal is too thin to interrupt the
// contractor's evening. They still see it in-app; we just don't push.
const MIN_OVERDUE_COUNT = 1;
const MIN_OVERDUE_AMOUNT = 200;
const MIN_QUEUE = 2;
const MIN_STALING = 1;
const MIN_JOBS_TOMORROW = 1;

/**
 * Pick exactly one notification or return null. English-only for v1 —
 * localization ships in a follow-up round; the Edge Function will
 * swap in the user's locale-specific string table at send time.
 */
// `country` decides the currency of the PROVISIONAL title/body filled in
// below. Those are English placeholders (note the hardcoded 'en' locale) that
// every consumer replaces via formatForLocale with the contractor's real
// locale AND country — hence the en-coherent default rather than a euro one.
export function pickDailyPush(input: PushDigestInput, country: Country = 'UK'): PushDecision | null {
  // 1. Overdue invoices — highest priority (real money at stake).
  if (
    input.overdueInvoiceCount >= MIN_OVERDUE_COUNT
    && input.overdueInvoiceAmount >= MIN_OVERDUE_AMOUNT
  ) {
    const decision: PushDecision = {
      type: 'overdue_invoices',
      title: '', body: '',
      entityKey: `overdue:${input.overdueInvoiceCount}:${input.overdueInvoiceAmount}`,
      params: { count: input.overdueInvoiceCount, amount: input.overdueInvoiceAmount },
    };
    const en = formatForLocale(decision, 'en', country);
    return { ...decision, title: en.title, body: en.body };
  }

  // 2. Queue items waiting — EVE has drafts ready for approval.
  if (input.queuePendingCount >= MIN_QUEUE) {
    const decision: PushDecision = {
      type: 'queue_waiting',
      title: '', body: '',
      entityKey: `queue:${input.queuePendingCount}`,
      params: { count: input.queuePendingCount },
    };
    const en = formatForLocale(decision, 'en', country);
    return { ...decision, title: en.title, body: en.body };
  }

  // 3. Staling quotes — past the cohort p75 accept-lag with no customer reply.
  if (input.stalingQuoteCount >= MIN_STALING) {
    const decision: PushDecision = {
      type: 'staling_quotes',
      title: '', body: '',
      entityKey: `staling:${input.stalingQuoteCount}`,
      params: { count: input.stalingQuoteCount },
    };
    const en = formatForLocale(decision, 'en', country);
    return { ...decision, title: en.title, body: en.body };
  }

  // 4. Jobs tomorrow — softer, schedule-oriented.
  if (input.jobsTomorrowCount >= MIN_JOBS_TOMORROW) {
    const decision: PushDecision = {
      type: 'jobs_tomorrow',
      title: '', body: '',
      entityKey: `tomorrow:${input.jobsTomorrowCount}`,
      params: { count: input.jobsTomorrowCount },
    };
    const en = formatForLocale(decision, 'en', country);
    return { ...decision, title: en.title, body: en.body };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Locale-aware formatting (R227)
// ---------------------------------------------------------------------------
// Inlined string table — the Edge Function mirrors this exact object so we
// stay portable to Deno (no shared JSON import needed). Templates use
// `{count}` and `{amount}` placeholders; numeric formatting happens here
// with the locale's thousands separator.

type TemplatePair = { title: string; body: string };

/**
 * One entry per (locale, type). Singular/plural split only where the
 * language actually needs it (English "invoice"/"invoices" etc).
 * European trades use slightly different framing — "in scadenza" (IT)
 * carries urgency better than a literal "overdue" translation.
 */
const TEMPLATES: Record<PushLocale, Record<PushType, { one?: TemplatePair; many?: TemplatePair; any?: TemplatePair }>> = {
  en: {
    overdue_invoices: {
      one:  { title: '{amount} overdue',            body: '{count} invoice past due. Send a reminder in 2 taps.' },
      many: { title: '{amount} overdue',            body: '{count} invoices past due. Send a reminder in 2 taps.' },
    },
    queue_waiting: { any: { title: '{count} actions waiting', body: 'Vasco prepared {count} things for you. Approve or skip.' } },
    staling_quotes: {
      one:  { title: '{count} quote going stale',    body: 'Cohort usually accepts within a week. A nudge often unsticks them.' },
      many: { title: '{count} quotes going stale',   body: 'Cohort usually accepts within a week. A nudge often unsticks them.' },
    },
    jobs_tomorrow: {
      one:  { title: '{count} job tomorrow',         body: 'Materials ready? Route planned? Tap to prep in 30 seconds.' },
      many: { title: '{count} jobs tomorrow',        body: 'Materials ready? Route planned? Tap to prep in 30 seconds.' },
    },
  },
  nl: {
    overdue_invoices: {
      one:  { title: '{amount} te laat',            body: '{count} factuur staat open. Stuur herinnering in 2 tikken.' },
      many: { title: '{amount} te laat',            body: '{count} facturen staan open. Stuur herinnering in 2 tikken.' },
    },
    queue_waiting: { any: { title: '{count} acties wachten', body: 'Vasco heeft {count} dingen voor je klaarstaan. Keur goed of sla over.' } },
    staling_quotes: {
      one:  { title: '{count} offerte loopt vast',   body: 'Cohort accepteert meestal binnen een week. Een nudge helpt vaak.' },
      many: { title: '{count} offertes lopen vast',  body: 'Cohort accepteert meestal binnen een week. Een nudge helpt vaak.' },
    },
    jobs_tomorrow: {
      one:  { title: '{count} klus morgen',          body: 'Materiaal gereed? Route gepland? Tik om in 30s voor te bereiden.' },
      many: { title: '{count} klussen morgen',       body: 'Materiaal gereed? Route gepland? Tik om in 30s voor te bereiden.' },
    },
  },
  de: {
    overdue_invoices: {
      one:  { title: '{amount} überfällig',         body: '{count} Rechnung überfällig. In 2 Taps erinnern.' },
      many: { title: '{amount} überfällig',         body: '{count} Rechnungen überfällig. In 2 Taps erinnern.' },
    },
    queue_waiting: { any: { title: '{count} Aktionen warten', body: 'Vasco hat {count} Dinge vorbereitet. Genehmigen oder überspringen.' } },
    staling_quotes: {
      one:  { title: '{count} Angebot bleibt hängen',  body: 'Die Kohorte nimmt meist innerhalb einer Woche an. Ein Nachfassen hilft.' },
      many: { title: '{count} Angebote bleiben hängen', body: 'Die Kohorte nimmt meist innerhalb einer Woche an. Ein Nachfassen hilft.' },
    },
    jobs_tomorrow: {
      one:  { title: '{count} Auftrag morgen',       body: 'Material bereit? Route geplant? 30 Sekunden bis startklar.' },
      many: { title: '{count} Aufträge morgen',      body: 'Material bereit? Route geplant? 30 Sekunden bis startklar.' },
    },
  },
  fr: {
    overdue_invoices: {
      one:  { title: '{amount} en retard',         body: '{count} facture impayée. Relance en 2 taps.' },
      many: { title: '{amount} en retard',         body: '{count} factures impayées. Relance en 2 taps.' },
    },
    queue_waiting: { any: { title: '{count} actions en attente', body: 'Vasco a préparé {count} éléments. Approuvez ou passez.' } },
    staling_quotes: {
      one:  { title: '{count} devis ralenti',        body: 'La cohorte accepte habituellement en une semaine. Une relance aide.' },
      many: { title: '{count} devis ralentis',       body: 'La cohorte accepte habituellement en une semaine. Une relance aide.' },
    },
    jobs_tomorrow: {
      one:  { title: '{count} chantier demain',      body: 'Matériel prêt ? Itinéraire ? 30s pour tout préparer.' },
      many: { title: '{count} chantiers demain',     body: 'Matériel prêt ? Itinéraires ? 30s pour tout préparer.' },
    },
  },
  es: {
    overdue_invoices: {
      one:  { title: '{amount} vencidos',          body: '{count} factura vencida. Envía recordatorio en 2 toques.' },
      many: { title: '{amount} vencidos',          body: '{count} facturas vencidas. Envía recordatorio en 2 toques.' },
    },
    queue_waiting: { any: { title: '{count} acciones esperando', body: 'Vasco preparó {count} cosas. Aprueba o salta.' } },
    staling_quotes: {
      one:  { title: '{count} presupuesto atascado', body: 'La cohorte acepta en ~1 semana. Un recordatorio suele funcionar.' },
      many: { title: '{count} presupuestos atascados', body: 'La cohorte acepta en ~1 semana. Un recordatorio suele funcionar.' },
    },
    jobs_tomorrow: {
      one:  { title: '{count} obra mañana',          body: '¿Materiales listos? ¿Ruta? 30s para prepararlo.' },
      many: { title: '{count} obras mañana',         body: '¿Materiales listos? ¿Rutas? 30s para prepararlo.' },
    },
  },
  it: {
    overdue_invoices: {
      one:  { title: '{amount} in scadenza',       body: '{count} fattura scaduta. Invia sollecito in 2 tap.' },
      many: { title: '{amount} in scadenza',       body: '{count} fatture scadute. Invia sollecito in 2 tap.' },
    },
    queue_waiting: { any: { title: '{count} azioni in attesa', body: 'Vasco ha preparato {count} cose. Approva o salta.' } },
    staling_quotes: {
      one:  { title: '{count} preventivo fermo',     body: 'La coorte accetta di solito entro una settimana. Un sollecito aiuta.' },
      many: { title: '{count} preventivi fermi',     body: 'La coorte accetta di solito entro una settimana. Un sollecito aiuta.' },
    },
    jobs_tomorrow: {
      one:  { title: '{count} cantiere domani',      body: 'Materiali pronti? Percorso? 30s per prepararti.' },
      many: { title: '{count} cantieri domani',      body: 'Materiali pronti? Percorsi? 30s per prepararti.' },
    },
  },
};

// The SYMBOL is no longer baked into the templates. 'en' serves UK and US as
// well as generic English (see localeForCountry), so a euro in the English
// string put "€" on a British contractor's lock screen for money they bill in
// pounds. The COUNTRY decides the currency; Intl decides symbol, position and
// grouping. Mirrored by formatAmount in the daily-push-digest Edge Function.
function formatAmount(n: number, country: Country): string {
  return formatCurrency0(n, country);
}

function fillTemplate(tpl: string, params: { count: number; amount?: number }, country: Country): string {
  return tpl
    .replace('{count}', String(params.count))
    .replace('{amount}', params.amount != null ? formatAmount(params.amount, country) : '');
}

export interface FormattedPush {
  title: string;
  body: string;
}

/**
 * Resolve a decision against a locale. Falls back to English when the
 * locale is unknown or the template pair is missing (shouldn't happen —
 * tests cover every combo).
 */
export function formatForLocale(decision: PushDecision, locale: PushLocale, country: Country): FormattedPush {
  const table = TEMPLATES[locale] ?? TEMPLATES.en;
  const entry = table[decision.type];
  const pluralKey = decision.params.count > 1 ? 'many' : 'one';
  const pair = entry.any ?? entry[pluralKey] ?? entry.one ?? entry.many!;
  return {
    title: fillTemplate(pair.title, decision.params, country),
    body:  fillTemplate(pair.body,  decision.params, country),
  };
}

export const __internal = {
  MIN_OVERDUE_COUNT,
  MIN_OVERDUE_AMOUNT,
  MIN_QUEUE,
  MIN_STALING,
  MIN_JOBS_TOMORROW,
  TEMPLATES,
};
