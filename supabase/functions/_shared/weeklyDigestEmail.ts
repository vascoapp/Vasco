/**
 * The Monday digest email, in the contractor's language and currency.
 *
 * The first template had never run (every cron call got 403): its rows were
 * always English ("3 new jobs"), German said "du", every market got a "€"
 * with no cents, and the business name went into the HTML unescaped
 * (2026-10-05). The server profile has no language column, so the language
 * follows the contractor's COUNTRY; an unknown country means no email —
 * neither the language nor the currency could be right (CLAUDE.md: skip,
 * never default).
 *
 * Pure TypeScript (Intl only): jest imports it too.
 */
import { euroLeading } from './euroLeading.ts';

export interface DigestFigures {
  businessName: string | null;
  country: string | null;
  newJobs: number;
  paidInvoices: number;
  paidAmount: number;
  openInvoices: number;
  openAmount: number;
  quotesSent: number;
  quotesAccepted: number;
}

type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

const MARKET: Record<string, { lang: Lang; locale: string; currency: 'EUR' | 'GBP' | 'USD' }> = {
  NL: { lang: 'nl', locale: 'nl-NL', currency: 'EUR' },
  DE: { lang: 'de', locale: 'de-DE', currency: 'EUR' },
  FR: { lang: 'fr', locale: 'fr-FR', currency: 'EUR' },
  ES: { lang: 'es', locale: 'es-ES', currency: 'EUR' },
  IT: { lang: 'it', locale: 'it-IT', currency: 'EUR' },
  UK: { lang: 'en', locale: 'en-GB', currency: 'GBP' },
  US: { lang: 'en', locale: 'en-US', currency: 'USD' },
};

/** n === 1 → one, else other. */
type Plural = (n: number) => string;
const p = (one: string, other: string): Plural => (n) => (n === 1 ? one : other).replace('{n}', String(n));

const COPY: Record<Lang, {
  subject: string;
  heading: (name: string) => string;
  newJobs: Plural; paid: Plural; open: Plural; quotes: (sent: number, accepted: number) => string;
  footer: string;
}> = {
  en: {
    subject: 'Your Vasco week',
    heading: (n) => `This week for ${n}`,
    newJobs: p('{n} new job', '{n} new jobs'),
    paid: p('{n} invoice paid', '{n} invoices paid'),
    open: p('{n} invoice still open', '{n} invoices still open'),
    quotes: (s, a) => `${s} ${s === 1 ? 'quote' : 'quotes'} sent · ${a} accepted`,
    footer: 'Vasco sends this summary on Mondays. Open the app for the details.',
  },
  nl: {
    subject: 'Jouw Vasco-week',
    heading: (n) => `De week van ${n}`,
    newJobs: p('{n} nieuwe klus', '{n} nieuwe klussen'),
    paid: p('{n} factuur betaald', '{n} facturen betaald'),
    open: p('{n} factuur nog open', '{n} facturen nog open'),
    quotes: (s, a) => `${s} ${s === 1 ? 'offerte' : 'offertes'} verstuurd · ${a} geaccepteerd`,
    footer: 'Vasco stuurt dit overzicht op maandag. Open de app voor de details.',
  },
  de: {
    subject: 'Ihre Vasco-Woche',
    heading: (n) => `Die Woche von ${n}`,
    newJobs: p('{n} neuer Auftrag', '{n} neue Aufträge'),
    paid: p('{n} Rechnung bezahlt', '{n} Rechnungen bezahlt'),
    open: p('{n} Rechnung noch offen', '{n} Rechnungen noch offen'),
    quotes: (s, a) => `${s} ${s === 1 ? 'Angebot' : 'Angebote'} versendet · ${a} angenommen`,
    footer: 'Vasco sendet Ihnen diese Übersicht montags. Die Details finden Sie in der App.',
  },
  fr: {
    subject: 'Votre semaine Vasco',
    heading: (n) => `La semaine de ${n}`,
    newJobs: p('{n} nouveau chantier', '{n} nouveaux chantiers'),
    paid: p('{n} facture payée', '{n} factures payées'),
    open: p('{n} facture encore ouverte', '{n} factures encore ouvertes'),
    quotes: (s, a) => `${s} ${s === 1 ? 'devis envoyé' : 'devis envoyés'} · ${a} ${a === 1 ? 'accepté' : 'acceptés'}`,
    footer: 'Vasco vous envoie ce récapitulatif le lundi. Les détails sont dans l’application.',
  },
  es: {
    subject: 'Su semana en Vasco',
    heading: (n) => `La semana de ${n}`,
    newJobs: p('{n} trabajo nuevo', '{n} trabajos nuevos'),
    paid: p('{n} factura pagada', '{n} facturas pagadas'),
    open: p('{n} factura pendiente', '{n} facturas pendientes'),
    quotes: (s, a) => `${s} ${s === 1 ? 'presupuesto enviado' : 'presupuestos enviados'} · ${a} ${a === 1 ? 'aceptado' : 'aceptados'}`,
    footer: 'Vasco le envía este resumen los lunes. Encontrará los detalles en la aplicación.',
  },
  it: {
    subject: 'La tua settimana Vasco',
    heading: (n) => `La settimana di ${n}`,
    newJobs: p('{n} nuovo lavoro', '{n} nuovi lavori'),
    paid: p('{n} fattura pagata', '{n} fatture pagate'),
    open: p('{n} fattura ancora aperta', '{n} fatture ancora aperte'),
    quotes: (s, a) => `${s} ${s === 1 ? 'preventivo inviato' : 'preventivi inviati'} · ${a} ${a === 1 ? 'accettato' : 'accettati'}`,
    footer: 'Vasco ti invia questo riepilogo il lunedì. Trovi i dettagli nell’app.',
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Exactly the app's money: Intl currency format, euro sign first (euroLeading). */
export function digestMoney(amount: number, country: string): string {
  const m = MARKET[country];
  return euroLeading(new Intl.NumberFormat(m.locale, { style: 'currency', currency: m.currency }).format(amount));
}

/** Null when the market is unknown: no email rather than a guessed one. */
export function renderWeeklyDigest(d: DigestFigures): { subject: string; html: string; lang: Lang } | null {
  const country = (d.country ?? '').toUpperCase();
  const m = MARKET[country];
  if (!m) return null;
  const c = COPY[m.lang];
  const rawName = (d.businessName ?? '').trim() || 'Vasco';
  const money = (x: number) => esc(digestMoney(x, country));
  const html = `
    <h2 style="font-family:sans-serif;color:#0D1B2A">${esc(c.heading(rawName))}</h2>
    <table style="font-family:sans-serif;border-collapse:collapse" cellpadding="8">
      <tr><td>🛠️</td><td>${esc(c.newJobs(d.newJobs))}</td></tr>
      <tr><td>💶</td><td>${esc(c.paid(d.paidInvoices))} — <strong>${money(d.paidAmount)}</strong></td></tr>
      <tr><td>⏳</td><td>${esc(c.open(d.openInvoices))} — ${money(d.openAmount)}</td></tr>
      <tr><td>📝</td><td>${esc(c.quotes(d.quotesSent, d.quotesAccepted))}</td></tr>
    </table>
    <p style="color:#6B7280;font-size:12px;font-family:sans-serif">${esc(c.footer)}</p>
  `;
  return { subject: c.subject, html, lang: m.lang };
}
