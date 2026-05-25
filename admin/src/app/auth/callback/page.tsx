// =============================================================================
// AUTH CALLBACK LANDING (R189)
// =============================================================================
// Served at https://admin.vascobuild.com/auth/callback. This is the FALLBACK
// landing — on a device with Vasco installed and AASA/assetlinks verified,
// the OS opens the app DIRECTLY at app/auth/callback.tsx and this page never
// renders. We get traffic here only when:
//   • Desktop browser (Gmail-on-laptop tap)
//   • Mobile device without the app installed
//   • iOS where AASA hasn't propagated yet after install
//   • Email client that strips universal-link routing
// =============================================================================

'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

// R191 TODO: replace `id0000000000` with the real Apple ID once the app is
// approved. Find it at App Store Connect → My Apps → Vasco → App Information →
// "Apple ID" (10-digit number). Until then the "App Store" badge below leads
// to a 404. Android package name is already correct.
const STORE_IOS = 'https://apps.apple.com/app/id0000000000';
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.vascobuild.app';

type Status = 'detecting' | 'opening' | 'ready' | 'error';
type FlowType = 'signup' | 'recovery' | 'magiclink' | 'unknown';

interface HashParams {
  access_token?: string;
  refresh_token?: string;
  type?: string;
  error_description?: string;
}

function parseHash(): HashParams {
  if (typeof window === 'undefined') return {};
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return {};
  const out: HashParams = {};
  for (const piece of raw.split('&')) {
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    const key = decodeURIComponent(piece.slice(0, eq));
    const value = decodeURIComponent(piece.slice(eq + 1));
    if (key === 'access_token' || key === 'refresh_token' || key === 'type' || key === 'error_description') {
      out[key as keyof HashParams] = value;
    }
  }
  return out;
}

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function pickLanguage(): 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it' {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('nl')) return 'nl';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('it')) return 'it';
  return 'en';
}

