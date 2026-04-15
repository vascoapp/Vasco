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
  | 'review_request';

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
