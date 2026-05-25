// =============================================================================
// QUOTE ACCEPTANCE LANDING (R190)
// =============================================================================
// Served at https://admin.vascobuild.com/accept/{TOKEN}. Fallback landing for
// customers tapping a one-tap acceptance link from their contractor.
//
// Same flow shape as /customer/[code] — universal-link first, web fallback
// otherwise. The 32-hex token is opaque to the customer; we display only the
// reassuring "your contractor sent you a quote" framing.
//
// app/accept/[token].tsx (mobile) calls customerQuoteAcceptanceService to
// resolve the token → quote details → in-app review/accept flow.
// =============================================================================

'use client';

import Image from 'next/image';
import { use, useEffect, useMemo, useState } from 'react';

// R191 TODO: see admin/src/app/auth/callback/page.tsx — same placeholder
// Apple ID. Replace once App Store Connect listing exists.
const STORE_IOS = 'https://apps.apple.com/app/id0000000000';
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.vascobuild.app';

type Status = 'opening' | 'ready';

interface PageProps {
  params: Promise<{ token: string }>;
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
  en: { eyebrow: 'Quote ready', title: 'Review and accept your quote', body: 'Your contractor sent you a quote to approve. Open Vasco to see the breakdown and accept in one tap.', cta: 'Open quote', helper: "App didn't open? Tap the button to try again.", desktopHint: 'You’re on a computer. Open this link on your phone, or download Vasco below.', noApp: 'New to Vasco?', privacy: 'Secure link from your contractor. No account needed.', footer: '© Vasco · vascobuild.com' },
  nl: { eyebrow: 'Offerte klaar', title: 'Bekijk en accepteer je offerte', body: 'Je aannemer heeft een offerte voor je. Open Vasco om de details te zien en met één tik te accepteren.', cta: 'Open offerte', helper: 'Niet geopend? Tik op de knop om het opnieuw te proberen.', desktopHint: 'Je gebruikt een computer. Open deze link op je telefoon of download Vasco hieronder.', noApp: 'Nieuw bij Vasco?', privacy: 'Veilige link van je aannemer. Geen account nodig.', footer: '© Vasco · vascobuild.com' },
  de: { eyebrow: 'Angebot bereit', title: 'Angebot prüfen und annehmen', body: 'Dein Handwerker hat dir ein Angebot geschickt. Öffne Vasco, um die Details zu sehen und mit einem Tap anzunehmen.', cta: 'Angebot öffnen', helper: 'Nicht geöffnet? Tippe auf den Button.', desktopHint: 'Du bist am Computer. Öffne diesen Link auf dem Handy oder lade Vasco unten herunter.', noApp: 'Neu bei Vasco?', privacy: 'Sicherer Link von deinem Handwerker. Kein Konto erforderlich.', footer: '© Vasco · vascobuild.com' },
  fr: { eyebrow: 'Devis prêt', title: 'Examiner et accepter votre devis', body: "Votre artisan vous a envoyé un devis. Ouvrez Vasco pour voir les détails et accepter en un tap.", cta: 'Ouvrir le devis', helper: "L'app ne s'est pas ouverte ? Appuyez sur le bouton.", desktopHint: 'Vous êtes sur un ordinateur. Ouvrez ce lien sur votre téléphone ou téléchargez Vasco ci-dessous.', noApp: 'Nouveau sur Vasco ?', privacy: 'Lien sécurisé de votre artisan. Aucun compte nécessaire.', footer: '© Vasco · vascobuild.com' },
  es: { eyebrow: 'Presupuesto listo', title: 'Revisa y acepta tu presupuesto', body: 'Tu contratista te envió un presupuesto. Abre Vasco para ver los detalles y aceptar con un toque.', cta: 'Abrir presupuesto', helper: '¿No se abrió? Toca el botón.', desktopHint: 'Estás en una computadora. Abre este enlace en tu teléfono o descarga Vasco abajo.', noApp: '¿Nuevo en Vasco?', privacy: 'Enlace seguro de tu contratista. No se necesita cuenta.', footer: '© Vasco · vascobuild.com' },
  it: { eyebrow: 'Preventivo pronto', title: 'Esamina e accetta il tuo preventivo', body: 'Il tuo contractor ti ha inviato un preventivo. Apri Vasco per vedere i dettagli e accettare con un tocco.', cta: 'Apri preventivo', helper: 'Non si è aperta? Tocca il pulsante.', desktopHint: 'Sei su un computer. Apri questo link dal telefono o scarica Vasco qui sotto.', noApp: 'Nuovo su Vasco?', privacy: 'Link sicuro dal tuo contractor. Nessun account necessario.', footer: '© Vasco · vascobuild.com' },
} as const;

