import React from 'react';
import { DK } from '../data/theme';
import { AppStoreShell, ScreenHeader, TabBar } from './appStoreShell';

export type AppStoreVatProps = {
  tagline: string;
  subTagline: string;
};

// App Store screenshot #5 — VAT-prep (NL BTW Q-end summary with rubriek breakdown).
export const AppStoreVat: React.FC<AppStoreVatProps> = ({ tagline, subTagline }) => {
  return (
    <AppStoreShell tagline={tagline} subTagline={subTagline}>
      <ScreenHeader title="BTW Q1 2026" subtitle="01 jan — 31 mrt" />

      {/* Safety banner */}
      <div
        style={{
          margin: '24px 60px 0 60px',
          backgroundColor: `${DK.highlight}20`,
          border: `1px solid ${DK.highlight}60`,
          borderRadius: 16,
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 24 }}>🛡️</div>
        <div style={{ color: DK.highlight, fontSize: 22, fontWeight: 600, lineHeight: 1.35 }}>
          Voorbereiding — Vasco dient niet zelf in. Controleer altijd zelf.
        </div>
      </div>

      {/* Big total */}
      <div
        style={{
          margin: '28px 60px 0 60px',
          background: `linear-gradient(135deg, ${DK.panel2} 0%, ${DK.panel} 100%)`,
          border: `1px solid ${DK.border}`,
          borderRadius: 24,
          padding: '32px 36px',
        }}
      >
        <div
          style={{
            color: DK.textMuted,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Te betalen aan Belastingdienst
        </div>
        <div
          style={{
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 900,
            fontSize: 76,
            color: DK.highlight,
            marginTop: 8,
            letterSpacing: -1,
            textShadow: `0 0 32px ${DK.highlight}55`,
          }}
        >
          €3.847,20
        </div>
        <div style={{ color: DK.textMuted, fontSize: 22, marginTop: 4 }}>
          Aangifte verwacht: 30 apr 2026
        </div>
      </div>

      {/* Rubriek breakdown */}
      <div style={{ paddingLeft: 60, paddingRight: 60, marginTop: 32 }}>
        <div
          style={{
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 800,
            fontSize: 26,
            color: DK.textMuted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 18,
          }}
        >
          Rubriek-overzicht
        </div>
        <Rubriek code="1a" label="Leveringen 21%" amount="€18.420,00" vat="€3.868,20" />
        <Rubriek code="1b" label="Leveringen 9%" amount="€420,00" vat="€37,80" />
        <Rubriek code="5b" label="Voorbelasting" amount="—" vat="−€58,80" negative />
      </div>

      {/* CTA bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 230,
          left: 60,
          right: 60,
          backgroundColor: DK.panel2,
          border: `1px solid ${DK.border}`,
          borderRadius: 20,
          padding: '22px 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              color: DK.text,
              fontFamily: 'Archivo, sans-serif',
              fontWeight: 800,
              fontSize: 26,
            }}
          >
            Export naar Moneybird
          </div>
          <div style={{ color: DK.textMuted, fontSize: 20, marginTop: 4 }}>
            of DATEV · Pennylane · 19 andere
          </div>
        </div>
        <div
          style={{
            paddingLeft: 22,
            paddingRight: 22,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 12,
            backgroundColor: DK.accent,
            color: DK.text,
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: 0.8,
          }}
        >
          EXPORT →
        </div>
      </div>

      <TabBar active="Geld" />
    </AppStoreShell>
  );
};

const Rubriek: React.FC<{
  code: string;
  label: string;
  amount: string;
  vat: string;
  negative?: boolean;
}> = ({ code, label, amount, vat, negative }) => (
  <div
    style={{
      backgroundColor: DK.panel,
      borderRadius: 14,
      border: `1px solid ${DK.border}`,
      padding: '18px 22px',
      marginBottom: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          backgroundColor: DK.bg,
          border: `1px solid ${DK.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: DK.accent,
          fontFamily: 'Archivo, sans-serif',
          fontWeight: 900,
          fontSize: 24,
        }}
      >
        {code}
      </div>
      <div>
        <div style={{ color: DK.text, fontWeight: 700, fontSize: 24 }}>{label}</div>
        <div style={{ color: DK.textMuted, fontSize: 20, marginTop: 2 }}>{amount}</div>
      </div>
    </div>
    <div
      style={{
        fontFamily: 'Archivo, sans-serif',
        fontWeight: 800,
        fontSize: 28,
        color: negative ? DK.success : DK.text,
      }}
    >
      {vat}
    </div>
  </div>
);
