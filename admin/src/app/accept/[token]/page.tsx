// =============================================================================
// QUOTE ACCEPTANCE — https://admin.vascobuild.com/accept/{TOKEN}
// =============================================================================
// Until 2026-08-19 this page showed NO quote content at all. It waited 700ms,
// fired `vasco://accept/<token>`, and offered App Store buttons — a pure
// deep-link bouncer aimed at an app the reader does not have. The recipient is
// the contractor's CUSTOMER; asking them to install a contractor's field-service
// app to answer a quote is a dead end for almost every one of them. The page
// even said "No account needed" directly above two store badges.
//
// It shipped that way for a defensible reason: there was no wired accept
// endpoint, and playbook §8 is explicit that a dead control is worse than an
// honest handoff. The endpoint now exists — `decide_acceptance_link`, anon
// callable, capability-scoped by the token in this URL — so the honest handoff
// is no longer the best available answer.
//
// The whole flow is anon. There is no account, no session and no login; the
// 32-hex token in the path IS the credential, and the two RPCs behind it
// resolve the contractor, the amount and the tenant server-side. Nothing this
// page sends is trusted for anything except "here is the token I was given".
//
// See docs/ui-playbook.md §8. Sibling: /quote/[id], which renders line items
// from a signed `?t=` and deliberately has no accept button — the signed quote
// portal and the acceptance link are two different capabilities.
// =============================================================================

'use client';

import Image from 'next/image';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';

// R191 TODO: shared placeholder with /quote/[id] and /auth/callback. Replace
// once the App Store Connect listing exists.
const STORE_IOS = 'https://apps.apple.com/app/id0000000000';
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.vascobuild.app';

interface PageProps {
  params: Promise<{ token: string }>;
}

interface AcceptanceLink {
  token: string;
  quote_id: string | null;
  customer_name: string | null;
  quote_amount: number | string | null;
  quote_description: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  decline_reason: string | null;
  responded_at: string | null;
  expires_at: string;
  contractor_name: string | null;
  contractor_country: string | null;
}

type Phase =
  | 'loading'
  | 'ready'        // pending, awaiting the customer
  | 'confirming'   // accept tapped once; one more tap commits
  | 'declining'    // decline tapped; reason box open
  | 'sending'
  | 'accepted'
  | 'rejected'
  | 'alreadyDecided'
  | 'expired'
  | 'invalid'
  | 'unavailable';

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

// The CONTRACTOR's country decides the currency, not the reader's browser.
// Playbook §8.
const COUNTRY_CURRENCY: Record<string, string> = {
  NL: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR',
  UK: 'GBP', GB: 'GBP', US: 'USD',
};
const LANG_LOCALE: Record<Lang, string> = {
  nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT',
};