const COPY = {
  en: {
    signup: { eyebrow: 'Welcome to Vasco', title: "You're in", body: 'Your email has been verified. Continue in the Vasco app to set up your business.', cta: 'Continue in app' },
    recovery: { eyebrow: 'Password reset', title: 'Almost there', body: 'Open the Vasco app to choose a new password and get back to work.', cta: 'Continue in app' },
    magiclink: { eyebrow: 'Signed in', title: "You're signed in", body: 'Open the Vasco app to pick up where you left off.', cta: 'Continue in app' },
    unknown: { eyebrow: 'Open Vasco', title: 'Continue in the app', body: 'Tap below to continue in Vasco.', cta: 'Continue in app' },
    opening: 'Opening Vasco…',
    helper: "App didn't open? Tap the button to try again.",
    noApp: 'New to Vasco? Get the app',
    error: { eyebrow: 'Something went wrong', title: 'This link is no longer valid', body: 'The link has expired or was already used. Open the app and request a new one — it only takes a second.' },
    desktopHint: 'You’re on a computer. Open this email on your phone, or download Vasco below to continue.',
    footer: '© Vasco · vascobuild.com',
  },
  nl: {
    signup: { eyebrow: 'Welkom bij Vasco', title: 'Je bent erbij', body: 'Je e-mail is bevestigd. Ga verder in de Vasco-app om je bedrijf in te richten.', cta: 'Verder in de app' },
    recovery: { eyebrow: 'Wachtwoord herstellen', title: 'Bijna klaar', body: 'Open de Vasco-app om een nieuw wachtwoord in te stellen.', cta: 'Verder in de app' },
    magiclink: { eyebrow: 'Ingelogd', title: 'Je bent ingelogd', body: 'Open de Vasco-app om verder te gaan waar je gebleven was.', cta: 'Verder in de app' },
    unknown: { eyebrow: 'Open Vasco', title: 'Verder in de app', body: 'Tik hieronder om verder te gaan in Vasco.', cta: 'Verder in de app' },
    opening: 'Vasco openen…',
    helper: 'Niet geopend? Tik op de knop om het opnieuw te proberen.',
    noApp: 'Nieuw bij Vasco? Download de app',
    error: { eyebrow: 'Er ging iets mis', title: 'Deze link werkt niet meer', body: 'De link is verlopen of al gebruikt. Open de app en vraag een nieuwe aan — dat duurt maar een seconde.' },
    desktopHint: 'Je gebruikt een computer. Open deze e-mail op je telefoon of download Vasco hieronder.',
    footer: '© Vasco · vascobuild.com',
  },
  de: {
    signup: { eyebrow: 'Willkommen bei Vasco', title: 'Du bist dabei', body: 'Deine E-Mail wurde bestätigt. Öffne die Vasco-App, um dein Unternehmen einzurichten.', cta: 'In der App fortfahren' },
    recovery: { eyebrow: 'Passwort zurücksetzen', title: 'Fast geschafft', body: 'Öffne die Vasco-App, um ein neues Passwort zu wählen.', cta: 'In der App fortfahren' },
    magiclink: { eyebrow: 'Angemeldet', title: 'Du bist angemeldet', body: 'Öffne die Vasco-App, um dort weiterzumachen, wo du aufgehört hast.', cta: 'In der App fortfahren' },
    unknown: { eyebrow: 'Vasco öffnen', title: 'In der App fortfahren', body: 'Tippe unten, um in Vasco fortzufahren.', cta: 'In der App fortfahren' },
    opening: 'Vasco wird geöffnet…',
    helper: 'App nicht geöffnet? Tippe auf den Button.',
    noApp: 'Neu bei Vasco? Hol dir die App',
    error: { eyebrow: 'Etwas ist schiefgelaufen', title: 'Dieser Link ist nicht mehr gültig', body: 'Der Link ist abgelaufen oder wurde bereits verwendet. Öffne die App und fordere einen neuen an.' },
    desktopHint: 'Du bist am Computer. Öffne diese E-Mail auf deinem Handy oder lade Vasco unten herunter.',
    footer: '© Vasco · vascobuild.com',
  },
  fr: {
    signup: { eyebrow: 'Bienvenue chez Vasco', title: "C'est confirmé", body: 'Votre e-mail est vérifié. Ouvrez l’app Vasco pour configurer votre entreprise.', cta: "Continuer dans l'app" },
    recovery: { eyebrow: 'Réinitialisation', title: 'Presque terminé', body: 'Ouvrez l’app Vasco pour choisir un nouveau mot de passe.', cta: "Continuer dans l'app" },
    magiclink: { eyebrow: 'Connecté', title: 'Vous êtes connecté', body: 'Ouvrez l’app Vasco pour reprendre où vous en étiez.', cta: "Continuer dans l'app" },
    unknown: { eyebrow: 'Ouvrir Vasco', title: "Continuer dans l'app", body: 'Appuyez ci-dessous pour continuer dans Vasco.', cta: "Continuer dans l'app" },
    opening: 'Ouverture de Vasco…',
    helper: "L'app ne s'est pas ouverte ? Appuyez sur le bouton.",
    noApp: 'Nouveau sur Vasco ? Téléchargez l’app',
    error: { eyebrow: 'Une erreur est survenue', title: "Ce lien n'est plus valide", body: 'Le lien a expiré ou a déjà été utilisé. Ouvrez l’app et demandez-en un nouveau.' },
    desktopHint: 'Vous êtes sur un ordinateur. Ouvrez cet e-mail sur votre téléphone ou téléchargez Vasco ci-dessous.',
    footer: '© Vasco · vascobuild.com',
  },
  es: {
    signup: { eyebrow: 'Bienvenido a Vasco', title: 'Ya estás', body: 'Tu correo está verificado. Abre la app Vasco para configurar tu negocio.', cta: 'Continuar en la app' },
    recovery: { eyebrow: 'Restablecer contraseña', title: 'Casi listo', body: 'Abre la app Vasco para elegir una nueva contraseña.', cta: 'Continuar en la app' },
    magiclink: { eyebrow: 'Sesión iniciada', title: 'Has iniciado sesión', body: 'Abre la app Vasco para continuar donde lo dejaste.', cta: 'Continuar en la app' },
    unknown: { eyebrow: 'Abrir Vasco', title: 'Continuar en la app', body: 'Toca abajo para continuar en Vasco.', cta: 'Continuar en la app' },
    opening: 'Abriendo Vasco…',
    helper: '¿No se abrió? Toca el botón.',
    noApp: '¿Nuevo en Vasco? Descarga la app',
    error: { eyebrow: 'Algo salió mal', title: 'Este enlace ya no es válido', body: 'El enlace caducó o ya se usó. Abre la app y solicita uno nuevo.' },
    desktopHint: 'Estás en una computadora. Abre este correo en tu teléfono o descarga Vasco abajo.',
    footer: '© Vasco · vascobuild.com',
  },
  it: {
    signup: { eyebrow: 'Benvenuto su Vasco', title: 'Ci sei', body: 'La tua email è verificata. Apri l’app Vasco per impostare la tua attività.', cta: "Continua nell'app" },
    recovery: { eyebrow: 'Reimposta password', title: 'Quasi fatto', body: 'Apri l’app Vasco per scegliere una nuova password.', cta: "Continua nell'app" },
    magiclink: { eyebrow: 'Accesso eseguito', title: 'Sei autenticato', body: 'Apri l’app Vasco per riprendere da dove avevi lasciato.', cta: "Continua nell'app" },
    unknown: { eyebrow: 'Apri Vasco', title: "Continua nell'app", body: 'Tocca sotto per continuare in Vasco.', cta: "Continua nell'app" },
    opening: 'Apertura di Vasco…',
    helper: 'Non si è aperta? Tocca il pulsante.',
    noApp: 'Nuovo su Vasco? Scarica l’app',
    error: { eyebrow: 'Qualcosa è andato storto', title: 'Questo link non è più valido', body: 'Il link è scaduto o è già stato usato. Apri l’app e richiedine uno nuovo.' },
    desktopHint: 'Sei su un computer. Apri questa email dal telefono o scarica Vasco qui sotto.',
    footer: '© Vasco · vascobuild.com',
  },
} as const;

