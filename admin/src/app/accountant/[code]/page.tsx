// =============================================================================
// ACCOUNTANT SEAT — the adviser's read-only view of a client's filing position
// =============================================================================
// Served at https://admin.vascobuild.com/accountant/{CODE}. Same shape as the
// customer portal next door: no login, the access code IS the bearer credential,
// and the only read surface is a SECURITY DEFINER RPC.
//
// WHAT THIS SHOWS THAT AN ACCOUNTING PACKAGE CANNOT. Per-invoice FILING STATE.
// Every package knows what was invoiced; none knows whether SDI accepted it,
// because that is not an accounting fact — it is the outcome of a submission.
// A rejected FatturaPA means the invoice was never legally issued, so an adviser
// who reconciles it as revenue is reconciling something that does not exist.
//
// THE PAGE LEADS WITH WHAT IS WRONG. Three unissued invoices buried under forty
// correct ones get missed, and this is read on a phone between appointments. So
// "not filed" is the first thing on the page and the full ledger comes after.
//
// READ-ONLY BY CONSTRUCTION — there is no write path here, and its absence is
// the design. An adviser acting on a contractor's behalf needs an audit trail
// before it needs a button.
// =============================================================================

'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { euroLeading } from '@/lib/money';

interface PageProps {
  params: Promise<{ code: string }>;
}

/** Mirrors HandoverInvoice in src/services/accountantHandoverService.ts. */
interface HandoverInvoice {
  reference: string;
  customer: string;
  date?: string;
  amount: number;
  status: string;
  /** null = no regulated filing is required for this invoice's country. That is
   *  NOT "not filed yet", and the two must never render the same. */
  filing: string | null;
}

interface Handover {
  businessName: string;
  country: string;
  periodStart: string;
  periodEnd: string;
  invoices: HandoverInvoice[];
  totals: { invoiced: number; count: number };
  notFiled: HandoverInvoice[];
  awaitingConfirmation: HandoverInvoice[];
  mandateApplies: boolean;
}

interface SeatData {
  businessName: string;
  country: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string;
  expiresAt: string;
  handover: Handover;
}

type Phase = 'loading' | 'ready' | 'not_found' | 'expired' | 'unavailable';

type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

/** The adviser reads in their client's language — that is the market they work in. */
function langForCountry(country: string): Lang {
  switch ((country || '').toUpperCase()) {
    case 'NL': return 'nl';
    case 'DE': return 'de';
    case 'FR': return 'fr';
    case 'ES': return 'es';
    case 'IT': return 'it';
    default: return 'en';
  }
}

