// =============================================================================
// PUBLIC QUOTE PORTAL — web fallback for https://vascobuild.com/quote/{ID}?t=…
// =============================================================================
// This page did not exist, and its absence was the single break that hit 100%
// of recipients: the apple-app-site-association served from this project claims
// `/quote/*`, `sign-quote-token` mints links of exactly that shape, and both
// vascobuild.com and admin.vascobuild.com answered `/quote/<id>` with a 404.
// Every other customer-facing claim (/customer, /accept, /ref, /auth/callback)
// already had a fallback page; this one did not.
//
// Why it RENDERS the quote rather than only bouncing to the app, unlike
// /accept/[token]: the recipient is the contractor's CUSTOMER. They do not have
// Vasco installed and have no reason to install it to read a quote. A pure
// app-redirect landing would be a dead end for almost everyone who opens it.
//
// Data comes from the public `verify-quote-token` Edge Function, which checks
// the HMAC in `?t=` before returning anything. The anon key is itself a signed
// JWT, so it satisfies the function's verify_jwt gate; the token is what
// actually authorises the read. No customer account is involved.
//
// See docs/ui-playbook.md §8 for the rules these public landings follow.
// =============================================================================

'use client';

import Image from 'next/image';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { moneyFormatter } from '@/lib/money';

// R191 TODO: shared placeholder with /accept/[token] and /auth/callback.
// Replace once the App Store Connect listing exists.
const STORE_IOS = 'https://apps.apple.com/app/id0000000000';
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.vascobuild.app';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface QuoteLine {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  position: number | null;
}

interface QuotePayload {
  id: string;
  reference: string | null;
  // NET, VAT and GROSS. The page used to receive only `total` — which was the
  // quote's NET total — and render it under a bare "Gesamt / Totaal / Total".
  // The customer then confirmed a price 19-22% below the invoice they were
  // sent. Older cached responses omit the first three, so they are optional
  // and the breakdown rows only render when the rate is actually known.
  subtotal?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  total: number | null;
  status: string | null;
  lines: QuoteLine[];
  customer: { name: string | null; email: string | null } | null;
  business: {
    business_name: string | null;
    phone: string | null;
    email: string | null;
    country: string | null;
  } | null;
}

type Phase = 'loading' | 'ready' | 'confirming' | 'declining' | 'sending' | 'accepted' | 'rejected' | 'alreadyDecided' | 'invalid' | 'expired' | 'notoken' | 'unavailable';
type Lang = 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it';

function pickLanguage(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('nl')) return 'nl';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('it')) return 'it';
  return 'en';
}

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// The CONTRACTOR's country decides the currency, not the reader's browser — a
// Dutch contractor's quote is in euros whatever phone it is opened on. Playbook
// §8. Falls back to EUR because every market except UK/US is a euro market.
const COUNTRY_CURRENCY: Record<string, string> = {
  NL: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR',
  UK: 'GBP', GB: 'GBP', US: 'USD',
};
const LANG_LOCALE: Record<Lang, string> = {
  nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
};

