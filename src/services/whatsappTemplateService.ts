// =============================================================================
// WHATSAPP BUSINESS TEMPLATE SERVICE
// =============================================================================
// Renders approved Business-template copy in 6 languages with variable
// substitution. Consent is tracked per-customer — we never hit WhatsApp
// without an explicit opt-in recorded in AsyncStorage (+ Supabase later).
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export type TemplateId =
  | 'appointment_reminder'
  | 'on_my_way'
  | 'quote_sent'
  | 'payment_reminder'
  | 'payment_thanks'
  | 'review_request'
  | 'maintenance_due';

export type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

const TEMPLATES: Record<TemplateId, Record<Locale, string>> = {
  appointment_reminder: {
    en: `Hi {{customer}}, just a reminder of our appointment tomorrow at {{time}} for {{job}}. Reply if you need to reschedule. — {{business}}`,
    nl: `Hoi {{customer}}, even een herinnering: morgen om {{time}} hebben we de afspraak voor {{job}}. Laat het weten als je wilt verzetten. — {{business}}`,
    de: `Hallo {{customer}}, kurze Erinnerung an unseren Termin morgen um {{time}} für {{job}}. Melden Sie sich, falls ein anderer Zeitpunkt besser passt. — {{business}}`,
    fr: `Bonjour {{customer}}, rappel de notre rendez-vous demain à {{time}} pour {{job}}. Dites-moi si vous voulez décaler. — {{business}}`,
    es: `Hola {{customer}}, recordatorio de nuestra cita mañana a las {{time}} para {{job}}. Avísame si quieres cambiarla. — {{business}}`,
    it: `Ciao {{customer}}, promemoria dell'appuntamento domani alle {{time}} per {{job}}. Scrivimi se vuoi spostarlo. — {{business}}`,
  },
  on_my_way: {
    en: `Hi {{customer}}, I'm on my way — ETA {{eta}}. — {{business}}`,
    nl: `Hoi {{customer}}, ik ben onderweg — ETA {{eta}}. — {{business}}`,
    de: `Hallo {{customer}}, ich bin unterwegs — ETA {{eta}}. — {{business}}`,
    fr: `Bonjour {{customer}}, je suis en route — arrivée estimée {{eta}}. — {{business}}`,
    es: `Hola {{customer}}, estoy de camino — ETA {{eta}}. — {{business}}`,
    it: `Ciao {{customer}}, sto arrivando — ETA {{eta}}. — {{business}}`,
  },
  quote_sent: {
    en: `Hi {{customer}}, I've just sent you quote {{ref}}. Check your email or tap: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, ik heb offerte {{ref}} net gestuurd. Check je mail of open: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, Angebot {{ref}} ist unterwegs. E-Mail prüfen oder direkt öffnen: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, je viens de vous envoyer le devis {{ref}}. Email ou lien direct : {{link}} — {{business}}`,
    es: `Hola {{customer}}, te acabo de enviar el presupuesto {{ref}}. Email o enlace: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, ti ho appena inviato il preventivo {{ref}}. Email o link: {{link}} — {{business}}`,
  },
  payment_reminder: {
    en: `Hi {{customer}}, a friendly reminder — invoice {{ref}} of {{amount}} is due. Pay here: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, vriendelijke herinnering — factuur {{ref}} van {{amount}} is vervallen. Betaal hier: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, freundliche Erinnerung — Rechnung {{ref}} über {{amount}} ist fällig. Bezahlen: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, rappel — facture {{ref}} de {{amount}} est à régler. Payer : {{link}} — {{business}}`,
    es: `Hola {{customer}}, recordatorio — la factura {{ref}} de {{amount}} está pendiente. Paga: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, promemoria — fattura {{ref}} di {{amount}} è in scadenza. Paga: {{link}} — {{business}}`,
  },
  payment_thanks: {
    en: `Thanks {{customer}} — payment received for invoice {{ref}}. Receipt on its way. — {{business}}`,
    nl: `Bedankt {{customer}} — betaling ontvangen voor factuur {{ref}}. Ontvangstbewijs komt eraan. — {{business}}`,
    de: `Danke {{customer}} — Zahlung für Rechnung {{ref}} erhalten. Beleg folgt. — {{business}}`,
    fr: `Merci {{customer}} — paiement reçu pour la facture {{ref}}. Reçu à suivre. — {{business}}`,
    es: `Gracias {{customer}} — pago recibido para la factura {{ref}}. Recibo en camino. — {{business}}`,
    it: `Grazie {{customer}} — pagamento ricevuto per la fattura {{ref}}. Ricevuta in arrivo. — {{business}}`,
  },
  // Offering the next visit to a customer the history says is due. Phrased as
  // an offer with a question, not a booking: nothing has been scheduled, and a
  // message that implies a date the contractor has not set would put them in
  // the wrong with their own customer.
  //
  // `since` carries a plain phrase ("about a year") rather than a date — the
  // interval is a median of past gaps, so quoting it to the day would claim a
  // precision the observation does not have.
  maintenance_due: {
    en: `Hi {{customer}}, it's been {{since}} since I last looked at {{job}}. Want me to book the next visit? — {{business}}`,
    nl: `Hoi {{customer}}, het is inmiddels {{since}} geleden dat ik naar {{job}} heb gekeken. Zal ik de volgende beurt inplannen? — {{business}}`,
    de: `Hallo {{customer}}, es ist etwa {{since}} her, dass ich mir {{job}} angesehen habe. Soll ich den nächsten Termin einplanen? — {{business}}`,
    fr: `Bonjour {{customer}}, cela fait {{since}} que je ne suis pas passé pour {{job}}. Je vous programme la prochaine visite ? — {{business}}`,
    es: `Hola {{customer}}, hace {{since}} que no reviso {{job}}. ¿Te programo la próxima visita? — {{business}}`,
    it: `Ciao {{customer}}, è passato circa {{since}} dall'ultima volta che ho controllato {{job}}. Ti fisso la prossima visita? — {{business}}`,
  },
  review_request: {
    en: `Hi {{customer}}, hope everything works well. Would you mind leaving a short review? {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, alles werkt naar wens? Een korte review helpt enorm: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, alles zu Ihrer Zufriedenheit? Eine kurze Bewertung hilft sehr: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, tout fonctionne bien ? Un petit avis nous aiderait beaucoup : {{link}} — {{business}}`,
    es: `Hola {{customer}}, ¿todo funciona bien? Una reseña breve nos ayuda mucho: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, tutto ok? Una breve recensione aiuta molto: {{link}} — {{business}}`,
  },
};