const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: 'Filing position', period: 'Period', published: 'Published',
    notFiled: 'NOT FILED — these invoices were not legally issued',
    notFiledHelp: 'The authority refused these, or they failed in transit. Until a correction is accepted, the invoice does not exist for tax purposes.',
    awaiting: 'Sent, no answer yet',
    awaitingHelp: 'Handed over to the authority. Not yet confirmed — do not treat as filed.',
    allClear: 'No filing problems in this period.',
    ledger: 'All invoices in the period', reference: 'Reference', customer: 'Customer',
    date: 'Date', amount: 'Amount', filing: 'Filing', invoiceStatus: 'Invoice',
    total: 'Total invoiced', count: 'invoices',
    noMandate: 'No structured e-invoice filing is required in this country, so no filing state is shown. That is different from "not filed yet".',
    readOnly: 'Read-only. This is a snapshot your client published — it does not update on its own.',
    expiresOn: 'Access expires', notFound: 'This link is not valid.',
    notFoundHelp: 'Check the address, or ask your client to send it again.',
    expiredTitle: 'This link no longer works.',
    expiredHelp: 'Ask your client to publish a new one from the app.',
    unavailable: 'This page is temporarily unavailable.',
    loading: 'Loading…',
  },
  nl: {
    title: 'Aangiftestatus', period: 'Periode', published: 'Gepubliceerd',
    notFiled: 'NIET INGEDIEND — deze facturen zijn juridisch niet uitgereikt',
    notFiledHelp: 'De instantie heeft deze geweigerd, of ze zijn onderweg mislukt. Tot een correctie is geaccepteerd bestaat de factuur fiscaal niet.',
    awaiting: 'Verzonden, nog geen antwoord',
    awaitingHelp: 'Overgedragen aan de instantie. Nog niet bevestigd — beschouw dit niet als ingediend.',
    allClear: 'Geen problemen met indiening in deze periode.',
    ledger: 'Alle facturen in de periode', reference: 'Referentie', customer: 'Klant',
    date: 'Datum', amount: 'Bedrag', filing: 'Indiening', invoiceStatus: 'Factuur',
    total: 'Totaal gefactureerd', count: 'facturen',
    noMandate: 'In dit land is gestructureerd e-factureren niet verplicht, dus er wordt geen indieningsstatus getoond. Dat is iets anders dan "nog niet ingediend".',
    readOnly: 'Alleen-lezen. Dit is een momentopname die uw klant heeft gepubliceerd — hij werkt niet vanzelf bij.',
    expiresOn: 'Toegang verloopt', notFound: 'Deze link is niet geldig.',
    notFoundHelp: 'Controleer het adres, of vraag uw klant om hem opnieuw te sturen.',
    expiredTitle: 'Deze link werkt niet meer.',
    expiredHelp: 'Vraag uw klant om een nieuwe te publiceren vanuit de app.',
    unavailable: 'Deze pagina is tijdelijk niet beschikbaar.',
    loading: 'Laden…',
  },
  de: {
    title: 'Meldestatus', period: 'Zeitraum', published: 'Veröffentlicht',
    notFiled: 'NICHT EINGEREICHT — diese Rechnungen wurden rechtlich nicht ausgestellt',
    notFiledHelp: 'Die Behörde hat diese abgelehnt, oder die Übermittlung ist fehlgeschlagen. Bis eine Korrektur akzeptiert ist, existiert die Rechnung steuerlich nicht.',
    awaiting: 'Übermittelt, noch keine Antwort',
    awaitingHelp: 'An die Behörde übergeben. Noch nicht bestätigt — nicht als eingereicht behandeln.',
    allClear: 'Keine Melde-Probleme in diesem Zeitraum.',
    ledger: 'Alle Rechnungen im Zeitraum', reference: 'Referenz', customer: 'Kunde',
    date: 'Datum', amount: 'Betrag', filing: 'Meldung', invoiceStatus: 'Rechnung',
    total: 'Gesamt fakturiert', count: 'Rechnungen',
    noMandate: 'In diesem Land ist keine strukturierte E-Rechnungsmeldung vorgeschrieben, daher wird kein Meldestatus angezeigt. Das ist etwas anderes als "noch nicht eingereicht".',
    readOnly: 'Nur-Lesen. Dies ist eine Momentaufnahme, die Ihr Mandant veröffentlicht hat — sie aktualisiert sich nicht von selbst.',
    expiresOn: 'Zugang läuft ab', notFound: 'Dieser Link ist ungültig.',
    notFoundHelp: 'Prüfen Sie die Adresse, oder bitten Sie Ihren Mandanten, ihn erneut zu senden.',
    expiredTitle: 'Dieser Link funktioniert nicht mehr.',
    expiredHelp: 'Bitten Sie Ihren Mandanten, in der App einen neuen zu veröffentlichen.',
    unavailable: 'Diese Seite ist vorübergehend nicht verfügbar.',
    loading: 'Wird geladen…',
  },
  fr: {
    title: 'État des dépôts', period: 'Période', published: 'Publié le',
    notFiled: "NON DÉPOSÉES — ces factures n'ont pas été juridiquement émises",
    notFiledHelp: "L'administration les a refusées, ou la transmission a échoué. Tant qu'une correction n'est pas acceptée, la facture n'existe pas fiscalement.",
    awaiting: 'Transmises, sans réponse',
    awaitingHelp: "Remises à l'administration. Pas encore confirmées — ne pas considérer comme déposées.",
    allClear: 'Aucun problème de dépôt sur cette période.',
    ledger: 'Toutes les factures de la période', reference: 'Référence', customer: 'Client',
    date: 'Date', amount: 'Montant', filing: 'Dépôt', invoiceStatus: 'Facture',
    total: 'Total facturé', count: 'factures',
    noMandate: "Aucun dépôt de facture électronique structurée n'est requis dans ce pays, donc aucun état n'est affiché. C'est différent de « pas encore déposée ».",
    readOnly: "Lecture seule. Ceci est un instantané publié par votre client — il ne se met pas à jour tout seul.",
    expiresOn: "L'accès expire le", notFound: "Ce lien n'est pas valide.",
    notFoundHelp: "Vérifiez l'adresse, ou demandez à votre client de le renvoyer.",
    expiredTitle: 'Ce lien ne fonctionne plus.',
    expiredHelp: "Demandez à votre client d'en publier un nouveau depuis l'application.",
    unavailable: 'Cette page est temporairement indisponible.',
    loading: 'Chargement…',
  },
  es: {
    title: 'Estado de presentación', period: 'Periodo', published: 'Publicado',
    notFiled: 'NO PRESENTADAS — estas facturas no se emitieron legalmente',
    notFiledHelp: 'La administración las rechazó, o fallaron en el envío. Hasta que se acepte una corrección, la factura no existe a efectos fiscales.',
    awaiting: 'Enviadas, sin respuesta',
    awaitingHelp: 'Entregadas a la administración. Aún sin confirmar — no las trate como presentadas.',
    allClear: 'Sin problemas de presentación en este periodo.',
    ledger: 'Todas las facturas del periodo', reference: 'Referencia', customer: 'Cliente',
    date: 'Fecha', amount: 'Importe', filing: 'Presentación', invoiceStatus: 'Factura',
    total: 'Total facturado', count: 'facturas',
    noMandate: 'En este país no se exige presentación de factura electrónica estructurada, por lo que no se muestra estado. Eso no es lo mismo que "aún no presentada".',
    readOnly: 'Solo lectura. Esto es una instantánea publicada por su cliente — no se actualiza sola.',
    expiresOn: 'El acceso caduca', notFound: 'Este enlace no es válido.',
    notFoundHelp: 'Compruebe la dirección, o pida a su cliente que lo envíe de nuevo.',
    expiredTitle: 'Este enlace ya no funciona.',
    expiredHelp: 'Pida a su cliente que publique uno nuevo desde la aplicación.',
    unavailable: 'Esta página no está disponible temporalmente.',
    loading: 'Cargando…',
  },
  it: {
    title: 'Stato invii', period: 'Periodo', published: 'Pubblicato',
    notFiled: 'NON INVIATE — queste fatture non sono state emesse legalmente',
    notFiledHelp: "L'amministrazione le ha rifiutate (scarto), o l'invio non è riuscito. Finché una correzione non è accettata, la fattura non esiste ai fini fiscali.",
    awaiting: 'Inviate, nessuna risposta',
    awaitingHelp: "Consegnate all'amministrazione. Non ancora confermate — non trattarle come inviate.",
    allClear: 'Nessun problema di invio in questo periodo.',
    ledger: 'Tutte le fatture del periodo', reference: 'Riferimento', customer: 'Cliente',
    date: 'Data', amount: 'Importo', filing: 'Invio', invoiceStatus: 'Fattura',
    total: 'Totale fatturato', count: 'fatture',
    noMandate: 'In questo paese non è richiesto l\'invio di fatture elettroniche strutturate, quindi non viene mostrato alcuno stato. È diverso da "non ancora inviata".',
    readOnly: 'Sola lettura. Questa è un\'istantanea pubblicata dal suo cliente — non si aggiorna da sola.',
    expiresOn: "L'accesso scade", notFound: 'Questo link non è valido.',
    notFoundHelp: "Controlli l'indirizzo, o chieda al suo cliente di rinviarlo.",
    expiredTitle: 'Questo link non funziona più.',
    expiredHelp: 'Chieda al suo cliente di pubblicarne uno nuovo dall\'app.',
    unavailable: 'Questa pagina non è temporaneamente disponibile.',
    loading: 'Caricamento…',
  },
};

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  NL: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', UK: 'GBP', GB: 'GBP', US: 'USD',
};