export default function AuthCallbackLanding() {
  const [status, setStatus] = useState<Status>('detecting');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [flowType, setFlowType] = useState<FlowType>('unknown');
  const [deepLink, setDeepLink] = useState<string>('');
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const lang = useMemo(() => pickLanguage(), []);
  const copy = COPY[lang];

  useEffect(() => {
    const params = parseHash();
    setIsMobile(isMobileUA());

    if (params.error_description) {
      setStatus('error');
      setErrorMsg(params.error_description);
      return;
    }

    const t = (params.type ?? '').toLowerCase();
    if (t === 'signup' || t === 'email_change') setFlowType('signup');
    else if (t === 'recovery') setFlowType('recovery');
    else if (t === 'magiclink') setFlowType('magiclink');
    else setFlowType('unknown');

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const link = `vasco://auth/callback${hash}`;
    setDeepLink(link);

    if (isMobileUA()) {
      setStatus('opening');
      const timer = setTimeout(() => {
        window.location.href = link;
        setTimeout(() => setStatus('ready'), 1500);
      }, 700);
      return () => clearTimeout(timer);
    }

    setStatus('ready');
  }, []);

  const onOpen = () => {
    if (!deepLink) return;
    window.location.href = deepLink;
  };

  const card = flowType === 'unknown' ? copy.signup : copy[flowType];
  const isError = status === 'error';
  const showCta = !isError && deepLink && (status === 'ready' || status === 'opening');

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes glow { 0%, 100% { box-shadow: 0 16px 40px rgba(249,115,22,0.42), 0 0 0 0 rgba(249,115,22,0.0); } 50% { box-shadow: 0 16px 40px rgba(249,115,22,0.55), 0 0 0 8px rgba(249,115,22,0.08); } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .vb-fade { animation: fadeUp 0.5s ease both; }
        .vb-fade-1 { animation-delay: 0.05s }
        .vb-fade-2 { animation-delay: 0.15s }
        .vb-fade-3 { animation-delay: 0.25s }
        .vb-fade-4 { animation-delay: 0.35s }
        .vb-glow { animation: glow 2.4s ease-in-out infinite; }
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
          justifyContent: 'space-between',
          padding: '32px 24px',
        }}
      >
        {/* Top brand strip */}
        <header className="vb-fade vb-fade-1" style={{ width: '100%', maxWidth: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0 16px' }}>
          <Image
            src="/vasco-logo.png"
            alt="Vasco"
            width={28}
            height={28}
            priority
            style={{ borderRadius: 6 }}
          />
          <span
            style={{
              fontFamily: 'var(--font-archivo), sans-serif',
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: '#FFFFFF',
            }}
          >
            Vasco
          </span>
        </header>

        {/* Card */}
        <section style={{ maxWidth: 460, width: '100%', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 0' }}>
          {/* Hero mark */}
          <div className="vb-fade vb-fade-2" style={{ marginBottom: 28 }}>
            <div
              className={isError ? '' : 'vb-glow'}
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                background: isError
                  ? 'linear-gradient(135deg, #7F1D1D, #991B1B)'
                  : 'linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isError ? '0 8px 24px rgba(127,29,29,0.4)' : '0 16px 40px rgba(249,115,22,0.42)',
                position: 'relative',
              }}
              aria-hidden
            >
              {status === 'opening' ? (
                <div
                  className="vb-spin"
                  style={{
                    width: 36,
                    height: 36,
                    border: '3px solid rgba(255,255,255,0.25)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                  }}
                />
              ) : (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {isError ? (
                    <path d="M12 8v5m0 3v.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M5 12.5l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              )}
            </div>
          </div>

          {/* Eyebrow */}
          <p
            className="vb-fade vb-fade-3"
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-archivo), sans-serif',
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#F59E0B',
              margin: '0 0 12px',
            }}
          >
            {isError ? copy.error.eyebrow : card.eyebrow}
          </p>

          {/* Title */}
          <h1
            className="vb-fade vb-fade-3"
            style={{
              fontSize: 36,
              fontWeight: 900,
              margin: '0 0 16px',
              letterSpacing: -1,
              fontFamily: 'var(--font-archivo), var(--font-inter), system-ui, sans-serif',
              lineHeight: 1.1,
            }}
          >
            {isError ? copy.error.title : card.title}
          </h1>

          {/* Body */}
          <p
            className="vb-fade vb-fade-4"
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: '#9CA3AF',
              margin: '0 auto 32px',
              padding: '0 12px',
              maxWidth: 380,
            }}
          >
            {isError
              ? (errorMsg || copy.error.body)
              : status === 'opening'
                ? copy.opening
                : card.body}
          </p>

          {/* Primary CTA */}
          {showCta && (
            <div className="vb-fade vb-fade-4">
              <button
                onClick={onOpen}
                className="vb-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  background: 'linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 16,
                  padding: '16px 32px',
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  cursor: 'pointer',
                  boxShadow: '0 12px 32px rgba(249,115,22,0.5)',
                  fontFamily: 'var(--font-archivo), var(--font-inter), sans-serif',
                  textTransform: 'uppercase',
                  minWidth: 240,
                  transition: 'transform 0.15s ease, filter 0.15s ease',
                }}
              >
                {card.cta}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {status === 'opening' && (
                <p style={{ fontSize: 12, color: '#6B7280', margin: '14px 0 0' }}>
                  {copy.helper}
                </p>
              )}
            </div>
          )}

          {/* Secondary block — desktop hint + store badges */}
          {status === 'ready' && !isError && (
            <div
              className="vb-fade vb-fade-4"
              style={{
                marginTop: 40,
                paddingTop: 28,
                borderTop: '1px solid rgba(42,48,56,0.6)',
              }}
            >
              {!isMobile && (
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px', lineHeight: 1.55, padding: '0 12px' }}>
                  {copy.desktopHint}
                </p>
              )}
              <p
                style={{
                  fontSize: 11,
                  color: '#6B7280',
                  margin: '0 0 14px',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {copy.noApp}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  href={STORE_IOS}
                  className="vb-store"
                  style={{
                    color: '#F97316',
                    textDecoration: 'none',
                    border: '1px solid rgba(249,115,22,0.35)',
                    borderRadius: 12,
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    fontFamily: 'var(--font-archivo), sans-serif',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                    <path d="M11.6 8.4c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.8 1.1 1.7 2.3 2.9 2.2 1.2-.1 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.3 0 2-1.1 2.8-2.1.9-1.2 1.2-2.4 1.3-2.4-.1-.1-2.5-1-2.6-3.8ZM9.5 1.9c.6-.7 1.1-1.8 1-2.9-.9 0-2 .6-2.7 1.4-.6.6-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.2Z" />
                  </svg>
                  App Store
                </a>
                <a
                  href={STORE_ANDROID}
                  className="vb-store"
                  style={{
                    color: '#F97316',
                    textDecoration: 'none',
                    border: '1px solid rgba(249,115,22,0.35)',
                    borderRadius: 12,
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    fontFamily: 'var(--font-archivo), sans-serif',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                    <path d="M.5 1.2 7.7 8 .5 14.8c-.3-.2-.5-.6-.5-1V2.2c0-.4.2-.8.5-1ZM8.7 9l2-1.9 2.4-1.4c.5-.3.5-1 0-1.3L8.7 1.7 6.2 4.1 8.7 6.5v2.5ZM8.7 9 6.2 11.4l5.4 5.1 1.5-.8c.5-.3.5-1 0-1.3l-2.4-1.4-2-1.9 4.6-1.7Z" />
                  </svg>
                  Google Play
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer
          className="vb-fade vb-fade-4"
          style={{
            fontSize: 11,
            color: '#4B5563',
            letterSpacing: 0.6,
            textAlign: 'center',
            padding: '24px 0 4px',
          }}
        >
          {copy.footer}
        </footer>
      </main>
    </>
  );
}