export default function QuoteAcceptanceLanding({ params }: PageProps) {
  const { token: rawToken } = use(params);
  const token = (rawToken || '').trim();

  const [status, setStatus] = useState<Status>('ready');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const lang = useMemo(() => pickLanguage(), []);
  const copy = COPY[lang];

  // We forward the raw token in the deep-link path so the in-app handler at
  // app/accept/[token].tsx receives it unchanged. URL-encode just in case
  // the source ever uses chars outside [0-9a-f].
  const deepLink = `vasco://accept/${encodeURIComponent(token)}`;

  useEffect(() => {
    const mobile = isMobileUA();
    setIsMobile(mobile);

    if (mobile) {
      setStatus('opening');
      const timer = setTimeout(() => {
        window.location.href = deepLink;
        setTimeout(() => setStatus('ready'), 1500);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [deepLink]);

  const onOpen = () => { window.location.href = deepLink; };

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes glow { 0%, 100% { box-shadow: 0 16px 40px rgba(249,115,22,0.42); } 50% { box-shadow: 0 16px 40px rgba(249,115,22,0.55); } }
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
        <header className="vb-fade vb-fade-1" style={{ width: '100%', maxWidth: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '4px 0 16px' }}>
          <Image src="/vasco-logo.png" alt="Vasco" width={28} height={28} priority style={{ borderRadius: 6 }} />
          <span style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: 1.6, textTransform: 'uppercase' }}>
            Vasco
          </span>
        </header>

        <section style={{ maxWidth: 460, width: '100%', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 0' }}>
          <div className="vb-fade vb-fade-2" style={{ marginBottom: 28 }}>
            <div
              className="vb-glow"
              style={{
                width: 96, height: 96, borderRadius: 28,
                background: 'linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)',
                margin: '0 auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 16px 40px rgba(249,115,22,0.42)',
              }}
              aria-hidden
            >
              {status === 'opening' ? (
                <div className="vb-spin" style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%' }} />
              ) : (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                  <path d="m5 13 4 4L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>

          <p
            className="vb-fade vb-fade-3"
            style={{ fontSize: 12, fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#F59E0B', margin: '0 0 12px' }}
          >
            {copy.eyebrow}
          </p>

          <h1
            className="vb-fade vb-fade-3"
            style={{ fontSize: 30, fontWeight: 900, margin: '0 0 16px', letterSpacing: -0.8, fontFamily: 'var(--font-archivo), var(--font-inter), system-ui, sans-serif', lineHeight: 1.15 }}
          >
            {copy.title}
          </h1>

          <p
            className="vb-fade vb-fade-4"
            style={{ fontSize: 16, lineHeight: 1.55, color: '#9CA3AF', margin: '0 auto 32px', padding: '0 12px', maxWidth: 380 }}
          >
            {status === 'opening' ? `${copy.cta}…` : copy.body}
          </p>

          <div className="vb-fade vb-fade-4">
            <button
              onClick={onOpen}
              className="vb-cta"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)',
                color: '#fff', border: 'none', borderRadius: 16,
                padding: '16px 32px', fontSize: 15, fontWeight: 800, letterSpacing: 0.8,
                cursor: 'pointer',
                boxShadow: '0 12px 32px rgba(249,115,22,0.5)',
                fontFamily: 'var(--font-archivo), var(--font-inter), sans-serif',
                textTransform: 'uppercase', minWidth: 240,
                transition: 'transform 0.15s ease, filter 0.15s ease',
              }}
            >
              {copy.cta}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 5l7 7-7 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {status === 'opening' && (
              <p style={{ fontSize: 12, color: '#6B7280', margin: '14px 0 0' }}>{copy.helper}</p>
            )}
          </div>

          <p style={{ fontSize: 12, color: '#6B7280', margin: '24px auto 0', maxWidth: 360, lineHeight: 1.55, padding: '0 16px' }}>
            {copy.privacy}
          </p>

          {status === 'ready' && (
            <div
              className="vb-fade vb-fade-4"
              style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid rgba(42,48,56,0.6)' }}
            >
              {!isMobile && (
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 20px', lineHeight: 1.55, padding: '0 12px' }}>
                  {copy.desktopHint}
                </p>
              )}
              <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 14px', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>
                {copy.noApp}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href={STORE_IOS} className="vb-store" style={storeBtnStyle}>App Store</a>
                <a href={STORE_ANDROID} className="vb-store" style={storeBtnStyle}>Google Play</a>
              </div>
            </div>
          )}
        </section>

        <footer
          className="vb-fade vb-fade-4"
          style={{ fontSize: 11, color: '#4B5563', letterSpacing: 0.6, textAlign: 'center', padding: '24px 0 4px' }}
        >
          {copy.footer}
        </footer>
      </main>
    </>
  );
}

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