// German is Sie, never du — including copy addressing the contractor's own
// customer. Playbook §5. This file was the last du in admin/: the 138-string
// sweep covered the app's i18n JSON and never reached these pages.
//
// The trade noun is the market's own word for the person who sent the quote —
// vakman / Handwerksbetrieb / artisan / profesional / tecnico. "contractor" is
// not an Italian word and was sitting in the Italian copy.
const COPY: Record<Lang, Record<string, string>> = {
  en: {
    eyebrow: 'Quote for approval', sentYou: 'sent you a quote', ref: 'Quote', total: 'Total',
    validUntil: 'Valid until', accept: 'Accept quote', confirm: 'Yes — accept',
    cancel: 'Cancel', decline: 'Decline', declineTitle: 'Decline this quote',
    reasonLabel: 'Reason (optional)', reasonPlaceholder: 'Lets your contractor know why.',
    declineConfirm: 'Send decline', sending: 'Sending…',
    acceptedTitle: 'Accepted', acceptedBody: 'Your contractor has been notified and will be in touch to plan the work.',
    rejectedTitle: 'Declined', rejectedBody: 'Your contractor has been notified. You can still reach them directly if anything changes.',
    alreadyTitle: 'Already answered', alreadyBody: 'This quote has already been answered. Contact your contractor if that was not you.',
    expiredTitle: 'This quote has expired', expiredBody: 'Ask your contractor for a fresh link and they will send a new one.',
    invalidTitle: 'This link is not valid', invalidBody: 'The link may have been mistyped or changed. Ask your contractor to send it again.',
    unavailableTitle: 'Temporarily unavailable', unavailableBody: 'We could not load this quote right now. Please try again shortly.',
    failedTitle: 'That did not go through', failedBody: 'Nothing was sent. Please try again, or contact your contractor directly.',
    openApp: 'Open in the Vasco app', noApp: 'New to Vasco?',
    privacy: 'Secure link from your contractor. No account needed.', footer: '© Vasco · vascobuild.com',
    loading: 'Loading your quote…',
  },
  nl: {
    eyebrow: 'Offerte ter goedkeuring', sentYou: 'heeft je een offerte gestuurd', ref: 'Offerte', total: 'Totaal',
    validUntil: 'Geldig tot', accept: 'Offerte accepteren', confirm: 'Ja — accepteren',
    cancel: 'Annuleren', decline: 'Afwijzen', declineTitle: 'Deze offerte afwijzen',
    reasonLabel: 'Reden (optioneel)', reasonPlaceholder: 'Zo weet je vakman waarom.',
    declineConfirm: 'Afwijzing versturen', sending: 'Versturen…',
    acceptedTitle: 'Geaccepteerd', acceptedBody: 'Je vakman heeft bericht gekregen en neemt contact op om het werk in te plannen.',
    rejectedTitle: 'Afgewezen', rejectedBody: 'Je vakman heeft bericht gekregen. Je kunt hem altijd rechtstreeks bereiken als er iets verandert.',
    alreadyTitle: 'Al beantwoord', alreadyBody: 'Deze offerte is al beantwoord. Neem contact op met je vakman als jij dat niet was.',
    expiredTitle: 'Deze offerte is verlopen', expiredBody: 'Vraag je vakman om een nieuwe link, dan stuurt hij hem opnieuw.',
    invalidTitle: 'Deze link is niet geldig', invalidBody: 'De link is mogelijk verkeerd overgenomen of gewijzigd. Vraag je vakman om hem opnieuw te sturen.',
    unavailableTitle: 'Tijdelijk niet beschikbaar', unavailableBody: 'We konden deze offerte nu niet laden. Probeer het zo dadelijk opnieuw.',
    failedTitle: 'Dat is niet gelukt', failedBody: 'Er is niets verstuurd. Probeer het opnieuw of neem rechtstreeks contact op met je vakman.',
    openApp: 'Openen in de Vasco-app', noApp: 'Nieuw bij Vasco?',
    privacy: 'Veilige link van je vakman. Geen account nodig.', footer: '© Vasco · vascobuild.com',
    loading: 'Je offerte wordt geladen…',
  },
  de: {
    eyebrow: 'Angebot zur Freigabe', sentYou: 'hat Ihnen ein Angebot gesendet', ref: 'Angebot', total: 'Gesamt',
    validUntil: 'Gültig bis', accept: 'Angebot annehmen', confirm: 'Ja — annehmen',
    cancel: 'Abbrechen', decline: 'Ablehnen', declineTitle: 'Dieses Angebot ablehnen',
    reasonLabel: 'Begründung (optional)', reasonPlaceholder: 'So weiß Ihr Handwerksbetrieb, woran es lag.',
    declineConfirm: 'Ablehnung senden', sending: 'Wird gesendet…',
    acceptedTitle: 'Angenommen', acceptedBody: 'Ihr Handwerksbetrieb wurde benachrichtigt und meldet sich zur Terminplanung.',
    rejectedTitle: 'Abgelehnt', rejectedBody: 'Ihr Handwerksbetrieb wurde benachrichtigt. Sie können ihn jederzeit direkt erreichen.',
    alreadyTitle: 'Bereits beantwortet', alreadyBody: 'Dieses Angebot wurde bereits beantwortet. Melden Sie sich bei Ihrem Handwerksbetrieb, falls Sie das nicht waren.',
    expiredTitle: 'Dieses Angebot ist abgelaufen', expiredBody: 'Bitten Sie Ihren Handwerksbetrieb um einen neuen Link.',
    invalidTitle: 'Dieser Link ist ungültig', invalidBody: 'Der Link wurde möglicherweise falsch übernommen oder verändert. Bitten Sie Ihren Handwerksbetrieb, ihn erneut zu senden.',
    unavailableTitle: 'Vorübergehend nicht verfügbar', unavailableBody: 'Das Angebot konnte gerade nicht geladen werden. Bitte versuchen Sie es in Kürze erneut.',
    failedTitle: 'Das hat nicht geklappt', failedBody: 'Es wurde nichts gesendet. Bitte versuchen Sie es erneut oder wenden Sie sich direkt an Ihren Handwerksbetrieb.',
    openApp: 'In der Vasco-App öffnen', noApp: 'Neu bei Vasco?',
    privacy: 'Sicherer Link Ihres Handwerksbetriebs. Kein Konto erforderlich.', footer: '© Vasco · vascobuild.com',
    loading: 'Ihr Angebot wird geladen…',
  },
  fr: {
    eyebrow: 'Devis à approuver', sentYou: 'vous a envoyé un devis', ref: 'Devis', total: 'Total',
    validUntil: "Valable jusqu'au", accept: 'Accepter le devis', confirm: 'Oui — accepter',
    cancel: 'Annuler', decline: 'Refuser', declineTitle: 'Refuser ce devis',
    reasonLabel: 'Motif (facultatif)', reasonPlaceholder: 'Votre artisan saura pourquoi.',
    declineConfirm: 'Envoyer le refus', sending: 'Envoi…',
    acceptedTitle: 'Accepté', acceptedBody: 'Votre artisan a été prévenu et vous contactera pour planifier les travaux.',
    rejectedTitle: 'Refusé', rejectedBody: 'Votre artisan a été prévenu. Vous pouvez le joindre directement si les choses changent.',
    alreadyTitle: 'Déjà répondu', alreadyBody: "Ce devis a déjà reçu une réponse. Contactez votre artisan si ce n'était pas vous.",
    expiredTitle: 'Ce devis a expiré', expiredBody: 'Demandez un nouveau lien à votre artisan.',
    invalidTitle: "Ce lien n'est pas valide", invalidBody: 'Le lien a peut-être été mal recopié ou modifié. Demandez à votre artisan de le renvoyer.',
    unavailableTitle: 'Temporairement indisponible', unavailableBody: "Nous n'avons pas pu charger ce devis. Merci de réessayer sous peu.",
    failedTitle: "Cela n'a pas fonctionné", failedBody: "Rien n'a été envoyé. Réessayez ou contactez directement votre artisan.",
    openApp: "Ouvrir dans l'app Vasco", noApp: 'Nouveau sur Vasco ?',
    privacy: 'Lien sécurisé de votre artisan. Aucun compte nécessaire.', footer: '© Vasco · vascobuild.com',
    loading: 'Chargement de votre devis…',
  },
  es: {
    eyebrow: 'Presupuesto para aprobar', sentYou: 'te ha enviado un presupuesto', ref: 'Presupuesto', total: 'Total',
    validUntil: 'Válido hasta', accept: 'Aceptar presupuesto', confirm: 'Sí — aceptar',
    cancel: 'Cancelar', decline: 'Rechazar', declineTitle: 'Rechazar este presupuesto',
    reasonLabel: 'Motivo (opcional)', reasonPlaceholder: 'Así tu profesional sabrá por qué.',
    declineConfirm: 'Enviar rechazo', sending: 'Enviando…',
    acceptedTitle: 'Aceptado', acceptedBody: 'Tu profesional ha sido avisado y se pondrá en contacto para planificar el trabajo.',
    rejectedTitle: 'Rechazado', rejectedBody: 'Tu profesional ha sido avisado. Puedes contactarle directamente si algo cambia.',
    alreadyTitle: 'Ya respondido', alreadyBody: 'Este presupuesto ya tiene respuesta. Contacta con tu profesional si no fuiste tú.',
    expiredTitle: 'Este presupuesto ha caducado', expiredBody: 'Pide a tu profesional un enlace nuevo.',
    invalidTitle: 'Este enlace no es válido', invalidBody: 'Puede que el enlace se haya copiado mal o modificado. Pide a tu profesional que te lo envíe de nuevo.',
    unavailableTitle: 'No disponible temporalmente', unavailableBody: 'No hemos podido cargar el presupuesto. Inténtalo de nuevo en un momento.',
    failedTitle: 'No se ha podido enviar', failedBody: 'No se envió nada. Inténtalo de nuevo o contacta directamente con tu profesional.',
    openApp: 'Abrir en la app Vasco', noApp: '¿Nuevo en Vasco?',
    privacy: 'Enlace seguro de tu profesional. No se necesita cuenta.', footer: '© Vasco · vascobuild.com',
    loading: 'Cargando tu presupuesto…',
  },
  it: {
    eyebrow: 'Preventivo da approvare', sentYou: 'ti ha inviato un preventivo', ref: 'Preventivo', total: 'Totale',
    validUntil: 'Valido fino al', accept: 'Accetta il preventivo', confirm: 'Sì — accetta',
    cancel: 'Annulla', decline: 'Rifiuta', declineTitle: 'Rifiuta questo preventivo',
    reasonLabel: 'Motivo (facoltativo)', reasonPlaceholder: 'Così il tuo tecnico sa perché.',
    declineConfirm: 'Invia il rifiuto', sending: 'Invio…',
    acceptedTitle: 'Accettato', acceptedBody: 'Il tuo tecnico è stato avvisato e ti contatterà per pianificare i lavori.',
    rejectedTitle: 'Rifiutato', rejectedBody: 'Il tuo tecnico è stato avvisato. Puoi contattarlo direttamente se qualcosa cambia.',
    alreadyTitle: 'Già risposto', alreadyBody: 'A questo preventivo è già stata data una risposta. Contatta il tuo tecnico se non sei stato tu.',
    expiredTitle: 'Questo preventivo è scaduto', expiredBody: 'Chiedi al tuo tecnico un nuovo link.',
    invalidTitle: 'Questo link non è valido', invalidBody: 'Il link potrebbe essere stato copiato male o modificato. Chiedi al tuo tecnico di inviarlo di nuovo.',
    unavailableTitle: 'Temporaneamente non disponibile', unavailableBody: 'Non è stato possibile caricare il preventivo. Riprova tra poco.',
    failedTitle: 'Non è andata a buon fine', failedBody: 'Non è stato inviato nulla. Riprova o contatta direttamente il tuo tecnico.',
    openApp: "Apri nell'app Vasco", noApp: 'Nuovo su Vasco?',
    privacy: 'Link sicuro dal tuo tecnico. Nessun account necessario.', footer: '© Vasco · vascobuild.com',
    loading: 'Caricamento del preventivo…',
  },
};

