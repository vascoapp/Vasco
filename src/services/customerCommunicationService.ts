// =============================================================================
// CUSTOMER COMMUNICATION ENGINE — DEPRECATED (R288)
// =============================================================================
// Status: ORPHAN — every export below has zero call sites outside this file
// as of R288's audit. The file describes "automated event-triggered messaging"
// but no scheduler / no event-emit pipeline ever invokes it. Two services
// duplicate parts of this surface and ARE used downstream:
//   - `whatsappTemplateService.ts` — canonical (consent + multi-locale templates,
//     used in app/contractor/job/[id].tsx for "on my way")
//   - `whatsappService.ts` — thin wrapper, used in VascoCard (enterprise only)
//
// DO NOT EXTEND THIS FILE. New customer-comm features should:
//   1. Add the template to `whatsappTemplateService.ts` if it's new copy.
//   2. Wire the event emitter (job-completed, invoice-paid, etc.) directly
//      to a renderTemplate + Share.share or Linking.openURL call.
//   3. Use `gateReminderSend` (from R287) for reminder-class sends.
//
// Removal is deferred — keeping the file in tree as a reference for the
// MessageTrigger taxonomy (8 lifecycle events) which IS load-bearing
// design intent. The implementations are not.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Share } from 'react-native';
import type { Country } from '../context/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

export type MessageChannel = 'whatsapp' | 'email' | 'sms';
export type MessageTrigger =
  | 'on_my_way'
  | 'appointment_reminder_24h'
  | 'appointment_reminder_2h'
  | 'job_started'
  | 'job_complete'
  | 'invoice_sent'
  | 'quote_sent'
  | 'review_request'
  | 'payment_received'
  | 'quote_followup'
  | 'payment_reminder';

export interface CustomerContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  preferredChannel: MessageChannel;
  whatsappOptIn: boolean;
  language: string;
}

export interface CommunicationEvent {
  id: string;
  trigger: MessageTrigger;
  channel: MessageChannel;
  customerId: string;
  customerName: string;
  jobId?: string;
  sentAt: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  messagePreview: string;
}

export interface CommunicationConfig {
  enabled: boolean;
  defaultChannel: MessageChannel;
  enabledTriggers: Record<MessageTrigger, boolean>;
  reminderTiming: { h24: boolean; h2: boolean };
  reviewRequestDelay: number;     // hours after job complete
  autoSendInvoice: boolean;
  autoSendQuote: boolean;
  whatsappBusinessId?: string;
  businessName: string;
  businessPhone: string;
}

// ─── Default Config ────────────────────────────────────────────────────────

const CONFIG_KEY = '@vasco_comm_config';

const DEFAULT_CONFIG: CommunicationConfig = {
  enabled: true,
  defaultChannel: 'whatsapp',
  enabledTriggers: {
    on_my_way: true,
    appointment_reminder_24h: true,
    appointment_reminder_2h: true,
    job_started: false,
    job_complete: true,
    invoice_sent: true,
    quote_sent: true,
    review_request: true,
    payment_received: true,
    quote_followup: true,
    payment_reminder: true,
  },
  reminderTiming: { h24: true, h2: true },
  reviewRequestDelay: 2,
  autoSendInvoice: true,
  autoSendQuote: false,
  businessName: '',
  businessPhone: '',
};

export async function loadCommConfig(): Promise<CommunicationConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

