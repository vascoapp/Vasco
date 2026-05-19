import React from 'react';
import { DK } from '../data/theme';
import { AppStoreShell, ScreenHeader, TabBar } from './appStoreShell';

export type AppStorePhotoProps = {
  tagline: string;
  subTagline: string;
};

// App Store screenshot #4 — Photo → quote (AI line-item extraction).
export const AppStorePhoto: React.FC<AppStorePhotoProps> = ({ tagline, subTagline }) => {
  return (
    <AppStoreShell tagline={tagline} subTagline={subTagline}>
      <ScreenHeader title="AI Offerte" subtitle="Foto geanalyseerd in 8 sec" />

      {/* Mock job photo */}
      <div
        style={{
          margin: '32px 60px 0 60px',
          height: 480,
          borderRadius: 24,
          background: `linear-gradient(135deg, #1a3a5c 0%, #2a5080 30%, #4a7ab0 60%, #6ba0d0 100%)`,
          border: `1px solid ${DK.border}`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          padding: 28,
        }}
      >
        {/* Faked plumbing job overlay shapes */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 90,
            width: 280,
            height: 140,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 10,
            transform: 'rotate(-8deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 220,
            right: 120,
            width: 220,
            height: 220,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: 110,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 110,
            right: 200,
            width: 60,
            height: 220,
            backgroundColor: 'rgba(255,255,255,0.16)',
            borderRadius: 8,
          }}
        />

        {/* AI scan overlay */}
        <div
          style={{
            position: 'absolute',
            top: 220,
            left: 50,
            backgroundColor: 'rgba(11,14,17,0.85)',
            border: `2px solid ${DK.accent}`,
            borderRadius: 14,
            padding: '12px 18px',
            color: DK.accent,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          ✨ Lekkage gedetecteerd
        </div>

        <div
          style={{
            backgroundColor: 'rgba(11,14,17,0.85)',
            borderRadius: 14,
            padding: '14px 22px',
            zIndex: 1,
          }}
        >
          <div style={{ color: DK.text, fontWeight: 700, fontSize: 24 }}>
            Badkamer · De Jong · Amstelveen
          </div>
          <div style={{ color: DK.textMuted, fontSize: 20, marginTop: 4 }}>3 foto's geüpload</div>
        </div>
      </div>

      {/* Extracted line items */}
      <div style={{ paddingLeft: 60, paddingRight: 60, marginTop: 32 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 22,
              color: DK.accent,
              fontWeight: 800,
              letterSpacing: 0.5,
            }}
          >
            ✨
          </div>
          <div
            style={{
              fontFamily: 'Archivo, sans-serif',
              fontWeight: 800,
              fontSize: 26,
              color: DK.textMuted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Vasco vond deze regels
          </div>
        </div>
        <LineItem
          name="Lekkage stop kit"
          qty="1 st"
          price="€48,90"
        />
        <LineItem
          name="PVC buis Ø32mm"
          qty="2 m"
          price="€18,40"
        />
        <LineItem
          name="Sifon vervangen"
          qty="1 st"
          price="€34,50"
        />
        <LineItem
          name="Arbeid (geschat)"
          qty="2,5u"
          price="€237,50"
        />
      </div>

      {/* CTA bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 230,
          left: 60,
          right: 60,
          background: `linear-gradient(135deg, ${DK.primaryDark} 0%, ${DK.primary} 60%, ${DK.accent} 100%)`,
          borderRadius: 20,
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: `0 20px 60px ${DK.accent}40`,
        }}
      >
        <div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, fontWeight: 600 }}>
            Totaal
          </div>
          <div
            style={{
              color: DK.text,
              fontFamily: 'Archivo, sans-serif',
              fontWeight: 900,
              fontSize: 40,
            }}
          >
            €339,30 + btw
          </div>
        </div>
        <div
          style={{
            color: DK.text,
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 800,
            fontSize: 24,
            letterSpacing: 1,
          }}
        >
          MAAK OFFERTE →
        </div>
      </div>

      <TabBar active="Werk" />
    </AppStoreShell>
  );
};

const LineItem: React.FC<{ name: string; qty: string; price: string }> = ({ name, qty, price }) => (
  <div
    style={{
      backgroundColor: DK.panel,
      borderRadius: 14,
      border: `1px solid ${DK.border}`,
      padding: '16px 22px',
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ color: DK.accent, fontSize: 22 }}>✓</div>
      <div>
        <div style={{ color: DK.text, fontWeight: 700, fontSize: 24 }}>{name}</div>
        <div style={{ color: DK.textMuted, fontSize: 20, marginTop: 2 }}>{qty}</div>
      </div>
    </div>
    <div
      style={{
        fontFamily: 'Archivo, sans-serif',
        fontWeight: 800,
        fontSize: 26,
        color: DK.text,
      }}
    >
      {price}
    </div>
  </div>
);
