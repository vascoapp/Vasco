// =============================================================================
// CHURN WIN-BACK POLICY (R228)
// =============================================================================
// Pure function: given a user's activity signal, decide whether to send a
// win-back email today and which variant to send.
//
// Two variants:
//   - `new_stalled`  — signed up but never completed a money action
//                      (no quote_sent, no invoice_sent). Focus on the
//                      "30-second path to first win".
//   - `active_quiet` — had activity before, then went silent 14+ days.
//                      Focus on cohort-relative progress + the value
//                      they're leaving on the table.
//
// Rate-limit (enforced by the Edge Function via churn_winback_log):
//   - Max 1 win-back per user per 30 days.
//   - Daily re-evaluation; the picker itself doesn't track history.
// =============================================================================

export type WinbackVariant = 'new_stalled' | 'active_quiet';
export type WinbackLocale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

export interface WinbackInput {
  daysSinceLastActivity: number;        // days since last business_event
  daysSinceSignup: number;               // used to disambiguate variants
  hasMonetaryActivity: boolean;          // any quote_sent / invoice_sent / payment_received ever
}

export interface WinbackDecision {
  variant: WinbackVariant;
  subject: string;
  body: string;                          // plain-text body; HTML wrapping happens in the Edge Function
  daysSinceLastActivity: number;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const MIN_DAYS_SILENT = 14;
// Don't ping brand-new signups on day 1 — give them at least a week to try
// the app on their own terms before we start talking to them.
const MIN_DAYS_SINCE_SIGNUP = 7;

export function pickWinback(input: WinbackInput, locale: WinbackLocale = 'en'): WinbackDecision | null {
  if (input.daysSinceLastActivity < MIN_DAYS_SILENT) return null;
  if (input.daysSinceSignup < MIN_DAYS_SINCE_SIGNUP) return null;

  const variant: WinbackVariant = input.hasMonetaryActivity ? 'active_quiet' : 'new_stalled';
  const template = (TEMPLATES[locale] ?? TEMPLATES.en)[variant];

  return {
    variant,
    subject: template.subject,
    body: fill(template.body, { days: input.daysSinceLastActivity }),
    daysSinceLastActivity: input.daysSinceLastActivity,
  };
}

function fill(tpl: string, params: { days: number }): string {
  return tpl.replace('{days}', String(params.days));
}

// ---------------------------------------------------------------------------
// 6-locale email copy. Same inlined-table pattern as R227 so the Edge
// Function can mirror it without cross-runtime imports.
// ---------------------------------------------------------------------------

type Template = { subject: string; body: string };

const TEMPLATES: Record<WinbackLocale, Record<WinbackVariant, Template>> = {
  en: {
    new_stalled: {
      subject: 'Still setting up Vasco?',
      body:
        "Hi — it's been {days} days since you signed up. Getting the first quote out is the biggest hurdle, so we built a 30-second path:\n\n" +
        "• Tap 'New quote' from the Vandaag tab\n" +
        "• Pick a service from the pricebook\n" +
        "• Vasco tunes the price against the cohort and sends it\n\n" +
        "That's it. If something's blocking you, reply to this email — we read every one.\n",
    },
    active_quiet: {
      subject: 'Your Vasco has been quiet',
      body:
        "You've been away from Vasco for {days} days. Here's what probably piled up while you were heads-down:\n\n" +
        "• Overdue invoices your customers might forget\n" +
        "• Quotes past the cohort's typical accept-lag\n" +
        "• EVE-queue drafts Vasco prepared for you\n\n" +
        "Open the app once and we'll show you exactly what to do first.\n",
    },
  },
  nl: {
    new_stalled: {
      subject: 'Nog aan het opstarten met Vasco?',
      body:
        "Hé — {days} dagen geleden heb je je aangemeld. De eerste offerte versturen is de grootste horde, dus we hebben een 30-seconden-pad:\n\n" +
        "• Tik op 'Nieuwe offerte' vanaf Vandaag\n" +
        "• Kies een dienst uit het prijsboek\n" +
        "• Vasco stemt de prijs af op het cohort en stuurt\n\n" +
        "Dat is het. Zit je ergens op vast? Reageer op deze mail — we lezen ze allemaal.\n",
    },
    active_quiet: {
      subject: 'Je Vasco is stil',
      body:
        "Je bent {days} dagen weggeweest uit Vasco. Dit is wat er waarschijnlijk is opgestapeld:\n\n" +
        "• Openstaande facturen die klanten kunnen vergeten\n" +
        "• Offertes voorbij de normale acceptatietijd\n" +
        "• EVE-wachtrij items die Vasco voor je klaarzet\n\n" +
        "Open de app één keer en we laten zien wat je als eerste moet doen.\n",
    },
  },
  de: {
    new_stalled: {
      subject: 'Noch am Einrichten von Vasco?',
      body:
        "Hallo — {days} Tage seit deiner Anmeldung. Das erste Angebot zu versenden ist die größte Hürde, deshalb gibt es einen 30-Sekunden-Weg:\n\n" +
        "• 'Neues Angebot' vom Vandaag-Tab antippen\n" +
        "• Leistung aus dem Preisbuch wählen\n" +
        "• Vasco stimmt den Preis auf die Kohorte ab und versendet\n\n" +
        "Fertig. Hängst du irgendwo? Antworte auf diese Mail — wir lesen jede.\n",
    },
    active_quiet: {
      subject: 'Dein Vasco ist leise',
      body:
        "Du warst {days} Tage weg von Vasco. Hier, was sich wahrscheinlich angestaut hat:\n\n" +
        "• Überfällige Rechnungen, die Kunden vergessen können\n" +
        "• Angebote jenseits der üblichen Annahmezeit\n" +
        "• EVE-Queue-Entwürfe, die Vasco für dich vorbereitet hat\n\n" +
        "Öffne die App einmal und wir zeigen dir, was zuerst dran ist.\n",
    },
  },
  fr: {
    new_stalled: {
      subject: 'Toujours en configuration sur Vasco ?',
      body:
        "Bonjour — {days} jours depuis votre inscription. Envoyer le premier devis est le plus gros obstacle, donc voici un chemin de 30 secondes :\n\n" +
        "• Tapez 'Nouveau devis' depuis l'onglet Vandaag\n" +
        "• Choisissez une prestation dans le catalogue\n" +
        "• Vasco ajuste le prix sur la cohorte et envoie\n\n" +
        "C'est tout. Un blocage ? Répondez à cet e-mail — nous les lisons tous.\n",
    },
    active_quiet: {
      subject: 'Votre Vasco est silencieux',
      body:
        "Vous avez été absent de Vasco pendant {days} jours. Voici ce qui s'est probablement accumulé :\n\n" +
        "• Factures impayées que vos clients peuvent oublier\n" +
        "• Devis au-delà du délai habituel d'acceptation\n" +
        "• Éléments EVE que Vasco a préparés pour vous\n\n" +
        "Ouvrez l'app une fois et nous vous montrons quoi faire en premier.\n",
    },
  },
  es: {
    new_stalled: {
      subject: '¿Aún configurando Vasco?',
      body:
        "Hola — han pasado {days} días desde que te registraste. Enviar el primer presupuesto es el mayor obstáculo, por eso hay una ruta de 30 segundos:\n\n" +
        "• Toca 'Nuevo presupuesto' desde la pestaña Vandaag\n" +
        "• Elige un servicio del catálogo\n" +
        "• Vasco ajusta el precio con la cohorte y lo envía\n\n" +
        "Eso es todo. ¿Algo te bloquea? Responde a este correo — los leemos todos.\n",
    },
    active_quiet: {
      subject: 'Tu Vasco está en silencio',
      body:
        "Has estado ausente de Vasco {days} días. Esto es lo que probablemente se ha acumulado:\n\n" +
        "• Facturas vencidas que los clientes pueden olvidar\n" +
        "• Presupuestos pasados del tiempo de aceptación típico\n" +
        "• Borradores EVE que Vasco preparó para ti\n\n" +
        "Abre la app una vez y te mostramos qué hacer primero.\n",
    },
  },
  it: {
    new_stalled: {
      subject: 'Ancora in configurazione su Vasco?',
      body:
        "Ciao — sono passati {days} giorni dall'iscrizione. Mandare il primo preventivo è lo scoglio più grande, quindi c'è un percorso da 30 secondi:\n\n" +
        "• Tocca 'Nuovo preventivo' dalla scheda Vandaag\n" +
        "• Scegli un servizio dal listino\n" +
        "• Vasco calibra il prezzo sulla coorte e invia\n\n" +
        "Fatto. Qualcosa ti blocca? Rispondi a questa mail — le leggiamo tutte.\n",
    },
    active_quiet: {
      subject: 'Il tuo Vasco è silenzioso',
      body:
        "Sei stato lontano da Vasco per {days} giorni. Ecco cosa probabilmente si è accumulato:\n\n" +
        "• Fatture scadute che i clienti possono dimenticare\n" +
        "• Preventivi oltre il tempo di accettazione tipico\n" +
        "• Bozze della coda EVE che Vasco ha preparato\n\n" +
        "Apri l'app una volta e ti mostriamo cosa fare per primo.\n",
    },
  },
};

export const __internal = {
  MIN_DAYS_SILENT,
  MIN_DAYS_SINCE_SIGNUP,
  TEMPLATES,
};