export async function saveCommConfig(config: CommunicationConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ─── Message Templates (multilingual) ──────────────────────────────────────

interface MessageTemplate {
  trigger: MessageTrigger;
  templates: Record<string, (vars: Record<string, string>) => string>;
}

const TEMPLATES: MessageTemplate[] = [
  {
    trigger: 'on_my_way',
    templates: {
      en: (v) => `Hi ${v.customerName}, ${v.businessName} is on the way! Estimated arrival: ${v.eta}. Track live: ${v.trackingLink}`,
      nl: (v) => `Hoi ${v.customerName}, ${v.businessName} is onderweg! Verwachte aankomst: ${v.eta}. Volg live: ${v.trackingLink}`,
      de: (v) => `Hallo ${v.customerName}, ${v.businessName} ist unterwegs! Voraussichtliche Ankunft: ${v.eta}. Live verfolgen: ${v.trackingLink}`,
      fr: (v) => `Bonjour ${v.customerName}, ${v.businessName} est en route ! Arrivee estimee: ${v.eta}. Suivre en direct: ${v.trackingLink}`,
      es: (v) => `Hola ${v.customerName}, ${v.businessName} esta en camino. Llegada estimada: ${v.eta}. Seguir en vivo: ${v.trackingLink}`,
      it: (v) => `Ciao ${v.customerName}, ${v.businessName} e in arrivo! Arrivo stimato: ${v.eta}. Segui dal vivo: ${v.trackingLink}`,
    },
  },
  {
    trigger: 'appointment_reminder_24h',
    templates: {
      en: (v) => `Reminder: ${v.businessName} is scheduled for ${v.jobTitle} tomorrow at ${v.time}. Reply to confirm or reschedule.`,
      nl: (v) => `Herinnering: ${v.businessName} staat gepland voor ${v.jobTitle} morgen om ${v.time}. Reageer om te bevestigen of te verplaatsen.`,
      de: (v) => `Erinnerung: ${v.businessName} ist morgen um ${v.time} fur ${v.jobTitle} eingeplant. Antworten Sie zur Bestatigung.`,
      fr: (v) => `Rappel : ${v.businessName} est prevu pour ${v.jobTitle} demain a ${v.time}. Repondez pour confirmer.`,
      es: (v) => `Recordatorio: ${v.businessName} tiene programado ${v.jobTitle} manana a las ${v.time}. Responda para confirmar.`,
      it: (v) => `Promemoria: ${v.businessName} e programmato per ${v.jobTitle} domani alle ${v.time}. Rispondi per confermare.`,
    },
  },
  {
    trigger: 'appointment_reminder_2h',
    templates: {
      en: (v) => `${v.businessName} will arrive in about 2 hours for ${v.jobTitle}. See you soon!`,
      nl: (v) => `${v.businessName} komt over ongeveer 2 uur voor ${v.jobTitle}. Tot zo!`,
      de: (v) => `${v.businessName} kommt in ca. 2 Stunden fur ${v.jobTitle}. Bis gleich!`,
      fr: (v) => `${v.businessName} arrivera dans environ 2 heures pour ${v.jobTitle}. A bientot !`,
      es: (v) => `${v.businessName} llegara en unas 2 horas para ${v.jobTitle}. Hasta pronto!`,
      it: (v) => `${v.businessName} arrivera tra circa 2 ore per ${v.jobTitle}. A presto!`,
    },
  },
  {
    trigger: 'job_complete',
    templates: {
      en: (v) => `${v.jobTitle} is complete! Thank you for choosing ${v.businessName}. Your invoice will follow shortly.`,
      nl: (v) => `${v.jobTitle} is afgerond! Bedankt dat u voor ${v.businessName} heeft gekozen. Uw factuur volgt binnenkort.`,
      de: (v) => `${v.jobTitle} ist abgeschlossen! Vielen Dank fur Ihr Vertrauen in ${v.businessName}. Ihre Rechnung folgt in Kurze.`,
      fr: (v) => `${v.jobTitle} est termine ! Merci d'avoir choisi ${v.businessName}. Votre facture suivra sous peu.`,
      es: (v) => `${v.jobTitle} esta completado! Gracias por elegir ${v.businessName}. Su factura llegara pronto.`,
      it: (v) => `${v.jobTitle} e completato! Grazie per aver scelto ${v.businessName}. La fattura seguira a breve.`,
    },
  },
  {
    trigger: 'invoice_sent',
    templates: {
      en: (v) => `Invoice ${v.invoiceNumber} for ${v.amount} is ready. Pay online: ${v.paymentLink}`,
      nl: (v) => `Factuur ${v.invoiceNumber} van ${v.amount} staat klaar. Betaal online: ${v.paymentLink}`,
      de: (v) => `Rechnung ${v.invoiceNumber} uber ${v.amount} ist fertig. Online bezahlen: ${v.paymentLink}`,
      fr: (v) => `Facture ${v.invoiceNumber} de ${v.amount} est prete. Payer en ligne: ${v.paymentLink}`,
      es: (v) => `Factura ${v.invoiceNumber} por ${v.amount} esta lista. Pagar en linea: ${v.paymentLink}`,
      it: (v) => `Fattura ${v.invoiceNumber} di ${v.amount} e pronta. Paga online: ${v.paymentLink}`,
    },
  },
  {
    trigger: 'review_request',
    templates: {
      en: (v) => `Hi ${v.customerName}, how was your experience with ${v.businessName}? We'd love your feedback: ${v.reviewLink}`,
      nl: (v) => `Hoi ${v.customerName}, hoe was uw ervaring met ${v.businessName}? We horen graag uw mening: ${v.reviewLink}`,
      de: (v) => `Hallo ${v.customerName}, wie war Ihre Erfahrung mit ${v.businessName}? Wir freuen uns uber Ihr Feedback: ${v.reviewLink}`,
      fr: (v) => `Bonjour ${v.customerName}, comment s'est passe votre experience avec ${v.businessName} ? Donnez-nous votre avis: ${v.reviewLink}`,
      es: (v) => `Hola ${v.customerName}, como fue su experiencia con ${v.businessName}? Nos encantaria su opinion: ${v.reviewLink}`,
      it: (v) => `Ciao ${v.customerName}, com'e stata la tua esperienza con ${v.businessName}? Ci piacerebbe il tuo feedback: ${v.reviewLink}`,
    },
  },
  {
    trigger: 'payment_received',
    templates: {
      en: (v) => `Payment of ${v.amount} received for invoice ${v.invoiceNumber}. Thank you, ${v.customerName}!`,
      nl: (v) => `Betaling van ${v.amount} ontvangen voor factuur ${v.invoiceNumber}. Bedankt, ${v.customerName}!`,
      de: (v) => `Zahlung von ${v.amount} fur Rechnung ${v.invoiceNumber} erhalten. Vielen Dank, ${v.customerName}!`,
      fr: (v) => `Paiement de ${v.amount} recu pour facture ${v.invoiceNumber}. Merci, ${v.customerName} !`,
      es: (v) => `Pago de ${v.amount} recibido para factura ${v.invoiceNumber}. Gracias, ${v.customerName}!`,
      it: (v) => `Pagamento di ${v.amount} ricevuto per fattura ${v.invoiceNumber}. Grazie, ${v.customerName}!`,
    },
  },
];

// ─── Message Builder ───────────────────────────────────────────────────────

export function buildMessage(
  trigger: MessageTrigger,
  language: string,
  variables: Record<string, string>,
): string {
  const template = TEMPLATES.find((t) => t.trigger === trigger);
  if (!template) return '';
  const fn = template.templates[language] || template.templates.en;
  return fn(variables);
}

// ─── Channel Dispatch ──────────────────────────────────────────────────────

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function sendWhatsAppBusiness(
  phone: string,
  message: string,
  _businessId?: string,
): Promise<{ success: boolean; messageId?: string }> {
  // TODO: Integrate WhatsApp Business API via Twilio/MessageBird
  // For now, fall back to deep-link
  const sent = await sendWhatsApp(phone, message);
  return { success: sent };
}

export async function sendEmail(
  email: string,
  subject: string,
  body: string,
): Promise<boolean> {
  try {
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    const url = `sms:${phone}&body=${encodeURIComponent(message)}`;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// ─── Unified Send ──────────────────────────────────────────────────────────

export async function sendMessage(
  contact: CustomerContact,
  trigger: MessageTrigger,
  variables: Record<string, string>,
  config: CommunicationConfig,
): Promise<CommunicationEvent> {
  const language = contact.language || 'en';
  const message = buildMessage(trigger, language, variables);
  const channel = contact.whatsappOptIn ? 'whatsapp' : contact.email ? 'email' : 'sms';

  let success = false;
  if (channel === 'whatsapp' && contact.phone) {
    const result = await sendWhatsAppBusiness(contact.phone, message, config.whatsappBusinessId);
    success = result.success;
  } else if (channel === 'email' && contact.email) {
    const subject = getEmailSubject(trigger, language, variables);
    success = await sendEmail(contact.email, subject, message);
  } else if (contact.phone) {
    success = await sendSMS(contact.phone, message);
  }

  const event: CommunicationEvent = {
    id: `comm_${Date.now()}`,
    trigger,
    channel,
    customerId: contact.id,
    customerName: contact.name,
    jobId: variables.jobId,
    sentAt: new Date().toISOString(),
    status: success ? 'sent' : 'failed',
    messagePreview: message.slice(0, 100),
  };

  // Persist event
  await logCommunicationEvent(event);
  return event;
}

function getEmailSubject(trigger: MessageTrigger, lang: string, vars: Record<string, string>): string {
  const subjects: Record<string, Record<MessageTrigger, string>> = {
    en: { on_my_way: `${vars.businessName} is on the way`, appointment_reminder_24h: `Appointment reminder: ${vars.jobTitle}`, appointment_reminder_2h: `${vars.businessName} arriving in 2 hours`, job_started: 'Work has started', job_complete: `${vars.jobTitle} is complete`, invoice_sent: `Invoice ${vars.invoiceNumber}`, quote_sent: `Quote from ${vars.businessName}`, review_request: `How was your experience?`, payment_received: `Payment received - thank you!`, quote_followup: `Following up on your quote`, payment_reminder: `Payment reminder: ${vars.invoiceNumber}` },
    nl: { on_my_way: `${vars.businessName} is onderweg`, appointment_reminder_24h: `Afspraakherinnering: ${vars.jobTitle}`, appointment_reminder_2h: `${vars.businessName} komt over 2 uur`, job_started: 'Werkzaamheden gestart', job_complete: `${vars.jobTitle} is afgerond`, invoice_sent: `Factuur ${vars.invoiceNumber}`, quote_sent: `Offerte van ${vars.businessName}`, review_request: `Hoe was uw ervaring?`, payment_received: `Betaling ontvangen - bedankt!`, quote_followup: `Opvolging van uw offerte`, payment_reminder: `Betalingsherinnering: ${vars.invoiceNumber}` },
  };
  return (subjects[lang] || subjects.en)[trigger] || vars.businessName || 'Vasco';
}

// ─── Event Log ─────────────────────────────────────────────────────────────

const LOG_KEY = '@vasco_comm_log';

async function logCommunicationEvent(event: CommunicationEvent): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const log: CommunicationEvent[] = raw ? JSON.parse(raw) : [];
    log.unshift(event);
    // Keep last 500 events
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 500)));
  } catch {}
}