// German is Sie, never du — including copy addressing the contractor's own
// customer. Playbook §5.
const COPY: Record<Lang, Record<string, string>> = {
  en: {
    accept: 'Accept quote', confirm: 'Yes — accept', cancel: 'Cancel', decline: 'Decline', declineTitle: 'Decline this quote', reasonLabel: 'Reason (optional)', reasonPlaceholder: 'Lets your contractor know why.', declineConfirm: 'Send decline', sending: 'Sending…', acceptedTitle: 'Accepted', acceptedBody: 'Your contractor has been notified and will be in touch to plan the work.', rejectedTitle: 'Declined', rejectedBody: 'Your contractor has been notified. You can still reach them directly if anything changes.', alreadyTitle: 'Already answered', alreadyBody: 'This quote has already been answered. Contact your contractor if that was not you.', failedTitle: 'That did not go through', failedBody: 'Nothing was sent. Please try again, or contact your contractor directly.', openAppSecondary: 'Open in the Vasco app',
    eyebrow: 'Your quote', quoteRef: 'Quote', total: 'Total', subtotal: 'Subtotal', vat: 'VAT',
    lines: 'What is included', qty: 'Qty', openApp: 'Open in Vasco to accept',
    noApp: 'New to Vasco?', loading: 'Loading your quote…',
    invalidTitle: 'This link is not valid', invalidBody: 'The link may have been mistyped or changed. Ask your contractor to send it again.',
    expiredTitle: 'This link has expired', expiredBody: 'Quote links stay valid for 90 days. Ask your contractor for a fresh link.',
    notokenTitle: 'This link is incomplete', notokenBody: 'The security code is missing from the address. Open the original link from your contractor, unchanged.',
    unavailableTitle: 'Temporarily unavailable', unavailableBody: 'We could not load this quote right now. Please try again shortly.',
    privacy: 'Secure link from your contractor. No account needed.', footer: '© Vasco · vascobuild.com',
  },
  nl: {
    accept: 'Offerte accepteren', confirm: 'Ja — accepteren', cancel: 'Annuleren', decline: 'Afwijzen', declineTitle: 'Deze offerte afwijzen', reasonLabel: 'Reden (optioneel)', reasonPlaceholder: 'Zo weet je vakman waarom.', declineConfirm: 'Afwijzing versturen', sending: 'Versturen…', acceptedTitle: 'Geaccepteerd', acceptedBody: 'Je vakman heeft bericht gekregen en neemt contact op om het werk in te plannen.', rejectedTitle: 'Afgewezen', rejectedBody: 'Je vakman heeft bericht gekregen. Je kunt hem altijd rechtstreeks bereiken als er iets verandert.', alreadyTitle: 'Al beantwoord', alreadyBody: 'Deze offerte is al beantwoord. Neem contact op met je vakman als jij dat niet was.', failedTitle: 'Dat is niet gelukt', failedBody: 'Er is niets verstuurd. Probeer het opnieuw of neem rechtstreeks contact op met je vakman.', openAppSecondary: 'Openen in de Vasco-app',
    eyebrow: 'Je offerte', quoteRef: 'Offerte', total: 'Totaal', subtotal: 'Subtotaal', vat: 'Btw',
    lines: 'Wat is inbegrepen', qty: 'Aantal', openApp: 'Open in Vasco om te accepteren',
    noApp: 'Nieuw bij Vasco?', loading: 'Je offerte wordt geladen…',
    invalidTitle: 'Deze link is niet geldig', invalidBody: 'De link is mogelijk verkeerd overgenomen of gewijzigd. Vraag je vakman om hem opnieuw te sturen.',
    expiredTitle: 'Deze link is verlopen', expiredBody: 'Offertelinks blijven 90 dagen geldig. Vraag je vakman om een nieuwe link.',
    notokenTitle: 'Deze link is onvolledig', notokenBody: 'De beveiligingscode ontbreekt in het adres. Open de originele link van je vakman, ongewijzigd.',
    unavailableTitle: 'Tijdelijk niet beschikbaar', unavailableBody: 'We konden deze offerte nu niet laden. Probeer het zo dadelijk opnieuw.',
    privacy: 'Veilige link van je vakman. Geen account nodig.', footer: '© Vasco · vascobuild.com',
  },
  de: {
    accept: 'Angebot annehmen', confirm: 'Ja — annehmen', cancel: 'Abbrechen', decline: 'Ablehnen', declineTitle: 'Dieses Angebot ablehnen', reasonLabel: 'Begründung (optional)', reasonPlaceholder: 'So weiß Ihr Handwerksbetrieb, woran es lag.', declineConfirm: 'Ablehnung senden', sending: 'Wird gesendet…', acceptedTitle: 'Angenommen', acceptedBody: 'Ihr Handwerksbetrieb wurde benachrichtigt und meldet sich zur Terminplanung.', rejectedTitle: 'Abgelehnt', rejectedBody: 'Ihr Handwerksbetrieb wurde benachrichtigt. Sie können ihn jederzeit direkt erreichen.', alreadyTitle: 'Bereits beantwortet', alreadyBody: 'Dieses Angebot wurde bereits beantwortet. Melden Sie sich bei Ihrem Handwerksbetrieb, falls Sie das nicht waren.', failedTitle: 'Das hat nicht geklappt', failedBody: 'Es wurde nichts gesendet. Bitte versuchen Sie es erneut oder wenden Sie sich direkt an Ihren Handwerksbetrieb.', openAppSecondary: 'In der Vasco-App öffnen',
    eyebrow: 'Ihr Angebot', quoteRef: 'Angebot', total: 'Gesamt', subtotal: 'Zwischensumme', vat: 'USt.',
    lines: 'Enthaltene Leistungen', qty: 'Menge', openApp: 'In Vasco öffnen und annehmen',
    noApp: 'Neu bei Vasco?', loading: 'Ihr Angebot wird geladen…',
    invalidTitle: 'Dieser Link ist ungültig', invalidBody: 'Der Link wurde möglicherweise falsch übernommen oder verändert. Bitten Sie Ihren Handwerksbetrieb, ihn erneut zu senden.',
    expiredTitle: 'Dieser Link ist abgelaufen', expiredBody: 'Angebotslinks sind 90 Tage gültig. Bitten Sie Ihren Handwerksbetrieb um einen neuen Link.',
    notokenTitle: 'Dieser Link ist unvollständig', notokenBody: 'Der Sicherheitscode fehlt in der Adresse. Öffnen Sie den Originallink unverändert.',
    unavailableTitle: 'Vorübergehend nicht verfügbar', unavailableBody: 'Das Angebot konnte gerade nicht geladen werden. Bitte versuchen Sie es in Kürze erneut.',
    privacy: 'Sicherer Link Ihres Handwerksbetriebs. Kein Konto erforderlich.', footer: '© Vasco · vascobuild.com',
  },
  fr: {
    accept: 'Accepter le devis', confirm: 'Oui — accepter', cancel: 'Annuler', decline: 'Refuser', declineTitle: 'Refuser ce devis', reasonLabel: 'Motif (facultatif)', reasonPlaceholder: 'Votre artisan saura pourquoi.', declineConfirm: 'Envoyer le refus', sending: 'Envoi…', acceptedTitle: 'Accepté', acceptedBody: 'Votre artisan a été prévenu et vous contactera pour planifier les travaux.', rejectedTitle: 'Refusé', rejectedBody: 'Votre artisan a été prévenu. Vous pouvez le joindre directement si les choses changent.', alreadyTitle: 'Déjà répondu', alreadyBody: "Ce devis a déjà reçu une réponse. Contactez votre artisan si ce n'était pas vous.", failedTitle: "Cela n'a pas fonctionné", failedBody: "Rien n'a été envoyé. Réessayez ou contactez directement votre artisan.", openAppSecondary: "Ouvrir dans l'app Vasco",
    eyebrow: 'Votre devis', quoteRef: 'Devis', total: 'Total', subtotal: 'Sous-total', vat: 'TVA',
    lines: 'Prestations incluses', qty: 'Qté', openApp: 'Ouvrir dans Vasco pour accepter',
    noApp: 'Nouveau sur Vasco ?', loading: 'Chargement de votre devis…',
    invalidTitle: "Ce lien n'est pas valide", invalidBody: "Le lien a peut-être été mal recopié ou modifié. Demandez à votre artisan de le renvoyer.",
    expiredTitle: 'Ce lien a expiré', expiredBody: 'Les liens de devis restent valides 90 jours. Demandez un nouveau lien à votre artisan.',
    notokenTitle: 'Ce lien est incomplet', notokenBody: "Le code de sécurité est absent de l'adresse. Ouvrez le lien d'origine sans le modifier.",
    unavailableTitle: 'Temporairement indisponible', unavailableBody: "Nous n'avons pas pu charger ce devis. Merci de réessayer sous peu.",
    privacy: 'Lien sécurisé de votre artisan. Aucun compte nécessaire.', footer: '© Vasco · vascobuild.com',
  },
  es: {
    accept: 'Aceptar presupuesto', confirm: 'Sí — aceptar', cancel: 'Cancelar', decline: 'Rechazar', declineTitle: 'Rechazar este presupuesto', reasonLabel: 'Motivo (opcional)', reasonPlaceholder: 'Así tu profesional sabrá por qué.', declineConfirm: 'Enviar rechazo', sending: 'Enviando…', acceptedTitle: 'Aceptado', acceptedBody: 'Tu profesional ha sido avisado y se pondrá en contacto para planificar el trabajo.', rejectedTitle: 'Rechazado', rejectedBody: 'Tu profesional ha sido avisado. Puedes contactarle directamente si algo cambia.', alreadyTitle: 'Ya respondido', alreadyBody: 'Este presupuesto ya tiene respuesta. Contacta con tu profesional si no fuiste tú.', failedTitle: 'No se ha podido enviar', failedBody: 'No se envió nada. Inténtalo de nuevo o contacta directamente con tu profesional.', openAppSecondary: 'Abrir en la app Vasco',
    eyebrow: 'Tu presupuesto', quoteRef: 'Presupuesto', total: 'Total', subtotal: 'Base imponible', vat: 'IVA',
    lines: 'Qué incluye', qty: 'Cant.', openApp: 'Abrir en Vasco para aceptar',
    noApp: '¿Nuevo en Vasco?', loading: 'Cargando tu presupuesto…',
    invalidTitle: 'Este enlace no es válido', invalidBody: 'Puede que el enlace se haya copiado mal o modificado. Pide a tu profesional que te lo envíe de nuevo.',
    expiredTitle: 'Este enlace ha caducado', expiredBody: 'Los enlaces son válidos 90 días. Pide a tu profesional un enlace nuevo.',
    notokenTitle: 'Este enlace está incompleto', notokenBody: 'Falta el código de seguridad en la dirección. Abre el enlace original sin modificarlo.',
    unavailableTitle: 'No disponible temporalmente', unavailableBody: 'No hemos podido cargar el presupuesto. Inténtalo de nuevo en un momento.',
    privacy: 'Enlace seguro de tu profesional. No se necesita cuenta.', footer: '© Vasco · vascobuild.com',
  },
  it: {
    accept: 'Accetta il preventivo', confirm: 'Sì — accetta', cancel: 'Annulla', decline: 'Rifiuta', declineTitle: 'Rifiuta questo preventivo', reasonLabel: 'Motivo (facoltativo)', reasonPlaceholder: 'Così il tuo tecnico sa perché.', declineConfirm: 'Invia il rifiuto', sending: 'Invio…', acceptedTitle: 'Accettato', acceptedBody: 'Il tuo tecnico è stato avvisato e ti contatterà per pianificare i lavori.', rejectedTitle: 'Rifiutato', rejectedBody: 'Il tuo tecnico è stato avvisato. Puoi contattarlo direttamente se qualcosa cambia.', alreadyTitle: 'Già risposto', alreadyBody: 'A questo preventivo è già stata data una risposta. Contatta il tuo tecnico se non sei stato tu.', failedTitle: 'Non è andata a buon fine', failedBody: 'Non è stato inviato nulla. Riprova o contatta direttamente il tuo tecnico.', openAppSecondary: "Apri nell'app Vasco",
    eyebrow: 'Il tuo preventivo', quoteRef: 'Preventivo', total: 'Totale', subtotal: 'Imponibile', vat: 'IVA',
    lines: 'Che cosa include', qty: 'Qtà', openApp: 'Apri in Vasco per accettare',
    noApp: 'Nuovo su Vasco?', loading: 'Caricamento del preventivo…',
    invalidTitle: 'Questo link non è valido', invalidBody: 'Il link potrebbe essere stato copiato male o modificato. Chiedi al tuo tecnico di inviarlo di nuovo.',
    expiredTitle: 'Questo link è scaduto', expiredBody: 'I link restano validi 90 giorni. Chiedi al tuo tecnico un nuovo link.',
    notokenTitle: 'Questo link è incompleto', notokenBody: "Manca il codice di sicurezza nell'indirizzo. Apri il link originale senza modificarlo.",
    unavailableTitle: 'Temporaneamente non disponibile', unavailableBody: 'Non è stato possibile caricare il preventivo. Riprova tra poco.',
    privacy: 'Link sicuro dal tuo tecnico. Nessun account necessario.', footer: '© Vasco · vascobuild.com',
  },
};