function money(amount: number, country: string, lang: Lang): string {
  const currency = CURRENCY_BY_COUNTRY[(country || '').toUpperCase()] ?? 'EUR';
  try {
    return euroLeading(new Intl.NumberFormat(lang === 'en' ? 'en-GB' : lang, {
      style: 'currency', currency,
    }).format(amount));
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Filing states that mean the invoice was NOT issued, and read as alarming. */
const BAD_STATES = new Set(['rejected', 'failed']);

export default function AccountantSeatPage({ params }: PageProps) {
  const { code } = use(params);
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<SeatData | null>(null);

  const load = useCallback(async () => {
    setPhase('loading');
    if (!isSupabaseConfigured()) { setPhase('unavailable'); return; }
    const sb = getSupabase();
    if (!sb) { setPhase('unavailable'); return; }
    try {
      const { data: raw, error } = await sb.rpc('get_accountant_handover', { p_access_code: code });
      if (error) { setPhase('unavailable'); return; }
      // NULL = no such seat; {expired:true} = it existed and no longer opens.
      // Collapsing the two leaves the reader unable to tell whether to retype
      // the address or ask for a new link — the lesson from the customer portal.
      if (!raw || typeof raw !== 'object') { setPhase('not_found'); return; }
      if ((raw as Record<string, unknown>).expired === true) { setPhase('expired'); return; }
      setData(raw as unknown as SeatData);
      setPhase('ready');
    } catch { setPhase('unavailable'); }
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  const lang = langForCountry(data?.country ?? '');
  const c = COPY[lang];

  if (phase === 'loading') return <Shell><p style={S.muted}>{COPY.en.loading}</p></Shell>;
  if (phase === 'not_found') {
    return <Shell><h1 style={S.h1}>{c.notFound}</h1><p style={S.muted}>{c.notFoundHelp}</p></Shell>;
  }
  if (phase === 'expired') {
    return <Shell><h1 style={S.h1}>{c.expiredTitle}</h1><p style={S.muted}>{c.expiredHelp}</p></Shell>;
  }
  if (phase === 'unavailable' || !data) {
    return <Shell><p style={S.muted}>{COPY.en.unavailable}</p></Shell>;
  }

  const h = data.handover;
  const fmt = (n: number) => money(n, data.country, lang);
  const clean = h.notFiled.length === 0 && h.awaitingConfirmation.length === 0;

  return (
    <Shell>
      <header style={{ marginBottom: 28 }}>
        <p style={S.eyebrow}>{c.title}</p>
        <h1 style={S.h1}>{h.businessName}</h1>
        <p style={S.muted}>
          {c.period}: {h.periodStart} → {h.periodEnd}
          {' · '}{c.published}: {new Date(data.publishedAt).toLocaleDateString(lang)}
        </p>
      </header>

      {/* What is wrong comes first, deliberately. */}
      {h.notFiled.length > 0 && (
        <section style={{ ...S.card, ...S.cardBad }}>
          <h2 style={S.h2Bad}>{c.notFiled}</h2>
          <p style={S.help}>{c.notFiledHelp}</p>
          <InvoiceTable rows={h.notFiled} c={c} fmt={fmt} showFiling />
        </section>
      )}

      {h.awaitingConfirmation.length > 0 && (
        <section style={{ ...S.card, ...S.cardWarn }}>
          <h2 style={S.h2Warn}>{c.awaiting}</h2>
          <p style={S.help}>{c.awaitingHelp}</p>
          <InvoiceTable rows={h.awaitingConfirmation} c={c} fmt={fmt} showFiling />
        </section>
      )}

      {clean && h.mandateApplies && (
        <section style={{ ...S.card, ...S.cardOk }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{c.allClear}</p>
        </section>
      )}

      <section style={S.card}>
        <h2 style={S.h2}>{c.ledger}</h2>
        {/* The filing column is OMITTED, not printed as "none", where no mandate
            exists. A Dutch contractor has no filings because none are required,
            and an empty column invites chasing submissions that never existed. */}
        {!h.mandateApplies && <p style={S.help}>{c.noMandate}</p>}
        <InvoiceTable rows={h.invoices} c={c} fmt={fmt} showFiling={h.mandateApplies} />
        <p style={S.total}>
          {c.total}: <strong>{fmt(h.totals.invoiced)}</strong> · {h.totals.count} {c.count}
        </p>
      </section>

      <footer style={S.footer}>
        <p style={{ margin: 0 }}>{c.readOnly}</p>
        <p style={{ margin: '6px 0 0' }}>
          {c.expiresOn}: {new Date(data.expiresAt).toLocaleDateString(lang)}
        </p>
      </footer>
    </Shell>
  );
}

function InvoiceTable({
  rows, c, fmt, showFiling,
}: {
  rows: HandoverInvoice[];
  c: Record<string, string>;
  fmt: (n: number) => string;
  showFiling: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>{c.reference}</th>
            <th style={S.th}>{c.customer}</th>
            <th style={S.th}>{c.date}</th>
            <th style={{ ...S.th, textAlign: 'right' }}>{c.amount}</th>
            <th style={S.th}>{c.invoiceStatus}</th>
            {showFiling && <th style={S.th}>{c.filing}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.reference}-${i}`}>
              <td style={S.td}>{r.reference}</td>
              <td style={S.td}>{r.customer}</td>
              <td style={S.td}>{r.date ?? '—'}</td>
              <td style={{ ...S.td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(r.amount)}</td>
              <td style={S.td}>{r.status}</td>
              {showFiling && (
                <td style={{
                  ...S.td,
                  color: r.filing && BAD_STATES.has(r.filing) ? '#b42318' : undefined,
                  fontWeight: r.filing && BAD_STATES.has(r.filing) ? 600 : undefined,
                }}>
                  {r.filing ?? '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={S.page}>
      <div style={S.wrap}>{children}</div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f6f7f9', padding: '32px 16px', color: '#101828' },
  wrap: { maxWidth: 860, margin: '0 auto', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' },
  eyebrow: { margin: 0, fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#667085', fontWeight: 700 },
  h1: { margin: '4px 0 6px', fontSize: 26, fontWeight: 800 },
  h2: { margin: '0 0 12px', fontSize: 17, fontWeight: 700 },
  h2Bad: { margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#b42318' },
  h2Warn: { margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#b54708' },
  muted: { color: '#667085', fontSize: 14, margin: 0 },
  help: { color: '#475467', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 },
  card: { background: '#fff', border: '1px solid #e4e7ec', borderRadius: 12, padding: 20, marginBottom: 18 },
  cardBad: { borderColor: '#fda29b', background: '#fffbfa' },
  cardWarn: { borderColor: '#fec84b', background: '#fffcf5' },
  cardOk: { borderColor: '#a6f4c5', background: '#f6fef9' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e4e7ec', color: '#667085', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' },
  td: { padding: '10px', borderBottom: '1px solid #f2f4f7', verticalAlign: 'top' },
  total: { marginTop: 14, marginBottom: 0, fontSize: 15 },
  footer: { color: '#667085', fontSize: 12, lineHeight: 1.6, marginTop: 8 },
};
