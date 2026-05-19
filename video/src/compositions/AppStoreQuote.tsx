import React from 'react';
import { DK } from '../data/theme';
import { AppStoreShell, ScreenHeader, TabBar } from './appStoreShell';

export type AppStoreQuoteProps = {
  tagline: string;
  subTagline: string;
};

// App Store screenshot #2 — Tiered Quote Builder preview.
// Good / Better / Best cards with cohort badge.
export const AppStoreQuote: React.FC<AppStoreQuoteProps> = ({ tagline, subTagline }) => {
  return (
    <AppStoreShell tagline={tagline} subTagline={subTagline}>
      <ScreenHeader title="Offerte" subtitle="Stap 3 — Voorbeeld" />

      {/* Cohort badge */}
      <div style={{ margin: '32px 60px 0 60px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderRadius: 999,
            backgroundColor: `${DK.accent}25`,
            border: `1px solid ${DK.accent}60`,
          }}
        >
          <div style={{ fontSize: 22 }}>📊</div>
          <div style={{ color: DK.accent, fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>
            Vergelijkbare loodgieters in NL: 67% accepteert "Beter"
          </div>
        </div>
      </div>

      {/* Three tier cards */}
      <div style={{ marginTop: 32, paddingLeft: 60, paddingRight: 60 }}>
        <TierCard
          label="GOED"
          price="€485"
          subtitle="Reparatie nu — geen garantie op oud leidingwerk"
          features={['Lekkage stoppen', 'Materiaal inbegrepen', '1u arbeid']}
        />
        <TierCard
          label="BETER"
          price="€890"
          subtitle="Reparatie + leidingen vervangen (10 jaar garantie)"
          features={['Volledige badkamer-leidingen', 'Druktest na werk', '10 jaar garantie']}
          highlighted
        />
        <TierCard
          label="BEST"
          price="€1.450"
          subtitle="Volledige modernisering — alles in één keer goed"
          features={['Alle aanvoer + afvoer', 'Nieuwe shut-off kranen', '15 jaar garantie']}
        />
      </div>

      {/* CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 220,
          left: 60,
          right: 60,
          background: `linear-gradient(135deg, ${DK.primaryDark} 0%, ${DK.primary} 50%, ${DK.accent} 100%)`,
          borderRadius: 20,
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: `0 20px 60px ${DK.accent}40`,
        }}
      >
        <div
          style={{
            color: DK.text,
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: 1,
          }}
        >
          VERSTUUR NAAR KLANT
        </div>
        <div style={{ color: DK.text, fontSize: 32 }}>→</div>
      </div>

      <TabBar active="Geld" />
    </AppStoreShell>
  );
};

const TierCard: React.FC<{
  label: string;
  price: string;
  subtitle: string;
  features: string[];
  highlighted?: boolean;
}> = ({ label, price, subtitle, features, highlighted }) => (
  <div
    style={{
      backgroundColor: highlighted ? DK.panel2 : DK.panel,
      borderRadius: 20,
      border: highlighted ? `2px solid ${DK.accent}` : `1px solid ${DK.border}`,
      padding: '24px 28px',
      marginBottom: 16,
      boxShadow: highlighted ? `0 16px 50px ${DK.accent}30` : 'none',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div
        style={{
          fontFamily: 'Archivo, sans-serif',
          fontWeight: 900,
          fontSize: 26,
          color: highlighted ? DK.accent : DK.textMuted,
          letterSpacing: 1.6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Archivo, sans-serif',
          fontWeight: 900,
          fontSize: 44,
          color: DK.text,
        }}
      >
        {price}
      </div>
    </div>
    <div style={{ color: DK.textMuted, fontSize: 22, marginTop: 6 }}>{subtitle}</div>
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {features.map((f) => (
        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: DK.accent, fontSize: 22 }}>✓</div>
          <div style={{ color: DK.text, fontSize: 22 }}>{f}</div>
        </div>
      ))}
    </div>
  </div>
);