const PANEL: React.CSSProperties = {
  background: 'rgba(20,24,31,0.72)',
  border: '1px solid #2A3038',
  borderRadius: 18,
  padding: '26px 22px',
  backdropFilter: 'blur(8px)',
};

const CTA: React.CSSProperties = {
  display: 'block', width: '100%', border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)',
  color: '#fff', fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 800,
  fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase',
  padding: '17px 24px', borderRadius: 28,
  boxShadow: '0 14px 34px rgba(249,115,22,0.38)',
};

const GHOST: React.CSSProperties = {
  display: 'block', width: '100%', cursor: 'pointer',
  background: 'transparent', border: '1px solid #2A3038', color: '#9CA3AF',
  fontFamily: 'var(--font-inter), sans-serif', fontWeight: 600, fontSize: 14,
  padding: '14px 20px', borderRadius: 28,
};

function Outcome({ title, body, tone, footer }: { title: string; body: string; tone: 'good' | 'neutral' | 'bad'; footer: string }) {
  const ring = tone === 'good' ? '#22C55E' : tone === 'bad' ? '#EF4444' : '#F59E0B';
  return (
    <div className="vb-fade" style={{ ...PANEL, textAlign: 'center', padding: '40px 24px' }}>
      <div
        style={{
          width: 62, height: 62, borderRadius: '50%', margin: '0 auto 20px',
          border: `2px solid ${ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-hidden
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ring} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {tone === 'good' ? <polyline points="20 6 9 17 4 12" /> : tone === 'bad' ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.6" /></>}
        </svg>
      </div>
      <h1 style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 22, margin: '0 0 12px', letterSpacing: 0.2 }}>{title}</h1>
      <p style={{ color: '#9CA3AF', fontSize: 15, lineHeight: 1.6, margin: 0 }}>{body}</p>
      <p style={{ fontSize: 11, color: '#4B5563', letterSpacing: 0.6, marginTop: 30 }}>{footer}</p>
    </div>
  );
}

export default function QuoteAcceptance({ params }: PageProps) {
  const { token: rawToken } = use(params);
  const token = (rawToken || '').trim();

  const [phase, setPhase] = useState<Phase>('loading');
  const [link, setLink] = useState<AcceptanceLink | null>(null);
  const [reason, setReason] = useState('');
  const [sendFailed, setSendFailed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [lang, setLang] = useState<Lang>('en');
  const copy = COPY[lang];

  // navigator is read in an effect, not during render: Next prerenders this
  // client component on the server and touching navigator in a useMemo
  // hydrates a mismatched tree.
  useEffect(() => {
    setLang(pickLanguage());
    setIsMobile(isMobileUA());
  }, []);

  const deepLink = `vasco://accept/${encodeURIComponent(token)}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) { setPhase('invalid'); return; }
      if (!isSupabaseConfigured()) { setPhase('unavailable'); return; }
      const supabase = getSupabase();
      if (!supabase) { setPhase('unavailable'); return; }

      try {
        const { data, error } = await supabase.rpc('get_acceptance_link_by_token', { p_token: token });
        if (cancelled) return;

        // The RPC returns NULL for malformed AND for absent, deliberately — a
        // scanner must not be able to tell a wrong token from one that never
        // existed. Both are "not valid" to the person holding the link.
        if (error) { setPhase('unavailable'); return; }
        if (!data) { setPhase('invalid'); return; }

        const row = data as AcceptanceLink;
        setLink(row);

        // Order matters. "Already answered" beats "expired": a quote accepted
        // last month and now past its date should say it was accepted, not
        // send the customer back to ask for a link they no longer need.
        if (row.status !== 'pending') { setPhase('alreadyDecided'); return; }
        if (new Date(row.expires_at) < new Date()) { setPhase('expired'); return; }
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('unavailable');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  const currency = COUNTRY_CURRENCY[(link?.contractor_country ?? '').toUpperCase()] ?? 'EUR';
  const money = useMemo(
    () => new Intl.NumberFormat(LANG_LOCALE[lang], { style: 'currency', currency }),
    [lang, currency],
  );
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(LANG_LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' }),
    [lang],
  );

  const decide = useCallback(async (decision: 'accepted' | 'rejected') => {
    const supabase = getSupabase();
    if (!supabase) { setPhase('unavailable'); return; }
    setSendFailed(false);
    setPhase('sending');
    try {
      const { data, error } = await supabase.rpc('decide_acceptance_link', {
        p_token: token,
        p_decision: decision,
        p_reason: decision === 'rejected' ? (reason.trim() || null) : null,
      });
      if (error) { setSendFailed(true); setPhase('ready'); return; }
      // NULL means the server refused: someone answered in the meantime, or it
      // expired between load and tap. Not an error — a different outcome, and
      // the customer is owed the real one rather than a false confirmation.
      if (!data) { setPhase('alreadyDecided'); return; }
      setLink(data as AcceptanceLink);
      setPhase(decision === 'accepted' ? 'accepted' : 'rejected');
    } catch {
      setSendFailed(true);
      setPhase('ready');
    }
  }, [token, reason]);

  const amount = link?.quote_amount == null ? null : Number(link.quote_amount);

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .vb-fade { animation: fadeUp 0.5s ease both; }
        .vb-fade-2 { animation-delay: 0.10s }
        .vb-fade-3 { animation-delay: 0.20s }
        .vb-spin { animation: spin 0.9s linear infinite; }
        .vb-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
        .vb-cta:active:not(:disabled) { transform: translateY(0); filter: brightness(0.95); }
        .vb-cta:disabled { opacity: 0.6; cursor: default; }
        .vb-ghost:hover { border-color: #3A424C; color: #D1D5DB; }
        .vb-store:hover { background: rgba(249,115,22,0.08); }
        textarea:focus { outline: none; border-color: #F97316; }
      `}</style>
      <main
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0) 60%), radial-gradient(ellipse at top, #14181F 0%, #0B0E11 60%)',
          color: '#FFFFFF',
          fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '32px 20px',
        }}
      >
        <header
          className="vb-fade"
          style={{ width: '100%', maxWidth: 480, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0 24px' }}
        >
          <Image src="/vasco-logo.png" alt="Vasco" width={28} height={28} priority style={{ borderRadius: 6 }} />
          <span style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: 1.6, textTransform: 'uppercase' }}>
            Vasco
          </span>
        </header>

        <section style={{ maxWidth: 480, width: '100%', flex: 1 }}>
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

          {phase === 'invalid' && <Outcome tone="neutral" title={copy.invalidTitle} body={copy.invalidBody} footer={copy.footer} />}
          {phase === 'unavailable' && <Outcome tone="neutral" title={copy.unavailableTitle} body={copy.unavailableBody} footer={copy.footer} />}
          {phase === 'expired' && <Outcome tone="neutral" title={copy.expiredTitle} body={copy.expiredBody} footer={copy.footer} />}
          {phase === 'alreadyDecided' && <Outcome tone="neutral" title={copy.alreadyTitle} body={copy.alreadyBody} footer={copy.footer} />}
          {phase === 'accepted' && <Outcome tone="good" title={copy.acceptedTitle} body={copy.acceptedBody} footer={copy.footer} />}
          {phase === 'rejected' && <Outcome tone="bad" title={copy.rejectedTitle} body={copy.rejectedBody} footer={copy.footer} />}

          {(phase === 'ready' || phase === 'confirming' || phase === 'declining' || phase === 'sending') && link && (
            <>
              <p
                className="vb-fade vb-fade-2"
                style={{ fontSize: 12, fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#F59E0B', margin: '0 0 10px', textAlign: 'center' }}
              >
                {copy.eyebrow}
              </p>

              {/* Business name alone, no preposition. /quote/[id] shipped
                  "Van Van der Berg Loodgieters" on its first real quote — the
                  Dutch for "from" is "Van" and a large share of Dutch trade
                  businesses are named "Van …". Same trap, avoided here. */}
              {link.contractor_name && (
                <h1
                  className="vb-fade vb-fade-2"
                  style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 24, lineHeight: 1.25, margin: '0 0 6px', textAlign: 'center' }}
                >
                  {link.contractor_name}
                </h1>
              )}
              <p className="vb-fade vb-fade-2" style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 26px', textAlign: 'center' }}>
                {copy.sentYou}
              </p>

              <div className="vb-fade vb-fade-3" style={{ ...PANEL, marginBottom: 22 }}>
                {link.quote_id && (
                  <Row label={copy.ref} value={link.quote_id} />
                )}
                {link.customer_name && (
                  <Row label="—" value={link.customer_name} hideLabel />
                )}
                {link.quote_description && (
                  <p style={{ color: '#D1D5DB', fontSize: 15, lineHeight: 1.6, margin: '14px 0 0' }}>
                    {link.quote_description}
                  </p>
                )}

                {amount != null && (
                  <div
                    style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                      gap: 12, marginTop: 20, paddingTop: 18, borderTop: '1px solid #2A3038',
                    }}
                  >
                    <span style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#9CA3AF', fontWeight: 700 }}>
                      {copy.total}
                    </span>
                    <span style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font-archivo), sans-serif' }}>
                      {money.format(amount)}
                    </span>
                  </div>
                )}

                <p style={{ fontSize: 12, color: '#6B7280', margin: '14px 0 0' }}>
                  {copy.validUntil} {dateFmt.format(new Date(link.expires_at))}
                </p>
              </div>

              {sendFailed && (
                <div
                  role="alert"
                  style={{ ...PANEL, padding: '16px 18px', marginBottom: 16, borderColor: 'rgba(239,68,68,0.5)' }}
                >
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{copy.failedTitle}</p>
                  <p style={{ margin: '6px 0 0', color: '#9CA3AF', fontSize: 13, lineHeight: 1.55 }}>{copy.failedBody}</p>
                </div>
              )}

              {/* Accepting is a commitment to a price and cannot be undone from
                  this page, so it takes two taps. The confirm restates the
                  amount: a thumb landing on a CTA in a chat app should not be
                  able to accept several thousand euros of work. */}
              {phase === 'ready' && (
                <div className="vb-fade vb-fade-3" style={{ display: 'grid', gap: 10 }}>
                  <button className="vb-cta" style={CTA} onClick={() => setPhase('confirming')}>
                    {copy.accept}
                  </button>
                  <button className="vb-ghost" style={GHOST} onClick={() => setPhase('declining')}>
                    {copy.decline}
                  </button>
                </div>
              )}

              {phase === 'confirming' && (
                <div className="vb-fade" style={{ display: 'grid', gap: 10 }}>
                  <button className="vb-cta" style={CTA} onClick={() => decide('accepted')}>
                    {amount != null ? `${copy.confirm} · ${money.format(amount)}` : copy.confirm}
                  </button>
                  <button className="vb-ghost" style={GHOST} onClick={() => setPhase('ready')}>
                    {copy.cancel}
                  </button>
                </div>
              )}

              {phase === 'declining' && (
                <div className="vb-fade" style={{ ...PANEL, display: 'grid', gap: 12 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{copy.declineTitle}</p>
                  <label style={{ fontSize: 12, color: '#9CA3AF', letterSpacing: 0.4 }}>
                    {copy.reasonLabel}
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={copy.reasonPlaceholder}
                      rows={3}
                      maxLength={2000}
                      style={{
                        display: 'block', width: '100%', marginTop: 8, resize: 'vertical',
                        background: '#0B0E11', color: '#fff', border: '1px solid #2A3038',
                        borderRadius: 10, padding: '11px 12px', fontSize: 15,
                        fontFamily: 'var(--font-inter), system-ui, sans-serif',
                      }}
                    />
                  </label>
                  <button className="vb-cta" style={{ ...CTA, background: '#7F1D1D', boxShadow: 'none' }} onClick={() => decide('rejected')}>
                    {copy.declineConfirm}
                  </button>
                  <button className="vb-ghost" style={GHOST} onClick={() => { setReason(''); setPhase('ready'); }}>
                    {copy.cancel}
                  </button>
                </div>
              )}

              {phase === 'sending' && (
                <button className="vb-cta" style={CTA} disabled>
                  {copy.sending}
                </button>
              )}

              {/* The app is now the SECONDARY path, not the only one. A
                  customer who happens to have Vasco gets the richer screen;
                  everyone else has already answered above. */}
              <div style={{ textAlign: 'center', marginTop: 26 }}>
                {isMobile && (
                  <a
                    href={deepLink}
                    style={{ color: '#9CA3AF', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    {copy.openApp}
                  </a>
                )}
                <p style={{ fontSize: 12, color: '#6B7280', margin: '18px auto 0', maxWidth: 360, lineHeight: 1.55 }}>
                  {copy.privacy}
                </p>
                {!isMobile && (
                  <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid rgba(42,48,56,0.6)' }}>
                    <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 12px', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>
                      {copy.noApp}
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <a href={STORE_IOS} className="vb-store" style={storeBtn}>App Store</a>
                      <a href={STORE_ANDROID} className="vb-store" style={storeBtn}>Google Play</a>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 11, color: '#4B5563', letterSpacing: 0.6, textAlign: 'center', padding: '28px 0 4px' }}>
                  {copy.footer}
                </p>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}

function Row({ label, value, hideLabel = false }: { label: string; value: string; hideLabel?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
      {!hideLabel && (
        <span style={{ fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: '#6B7280', fontWeight: 700 }}>
          {label}
        </span>
      )}
      <span style={{ fontSize: 15, color: '#D1D5DB', marginLeft: hideLabel ? 0 : 'auto' }}>{value}</span>
    </div>
  );
}

const storeBtn: React.CSSProperties = {
  border: '1px solid #2A3038', borderRadius: 12, padding: '10px 16px',
  color: '#D1D5DB', fontSize: 13, fontWeight: 600, textDecoration: 'none',
};