export async function getCommunicationLog(limit: number = 50): Promise<CommunicationEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    const log: CommunicationEvent[] = raw ? JSON.parse(raw) : [];
    return log.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Review Request Flow ───────────────────────────────────────────────────

export interface ReviewRequest {
  customerId: string;
  customerName: string;
  jobId: string;
  rating?: number;          // 1-5 from initial prompt
  routedTo: 'google' | 'private' | null;
  feedback?: string;
  sentAt: string;
}

export function getReviewLink(rating: number, googlePlaceId?: string): string {
  if (rating >= 4 && googlePlaceId) {
    return `https://search.google.com/local/writereview?placeid=${googlePlaceId}`;
  }
  // Low rating → private feedback form
  return 'https://app.vasco.eu/feedback';
}

export async function sendReviewRequest(
  contact: CustomerContact,
  jobTitle: string,
  businessName: string,
  config: CommunicationConfig,
  googlePlaceId?: string,
): Promise<CommunicationEvent> {
  const reviewLink = googlePlaceId
    ? `https://app.vasco.eu/review?job=${encodeURIComponent(jobTitle)}&gp=${googlePlaceId}`
    : 'https://app.vasco.eu/feedback';

  return sendMessage(contact, 'review_request', {
    customerName: contact.name,
    businessName,
    reviewLink,
    jobTitle,
  }, config);
}

// ─── Statistics ────────────────────────────────────────────────────────────

export interface CommunicationStats {
  totalSent: number;
  byChannel: Record<MessageChannel, number>;
  byTrigger: Record<string, number>;
  deliveryRate: number;
  thisWeek: number;
  thisMonth: number;
}

export async function getCommunicationStats(): Promise<CommunicationStats> {
  const log = await getCommunicationLog(500);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const byChannel: Record<MessageChannel, number> = { whatsapp: 0, email: 0, sms: 0 };
  const byTrigger: Record<string, number> = {};
  let delivered = 0;

  for (const event of log) {
    byChannel[event.channel] = (byChannel[event.channel] || 0) + 1;
    byTrigger[event.trigger] = (byTrigger[event.trigger] || 0) + 1;
    if (event.status === 'sent' || event.status === 'delivered' || event.status === 'read') delivered++;
  }

  return {
    totalSent: log.length,
    byChannel,
    byTrigger,
    deliveryRate: log.length > 0 ? Math.round((delivered / log.length) * 100) : 100,
    thisWeek: log.filter((e) => new Date(e.sentAt) >= weekAgo).length,
    thisMonth: log.filter((e) => new Date(e.sentAt) >= monthAgo).length,
  };
}