export function renderTemplate(id: TemplateId, locale: Locale, vars: Record<string, string>): string {
  const tpl = (TEMPLATES[id]?.[locale]) ?? TEMPLATES[id]?.en ?? '';
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ── R301: Tone variants for payment_reminder ────────────────────────────────
// Customer-tag-keyed template variants. The contractor's customerTaggingService
// scoreCustomer() returns vip/loyal/new/risky/inactive; map to gentle/standard/firm
// before render. Without this layer the same text went to a VIP and a 4×-overdue
// risky customer — R12 cosmetic-only finding.
export type ReminderTone = 'gentle' | 'standard' | 'firm';

const PAYMENT_REMINDER_VARIANTS: Record<ReminderTone, Record<Locale, string>> = {
  gentle: {
    en: `Hi {{customer}}, just a courtesy nudge — invoice {{ref}} ({{amount}}) is due. Whenever you have a moment: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, gewoon even een vriendelijk seintje — factuur {{ref}} ({{amount}}) staat open. Wanneer het je uitkomt: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, nur ein freundlicher Hinweis — Rechnung {{ref}} ({{amount}}) ist fällig. Wenn es passt: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, juste un petit rappel amical — facture {{ref}} ({{amount}}) à régler. Quand vous avez un instant : {{link}} — {{business}}`,
    es: `Hola {{customer}}, solo un recordatorio amistoso — factura {{ref}} ({{amount}}) pendiente. Cuando puedas: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, solo un promemoria amichevole — fattura {{ref}} ({{amount}}) da saldare. Quando puoi: {{link}} — {{business}}`,
  },
  // Default tone — same as the original payment_reminder template.
  standard: {
    en: `Hi {{customer}}, a friendly reminder — invoice {{ref}} of {{amount}} is due. Pay here: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, vriendelijke herinnering — factuur {{ref}} van {{amount}} is vervallen. Betaal hier: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, freundliche Erinnerung — Rechnung {{ref}} über {{amount}} ist fällig. Bezahlen: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, rappel — facture {{ref}} de {{amount}} est à régler. Payer : {{link}} — {{business}}`,
    es: `Hola {{customer}}, recordatorio — la factura {{ref}} de {{amount}} está pendiente. Paga: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, promemoria — fattura {{ref}} di {{amount}} è in scadenza. Paga: {{link}} — {{business}}`,
  },
  firm: {
    en: `Hi {{customer}}, invoice {{ref}} of {{amount}} is overdue. Please settle this within 7 days: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, factuur {{ref}} van {{amount}} is vervallen. Voldoe deze binnen 7 dagen: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, Rechnung {{ref}} über {{amount}} ist überfällig. Bitte innerhalb von 7 Tagen begleichen: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, la facture {{ref}} de {{amount}} est en retard. Merci de régler sous 7 jours : {{link}} — {{business}}`,
    es: `Hola {{customer}}, la factura {{ref}} de {{amount}} está vencida. Por favor liquida en 7 días: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, la fattura {{ref}} di {{amount}} è scaduta. Si prega di saldare entro 7 giorni: {{link}} — {{business}}`,
  },
};

/**
 * Map a CustomerTag to the appropriate reminder tone.
 * - vip / loyal       → gentle (preserve relationship)
 * - new / undefined   → standard
 * - risky / inactive  → firm
 */
export function toneForCustomerTag(tag?: 'vip' | 'loyal' | 'new' | 'risky' | 'inactive'): ReminderTone {
  if (tag === 'vip' || tag === 'loyal') return 'gentle';
  if (tag === 'risky' || tag === 'inactive') return 'firm';
  return 'standard';
}

/**
 * Render a payment-reminder with a tone selected by customer tag.
 * Falls back to the standard `payment_reminder` template when called with
 * no tag — preserves backward-compat with existing call sites.
 */
export function renderPaymentReminderForTag(
  locale: Locale,
  vars: Record<string, string>,
  tag?: 'vip' | 'loyal' | 'new' | 'risky' | 'inactive',
): string {
  const tone = toneForCustomerTag(tag);
  const tpl = PAYMENT_REMINDER_VARIANTS[tone]?.[locale] ?? PAYMENT_REMINDER_VARIANTS[tone]?.en ?? '';
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ── R36: Tone variants for quote_sent + review_request (R12 deferral) ───────
// Closes the "30+ strings × 6 locales" R12 deferral for the two customer-
// facing templates that benefit most from per-tag tone — the first contact
// after a quote (where pacing matters for new vs returning customers) and
// the post-job review ask (where loyal customers get warmer phrasing).

const QUOTE_SENT_VARIANTS: Record<ReminderTone, Record<Locale, string>> = {
  gentle: {
    en: `Hi {{customer}}, here's quote {{ref}} as discussed — no rush, take your time: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, hier is offerte {{ref}} zoals afgesproken — geen haast, neem je tijd: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, hier ist Angebot {{ref}} wie besprochen — kein Druck, lassen Sie sich Zeit: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, voici le devis {{ref}} comme convenu — pas de pression, prenez votre temps : {{link}} — {{business}}`,
    es: `Hola {{customer}}, aquí está el presupuesto {{ref}} como hablamos — sin prisa, tómate tu tiempo: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, ecco il preventivo {{ref}} come discusso — nessuna fretta, prenditi il tempo: {{link}} — {{business}}`,
  },
  standard: {
    en: `Hi {{customer}}, I've just sent you quote {{ref}}. Check your email or tap: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, ik heb offerte {{ref}} net gestuurd. Check je mail of open: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, Angebot {{ref}} ist unterwegs. E-Mail prüfen oder direkt öffnen: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, je viens de vous envoyer le devis {{ref}}. Email ou lien direct : {{link}} — {{business}}`,
    es: `Hola {{customer}}, te acabo de enviar el presupuesto {{ref}}. Email o enlace: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, ti ho appena inviato il preventivo {{ref}}. Email o link: {{link}} — {{business}}`,
  },
  firm: {
    en: `Hi {{customer}}, quote {{ref}} is ready. Note: pricing valid for 14 days. {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, offerte {{ref}} staat klaar. Let op: prijzen geldig voor 14 dagen. {{link}} — {{business}}`,
    de: `Hallo {{customer}}, Angebot {{ref}} liegt bereit. Hinweis: Preise 14 Tage gültig. {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, le devis {{ref}} est prêt. À noter : prix valides 14 jours. {{link}} — {{business}}`,
    es: `Hola {{customer}}, el presupuesto {{ref}} está listo. Aviso: precios válidos 14 días. {{link}} — {{business}}`,
    it: `Ciao {{customer}}, il preventivo {{ref}} è pronto. Nota: prezzi validi 14 giorni. {{link}} — {{business}}`,
  },
};

const REVIEW_REQUEST_VARIANTS: Record<ReminderTone, Record<Locale, string>> = {
  gentle: {
    en: `Hi {{customer}}, it's been a pleasure working with you again. If you have a minute, a short review would mean the world: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, fijn dat we weer voor je mochten werken. Als je een minuutje hebt: een korte review betekent veel: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, schön, wieder für Sie gearbeitet zu haben. Eine kurze Bewertung würde uns sehr freuen: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, ravi d'avoir retravaillé avec vous. Un petit avis nous ferait grand plaisir : {{link}} — {{business}}`,
    es: `Hola {{customer}}, encantados de volver a trabajar contigo. Una reseña breve significaría mucho: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, è stato un piacere lavorare di nuovo con te. Una breve recensione significherebbe molto: {{link}} — {{business}}`,
  },
  standard: {
    en: `Hi {{customer}}, hope everything works well. Would you mind leaving a short review? {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, alles werkt naar wens? Een korte review helpt enorm: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, alles zu Ihrer Zufriedenheit? Eine kurze Bewertung hilft sehr: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, tout fonctionne bien ? Un petit avis nous aiderait beaucoup : {{link}} — {{business}}`,
    es: `Hola {{customer}}, ¿todo funciona bien? Una reseña breve nos ayuda mucho: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, tutto ok? Una breve recensione aiuta molto: {{link}} — {{business}}`,
  },
  firm: {
    // For risky/inactive — keep the ask but make it shorter + lower-pressure
    // to avoid burning the relationship further.
    en: `Hi {{customer}}, if the work was up to standard, a quick review would help: {{link}} — {{business}}`,
    nl: `Hoi {{customer}}, als het werk naar wens was: een snelle review helpt ons: {{link}} — {{business}}`,
    de: `Hallo {{customer}}, falls die Arbeit Ihren Erwartungen entsprach: eine kurze Bewertung hilft uns: {{link}} — {{business}}`,
    fr: `Bonjour {{customer}}, si le travail vous a convenu, un avis rapide nous aiderait : {{link}} — {{business}}`,
    es: `Hola {{customer}}, si el trabajo cumplió expectativas, una reseña rápida nos ayuda: {{link}} — {{business}}`,
    it: `Ciao {{customer}}, se il lavoro è stato all'altezza, una recensione rapida ci aiuta: {{link}} — {{business}}`,
  },
};

/** Render `quote_sent` with tone selected by customer tag. */
export function renderQuoteSentForTag(
  locale: Locale,
  vars: Record<string, string>,
  tag?: 'vip' | 'loyal' | 'new' | 'risky' | 'inactive',
): string {
  const tone = toneForCustomerTag(tag);
  const tpl = QUOTE_SENT_VARIANTS[tone]?.[locale] ?? QUOTE_SENT_VARIANTS[tone]?.en ?? '';
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/** Render `review_request` with tone selected by customer tag. */
export function renderReviewRequestForTag(
  locale: Locale,
  vars: Record<string, string>,
  tag?: 'vip' | 'loyal' | 'new' | 'risky' | 'inactive',
): string {
  const tone = toneForCustomerTag(tag);
  const tpl = REVIEW_REQUEST_VARIANTS[tone]?.[locale] ?? REVIEW_REQUEST_VARIANTS[tone]?.en ?? '';
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ── Consent ───────────────────────────────────────────────

const CONSENT_KEY = '@vasco_whatsapp_consent';

export async function grantConsent(customerId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(customerId);
    await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify([...set]));
  } catch {}
}

export async function revokeConsent(customerId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.delete(customerId);
    await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify([...set]));
  } catch {}
}

export async function hasConsent(customerId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(customerId);
  } catch {
    return false;
  }
}

// ── Send via wa.me link (client-side, no API key required) ────────

export interface SendArgs {
  customerId: string;
  phoneE164: string;         // +31612345678, no spaces
  template: TemplateId;
  locale: Locale;
  vars: Record<string, string>;
}

/**
 * @deprecated R300: zero call sites. Every caller of this module uses
 * `renderTemplate` and hands the text to `Share.share` (RN system sheet)
 * instead of going direct to WhatsApp. The consent-checked path remains
 * exported for the day a contractor wants WhatsApp-only delivery, but
 * `Share.share` covers the 95% case (contractor picks WhatsApp/iMessage/
 * email from the share menu themselves).
 */
export async function sendWhatsapp(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const consented = await hasConsent(args.customerId);
  if (!consented) return { ok: false, error: 'Customer has not consented to WhatsApp messages' };

  const text = renderTemplate(args.template, args.locale, args.vars);
  const phone = args.phoneE164.replace(/[^\d]/g, '');
  if (phone.length < 8) return { ok: false, error: 'Invalid phone number' };
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) return { ok: false, error: 'WhatsApp not installed' };
  await Linking.openURL(url);
  return { ok: true };
}