export default function PublicQuotePortal({ params }: PageProps) {
  const { id: rawId } = use(params);
  const quoteId = (rawId || '').trim();

  const [phase, setPhase] = useState<Phase>('loading');
  // The acceptance capability minted by verify-quote-token for whoever holds
  // this signed link. Null when the quote is already paid, or when minting
  // failed — in which case the page falls back to the app handoff rather than
  // showing a button that cannot work.
  const [acceptance, setAcceptance] = useState<{ token: string; status: string } | null>(null);
  const [reason, setReason] = useState('');
  const [sendFailed, setSendFailed] = useState(false);
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const [token, setToken] = useState<string | null>(null);

  const copy = COPY[lang];

  // navigator/window are read in an effect, not during render: this is a client
  // component but Next still prerenders it on the server, and touching either
  // in a useMemo hydrates a mismatched tree.
  useEffect(() => {
    setLang(pickLanguage());
    setIsMobile(isMobileUA());
    // The root layout hardcodes <html lang="en">, so without this a screen
    // reader announces Dutch copy in an English voice and browser translation
    // offers to translate Dutch into Dutch. The language is only known here,
    // after navigator has been read.
    document.documentElement.lang = pickLanguage();
    setToken(new URLSearchParams(window.location.search).get('t') ?? '');
  }, []);

  // Forward the token into the app too. The mobile handler needs it — without
  // it customer-view has nothing to verify and renders an empty screen.
  const deepLink = useMemo(
    () => `vasco://quote/${encodeURIComponent(quoteId)}${token ? `?t=${encodeURIComponent(token)}` : ''}`,
    [quoteId, token],
  );

  useEffect(() => {
    // `null` means the effect above has not run yet; '' means genuinely absent.
    if (token === null) return;
    let cancelled = false;

    async function load() {
      if (!quoteId || !token) { setPhase('notoken'); return; }
      if (!isSupabaseConfigured()) { setPhase('unavailable'); return; }

      const supabase = getSupabase();
      if (!supabase) { setPhase('unavailable'); return; }

      try {
        const { data, error } = await supabase.functions.invoke('verify-quote-token', {
          body: { quoteId, token },
        });
        if (cancelled) return;

        // A non-2xx surfaces as `error`, but the body still says WHICH refusal
        // it was — and expired-vs-invalid are different things to tell a
        // customer: one means "ask for a new link", the other "you may have the
        // wrong link". Falling back to 'invalid' is the safe default.
        if (error || !data?.ok) {
          const reason = String(data?.error ?? error?.message ?? '').toLowerCase();
          setPhase(reason.includes('expired') ? 'expired' : 'invalid');
          return;
        }
        setQuote(data.quote as QuotePayload);
        const acc = (data as { acceptance?: { token: string; status: string } }).acceptance ?? null;
        setAcceptance(acc);
        // Order matters: "already answered" beats the accept buttons, so a
        // customer who decided last week is told so rather than offered a
        // control the server will refuse.
        setPhase(acc && acc.status !== 'pending' ? 'alreadyDecided' : 'ready');
      } catch {
        if (!cancelled) setPhase('unavailable');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [quoteId, token]);

  const currency = COUNTRY_CURRENCY[(quote?.business?.country ?? '').toUpperCase()] ?? 'EUR';
  const money = useMemo(
    () => moneyFormatter(LANG_LOCALE[lang], { style: 'currency', currency }),
    [lang, currency],
  );

  /**
   * Same two RPCs /accept/[token] uses, so there is one acceptance mechanism
   * rather than two that can disagree. `decide_acceptance_link` also mirrors
   * the decision onto documents.status (migration 20260819000012) — without
   * that the contractor never learns, because nothing reads the link table.
   */
  const decide = useCallback(async (decision: 'accepted' | 'rejected') => {
    if (!acceptance) return;
    const supabase = getSupabase();
    if (!supabase) { setPhase('unavailable'); return; }
    setSendFailed(false);
    setPhase('sending');
    try {
      const { data, error } = await supabase.rpc('decide_acceptance_link', {
        p_token: acceptance.token,
        p_decision: decision,
        p_reason: decision === 'rejected' ? (reason.trim() || null) : null,
      });
      if (error) { setSendFailed(true); setPhase('ready'); return; }
      // NULL means the server refused — answered in the meantime, or expired
      // between load and tap. A different outcome, not an error, and the
      // customer is owed the real one.
      if (!data) { setPhase('alreadyDecided'); return; }
      setPhase(decision === 'accepted' ? 'accepted' : 'rejected');
    } catch {
      setSendFailed(true);
      setPhase('ready');
    }
  }, [acceptance, reason]);

  const lines = useMemo(
    () => [...(quote?.lines ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [quote],
  );

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .vb-fade { animation: fadeUp 0.5s ease both; }
        .vb-fade-2 { animation-delay: 0.10s }
        .vb-fade-3 { animation-delay: 0.20s }
        .vb-spin { animation: spin 0.9s linear infinite; }
        .vb-cta:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .vb-cta:active { transform: translateY(0); filter: brightness(0.95); }
        .vb-store:hover { background: rgba(249,115,22,0.08); }
      `}</style>
      <main
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0) 60%), radial-gradient(ellipse at top, #14181F 0%, #0B0E11 60%)',
          color: '#FFFFFF',
          fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 20px',
        }}
      >
        <header
          className="vb-fade"
          style={{ width: '100%', maxWidth: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0 24px' }}
        >
          <Image src="/vasco-logo.png" alt="Vasco" width={28} height={28} priority style={{ borderRadius: 6 }} />
          <span style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: 1.6, textTransform: 'uppercase' }}>
            Vasco
          </span>
        </header>

        <section style={{ maxWidth: 560, width: '100%', flex: 1 }}>
          {phase === 'loading' && (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div
                className="vb-spin"
                style={{ width: 34, height: 34, border: '3px solid rgba(255,255,255,0.18)', borderTopColor: '#F97316', borderRadius: '50%', margin: '0 auto 20px' }}
                aria-hidden
              />
              <p style={{ color: '#9CA3AF', fontSize: 15, margin: 0 }}>{copy.loading}</p>
            </div>
          )}

          {(phase === 'invalid' || phase === 'expired' || phase === 'notoken' || phase === 'unavailable') && (
            <Problem title={copy[`${phase}Title`]} body={copy[`${phase}Body`]} footer={copy.footer} />
          )}

          {phase === 'accepted' && <Problem title={copy.acceptedTitle} body={copy.acceptedBody} footer={copy.footer} />}
          {phase === 'rejected' && <Problem title={copy.rejectedTitle} body={copy.rejectedBody} footer={copy.footer} />}
          {phase === 'alreadyDecided' && <Problem title={copy.alreadyTitle} body={copy.alreadyBody} footer={copy.footer} />}

          {(phase === 'ready' || phase === 'confirming' || phase === 'declining' || phase === 'sending') && quote && (
            <>
              <p
                className="vb-fade vb-fade-2"
                style={{ fontSize: 12, fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#F59E0B', margin: '0 0 10px', textAlign: 'center' }}
              >
                {copy.eyebrow}
              </p>

              {/* Business name alone — NO "From" prefix. It rendered as
                  "Van Van der Berg Loodgieters" on the first real quote: the
                  Dutch word for "from" is "Van", and a large share of Dutch
                  trade businesses are named "Van …". The eyebrow above already
                  establishes whose quote this is, so the preposition earned
                  nothing and broke on the home market's most common name shape. */}
              {quote.business?.business_name && (
                <h1
                  className="vb-fade vb-fade-2"
                  style={{ fontSize: 26, fontWeight: 900, margin: '0 0 6px', letterSpacing: -0.6, textAlign: 'center', fontFamily: 'var(--font-archivo), var(--font-inter), sans-serif', lineHeight: 1.2 }}
                >
                  {quote.business.business_name}
                </h1>
              )}

              {quote.reference && (
                <p className="vb-fade vb-fade-2" style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, margin: '0 0 28px' }}>
                  {copy.quoteRef} {quote.reference}
                </p>
              )}

              {lines.length > 0 && (
                <div
                  className="vb-fade vb-fade-3"
                  style={{ background: '#14181F', border: '1px solid #2A3038', borderRadius: 18, padding: '20px 18px', marginBottom: 18 }}
                >
                  <p style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: '#6B7280', fontWeight: 700, margin: '0 0 14px' }}>
                    {copy.lines}
                  </p>
                  {lines.map((l, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0',
                        borderTop: i === 0 ? 'none' : '1px solid rgba(42,48,56,0.6)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>{l.description ?? '—'}</p>
                        {l.quantity != null && (
                          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280' }}>
                            {copy.qty} {l.quantity}
                            {l.unit_price != null ? ` × ${money.format(l.unit_price)}` : ''}
                          </p>
                        )}
                      </div>
                      {l.total_price != null && (
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {money.format(l.total_price)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {quote.total != null && (
                <div
                  className="vb-fade vb-fade-3"
                  style={{
                    background: '#1C2128', border: '1px solid #2A3038', borderRadius: 18,
                    padding: '18px 20px', marginBottom: 26,
                  }}
                >
                  {quote.subtotal != null && quote.vatAmount != null && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: '#9CA3AF' }}>{copy.subtotal}</span>
                        <span style={{ fontSize: 14, color: '#D1D5DB', whiteSpace: 'nowrap' }}>{money.format(quote.subtotal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #2A3038' }}>
                        <span style={{ fontSize: 13, color: '#9CA3AF' }}>
                          {copy.vat}{quote.vatRate != null ? ` (${Math.round(quote.vatRate * 100)}%)` : ''}
                        </span>
                        <span style={{ fontSize: 14, color: '#D1D5DB', whiteSpace: 'nowrap' }}>{money.format(quote.vatAmount)}</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 700 }}>
                      {copy.total}
                    </span>
                    <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-archivo), sans-serif', whiteSpace: 'nowrap' }}>
                      {money.format(quote.total)}
                    </span>
                  </div>
                </div>
              )}

              {/* This block used to be a single "Open in Vasco to accept"
                  button, correctly, because no accept endpoint existed. One
                  does now — so the seam it left is gone: the RICH link (with
                  line items) could not accept, and the link that could accept
                  showed no line items, and the contractor had to know to send
                  the second one.

                  Same two-tap confirm as /accept/[token], for the same reason:
                  a thumb landing on a CTA in a chat app must not commit
                  someone to several thousand euros. Playbook §8. */}
              {acceptance && (phase === 'ready' || phase === 'confirming' || phase === 'declining' || phase === 'sending') && (
                <div className="vb-fade vb-fade-3" style={{ marginBottom: 26 }}>
                  {sendFailed && (
                    <div role="alert" style={{ background: '#1C2128', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{copy.failedTitle}</p>
                      <p style={{ margin: '6px 0 0', color: '#9CA3AF', fontSize: 13, lineHeight: 1.55 }}>{copy.failedBody}</p>
                    </div>
                  )}

                  {phase === 'ready' && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <button className="vb-cta" style={ctaStyle} onClick={() => setPhase('confirming')}>{copy.accept}</button>
                      <button className="vb-ghost" style={ghostStyle} onClick={() => setPhase('declining')}>{copy.decline}</button>
                    </div>
                  )}

                  {phase === 'confirming' && (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <button className="vb-cta" style={ctaStyle} onClick={() => decide('accepted')}>
                        {quote.total != null ? `${copy.confirm} · ${money.format(quote.total)}` : copy.confirm}
                      </button>
                      <button className="vb-ghost" style={ghostStyle} onClick={() => setPhase('ready')}>{copy.cancel}</button>
                    </div>
                  )}

                  {phase === 'declining' && (
                    <div style={{ display: 'grid', gap: 12, background: '#1C2128', border: '1px solid #2A3038', borderRadius: 18, padding: '18px 20px' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{copy.declineTitle}</p>
                      <label style={{ fontSize: 12, color: '#9CA3AF' }}>
                        {copy.reasonLabel}
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder={copy.reasonPlaceholder}
                          rows={3}
                          maxLength={2000}
                          style={{ display: 'block', width: '100%', marginTop: 8, resize: 'vertical', background: '#0B0E11', color: '#fff', border: '1px solid #2A3038', borderRadius: 10, padding: '11px 12px', fontSize: 15, fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
                        />
                      </label>
                      <button className="vb-cta" style={{ ...ctaStyle, background: '#7F1D1D', boxShadow: 'none' }} onClick={() => decide('rejected')}>{copy.declineConfirm}</button>
                      <button className="vb-ghost" style={ghostStyle} onClick={() => { setReason(''); setPhase('ready'); }}>{copy.cancel}</button>
                    </div>
                  )}

                  {phase === 'sending' && (
                    <button className="vb-cta" style={ctaStyle} disabled>{copy.sending}</button>
                  )}
                </div>
              )}

              {/* The app stays available as a SECONDARY path — and is the only
                  one when no acceptance capability could be minted. */}
              <div className="vb-fade vb-fade-3" style={{ textAlign: 'center' }}>
                <button onClick={() => { window.location.href = deepLink; }} className={acceptance ? 'vb-ghost' : 'vb-cta'} style={acceptance ? ghostStyle : ctaStyle}>
                  {acceptance ? copy.openAppSecondary : copy.openApp}
                </button>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '20px auto 0', maxWidth: 380, lineHeight: 1.55 }}>
                  {copy.privacy}
                </p>
                {!isMobile && (
                  <div style={{ marginTop: 30, paddingTop: 22, borderTop: '1px solid rgba(42,48,56,0.6)' }}>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 14px', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>
                      {copy.noApp}
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <a href={STORE_IOS} className="vb-store" style={storeBtnStyle}>App Store</a>
                      <a href={STORE_ANDROID} className="vb-store" style={storeBtnStyle}>Google Play</a>
                    </div>
                  </div>
                )}
              </div>

              <footer style={{ fontSize: 11, color: '#4B5563', letterSpacing: 0.6, textAlign: 'center', padding: '32px 0 4px' }}>
                {copy.footer}
              </footer>
            </>
          )}
        </section>
      </main>
    </>
  );
}

function Problem({ title, body, footer }: { title: string; body: string; footer: string }) {
  return (
    <div className="vb-fade vb-fade-2" style={{ textAlign: 'center', padding: '48px 0' }}>
      <div
        style={{
          width: 76, height: 76, borderRadius: 24, margin: '0 auto 24px',
          background: '#1C2128', border: '1px solid #2A3038',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-hidden
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v5M12 16.5v.5" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" stroke="#F59E0B" strokeWidth="1.8" />
        </svg>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 12px', fontFamily: 'var(--font-archivo), var(--font-inter), sans-serif', lineHeight: 1.25 }}>
        {title}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: '#9CA3AF', margin: '0 auto', maxWidth: 380, padding: '0 12px' }}>
        {body}
      </p>
      <footer style={{ fontSize: 11, color: '#4B5563', letterSpacing: 0.6, textAlign: 'center', padding: '40px 0 4px' }}>
        {footer}
      </footer>
    </div>
  );
}

const ghostStyle = {
  display: 'block' as const,
  width: '100%',
  cursor: 'pointer' as const,
  background: 'transparent',
  border: '1px solid #2A3038',
  color: '#9CA3AF',
  fontFamily: 'var(--font-inter), sans-serif',
  fontWeight: 600 as const,
  fontSize: 14,
  padding: '14px 20px',
  borderRadius: 16,
};

const ctaStyle = {
  display: 'inline-flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 10,
  background: 'linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 16,
  padding: '16px 30px',
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: 0.8,
  cursor: 'pointer',
  boxShadow: '0 12px 32px rgba(249,115,22,0.5)',
  fontFamily: 'var(--font-archivo), var(--font-inter), sans-serif',
  textTransform: 'uppercase' as const,
  minWidth: 240,
  transition: 'transform 0.15s ease, filter 0.15s ease',
};

const storeBtnStyle = {
  color: '#F97316',
  textDecoration: 'none',
  border: '1px solid rgba(249,115,22,0.35)',
  borderRadius: 12,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  fontFamily: 'var(--font-archivo), sans-serif',
  display: 'inline-flex' as const,
  alignItems: 'center' as const,
  gap: 8,
  transition: 'background 0.15s ease',
};
