// =============================================================================
// PAYMENT SUCCESS LANDING (R191)
// =============================================================================
// Served at https://admin.vascobuild.com/payment/success. Where Mollie sends
// customers after a successful payment via defaultPaymentSuccessUrl(). Pre-R191
// the redirect pointed at app.vascobuild.com (never deployed) → DNS error
// after every successful payment.
//
// This page is intentionally minimal: confirm the payment, route the customer
// back into Vasco (deep link or app stores), no auth.
// =============================================================================

'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

const STORE_IOS = 'https://apps.apple.com/app/id0000000000'; // TODO: real ID
const STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.vascobuild.app';

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
  en: { eyebrow: 'Payment received', title: 'Thank you', body: 'Your payment was received. A receipt has been sent to your contractor.', cta: 'Open Vasco', noApp: 'New to Vasco?', desktopHint: 'You can close this tab.' },
  nl: { eyebrow: 'Betaling ontvangen', title: 'Bedankt', body: 'Je betaling is ontvangen. Je aannemer krijgt een bevestiging.', cta: 'Open Vasco', noApp: 'Nieuw bij Vasco?', desktopHint: 'Je kunt deze tab sluiten.' },
  de: { eyebrow: 'Zahlung erhalten', title: 'Vielen Dank', body: 'Deine Zahlung ist eingegangen. Dein Handwerker erhält eine Bestätigung.', cta: 'Vasco öffnen', noApp: 'Neu bei Vasco?', desktopHint: 'Du kannst diesen Tab schließen.' },
  fr: { eyebrow: 'Paiement reçu', title: 'Merci', body: 'Votre paiement a été reçu. Votre artisan recevra une confirmation.', cta: 'Ouvrir Vasco', noApp: 'Nouveau sur Vasco ?', desktopHint: 'Vous pouvez fermer cet onglet.' },
  es: { eyebrow: 'Pago recibido', title: 'Gracias', body: 'Hemos recibido tu pago. Tu contratista recibirá una confirmación.', cta: 'Abrir Vasco', noApp: '¿Nuevo en Vasco?', desktopHint: 'Puedes cerrar esta pestaña.' },
  it: { eyebrow: 'Pagamento ricevuto', title: 'Grazie', body: 'Il pagamento è stato ricevuto. Il tuo contractor riceverà una conferma.', cta: 'Apri Vasco', noApp: 'Nuovo su Vasco?', desktopHint: 'Puoi chiudere questa scheda.' },
} as const;

export default function PaymentSuccessLanding() {
  const [isMobile, setIsMobile] = useState(false);
  const lang = useMemo(() => pickLanguage(), []);
  const copy = COPY[lang];

  useEffect(() => {
    setIsMobile(isMobileUA());
  }, []);

  const onOpen = () => {
    window.location.href = 'vasco://';
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0) 60%), radial-gradient(ellipse at top, #14181F 0%, #0B0E11 60%)',
        color: '#FFFFFF',
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '32px 24px',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 16px' }}>
        <Image src="/vasco-logo.png" alt="Vasco" width={28} height={28} priority style={{ borderRadius: 6 }} />
        <span style={{ fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 900, fontSize: 16, letterSpacing: 1.6, textTransform: 'uppercase' }}>
          Vasco
        </span>
      </header>

      <section style={{ maxWidth: 460, width: '100%', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            width: 96, height: 96, borderRadius: 48,
            background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
            margin: '0 auto 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 16px 40px rgba(34,197,94,0.42)',
          }}
          aria-hidden
        >
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <path d="m5 13 4 4L19 7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <p style={{ fontSize: 12, fontFamily: 'var(--font-archivo), sans-serif', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#22C55E', margin: '0 0 12px' }}>
          {copy.eyebrow}
        </p>

        <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 16px', letterSpacing: -1, fontFamily: 'var(--font-archivo), sans-serif', lineHeight: 1.1 }}>
          {copy.title}
        </h1>

        <p style={{ fontSize: 16, lineHeight: 1.55, color: '#9CA3AF', margin: '0 auto 32px', padding: '0 12px', maxWidth: 380 }}>
          {copy.body}
        </p>

        {isMobile ? (
          <button
            onClick={onOpen}
            style={{
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
              fontFamily: 'var(--font-archivo), sans-serif',
              textTransform: 'uppercase',
              minWidth: 240,
            }}
          >
            {copy.cta}
          </button>
        ) : (
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 24px' }}>{copy.desktopHint}</p>
        )}

        {isMobile && (
          <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid rgba(42,48,56,0.6)' }}>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 14px', letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>
              {copy.noApp}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={STORE_IOS} style={storeBtnStyle}>App Store</a>
              <a href={STORE_ANDROID} style={storeBtnStyle}>Google Play</a>
            </div>
          </div>
        )}
      </section>

      <footer style={{ fontSize: 11, color: '#4B5563', letterSpacing: 0.6, textAlign: 'center', padding: '24px 0 4px' }}>
        © Vasco · vascobuild.com
      </footer>
    </main>
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
};
