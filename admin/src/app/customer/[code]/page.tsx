// =============================================================================
// CUSTOMER PORTAL LANDING (R190)
// =============================================================================
// Served at https://admin.vascobuild.com/customer/{CODE}. Fallback landing
// for customers tapping a portal link from their contractor.
//
// • Mobile + Vasco installed + AASA verified → OS opens the app DIRECTLY at
//   app/customer/[code].tsx (this page never renders).
// • Mobile + Vasco NOT installed → renders here, attempts vasco://customer/CODE
//   deep link, falls back to App Store / Play Store badges.
// • Desktop → renders here with explanatory copy ("open this on your phone").
//
// No auth. The access code IS the bearer credential, same as the mobile flow.
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
  params: Promise<{ code: string }>;
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

function normalizeCode(raw: string): string {
  return (raw || '').trim().toUpperCase().slice(0, 12);
}

const COPY = {
  en: { eyebrow: 'Quote review', title: 'Your contractor sent you a quote', body: 'Open Vasco to review the options, pick what you want, and approve in a few taps.', cta: 'Open Vasco', helper: "App didn't open? Tap the button to try again.", desktopHint: 'You’re on a computer. Open this link on your phone, or download Vasco below.', noApp: 'New to Vasco?', code: 'Access code', privacy: 'No account needed. Your choices go straight to your contractor.', footer: '© Vasco · vascobuild.com' },
  nl: { eyebrow: 'Offerte beoordelen', title: 'Je aannemer heeft een offerte voor je', body: 'Open Vasco om de keuzes te bekijken en met een paar tikken goed te keuren.', cta: 'Open Vasco', helper: 'Niet geopend? Tik op de knop om het opnieuw te proberen.', desktopHint: 'Je gebruikt een computer. Open deze link op je telefoon of download Vasco hieronder.', noApp: 'Nieuw bij Vasco?', code: 'Toegangscode', privacy: 'Geen account nodig. Je keuzes gaan direct naar je aannemer.', footer: '© Vasco · vascobuild.com' },
  de: { eyebrow: 'Angebot prüfen', title: 'Dein Handwerker hat dir ein Angebot geschickt', body: 'Öffne Vasco, um die Optionen zu prüfen und mit wenigen Taps freizugeben.', cta: 'Vasco öffnen', helper: 'Nicht geöffnet? Tippe auf den Button.', desktopHint: 'Du bist am Computer. Öffne diesen Link auf dem Handy oder lade Vasco unten herunter.', noApp: 'Neu bei Vasco?', code: 'Zugangscode', privacy: 'Kein Konto erforderlich. Deine Auswahl geht direkt an deinen Handwerker.', footer: '© Vasco · vascobuild.com' },
  fr: { eyebrow: 'Examen du devis', title: 'Votre artisan vous a envoyé un devis', body: "Ouvrez Vasco pour examiner les options et approuver en quelques tapotements.", cta: 'Ouvrir Vasco', helper: "L'app ne s'est pas ouverte ? Appuyez sur le bouton.", desktopHint: 'Vous êtes sur un ordinateur. Ouvrez ce lien sur votre téléphone ou téléchargez Vasco ci-dessous.', noApp: 'Nouveau sur Vasco ?', code: "Code d'accès", privacy: "Aucun compte nécessaire. Vos choix vont directement à votre artisan.", footer: '© Vasco · vascobuild.com' },
  es: { eyebrow: 'Revisión del presupuesto', title: 'Tu contratista te envió un presupuesto', body: 'Abre Vasco para revisar las opciones y aprobar en unos toques.', cta: 'Abrir Vasco', helper: '¿No se abrió? Toca el botón.', desktopHint: 'Estás en una computadora. Abre este enlace en tu teléfono o descarga Vasco abajo.', noApp: '¿Nuevo en Vasco?', code: 'Código de acceso', privacy: 'No se necesita cuenta. Tus elecciones van directo a tu contratista.', footer: '© Vasco · vascobuild.com' },
  it: { eyebrow: 'Revisione preventivo', title: 'Il tuo contractor ti ha inviato un preventivo', body: 'Apri Vasco per esaminare le opzioni e approvare in pochi tocchi.', cta: 'Apri Vasco', helper: 'Non si è aperta? Tocca il pulsante.', desktopHint: 'Sei su un computer. Apri questo link dal telefono o scarica Vasco qui sotto.', noApp: 'Nuovo su Vasco?', code: 'Codice di accesso', privacy: 'Nessun account necessario. Le tue scelte vanno direttamente al tuo contractor.', footer: '© Vasco · vascobuild.com' },
} as const;

export default function CustomerPortalLanding({ params }: PageProps) {
  const { code: rawCode } = use(params);
  const code = normalizeCode(rawCode);

  const [status, setStatus] = useState<Status>('ready');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const lang = useMemo(() => pickLanguage(), []);
  const copy = COPY[lang];

  const deepLink = `vasco://customer/${encodeURIComponent(code)}`;

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

  const onOpen = () => {
    window.location.href = deepLink;
  };

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
                width: 96,
                height: 96,
                borderRadius: 28,
                background: 'linear-gradient(135deg, #9A3412 0%, #C2410C 50%, #F97316 100%)',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 16px 40px rgba(249,115,22,0.42)',
              }}
              aria-hidden
            >
              {status === 'opening' ? (
                <div className="vb-spin" style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%' }} />
              ) : (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12h6m-6 4h6M9 8h6m-9 12V6a2 2 0 0 1 2-2h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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
            style={{ fontSize: 16, lineHeight: 1.55, color: '#9CA3AF', margin: '0 auto 24px', padding: '0 12px', maxWidth: 380 }}
          >
            {status === 'opening' ? `${copy.cta}…` : copy.body}
          </p>

          {/* Access-code badge so user can verify the right link */}
          <div
            className="vb-fade vb-fade-4"
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 24px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 12,
              alignSelf: 'center',
              margin: '0 auto 28px',
            }}
          >
            <span style={{ fontSize: 10, color: '#F59E0B', letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: 700 }}>
              {copy.code}
            </span>
            <span style={{ fontFamily: 'var(--font-archivo), monospace', fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: 4 }}>
              {code}
            </span>
          </div>

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
              {copy.cta}
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
