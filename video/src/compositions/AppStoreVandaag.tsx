import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DK } from '../data/theme';

export type AppStoreVandaagProps = {
  tagline: string;
  subTagline: string;
};

// App Store screenshot #1 — Vandaag tab.
// 6.9" iPhone canvas (1320×2868). Designed to mimic the live app's
// Vandaag tab + a top tagline strip (Notion/Linear-style App Store layout).
export const AppStoreVandaag: React.FC<AppStoreVandaagProps> = ({
  tagline,
  subTagline,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: DK.bg, fontFamily: 'Inter, sans-serif' }}>
      {/* Top marketing strip */}
      <div
        style={{
          paddingTop: 110,
          paddingLeft: 90,
          paddingRight: 90,
          paddingBottom: 60,
        }}
      >
        <div
          style={{
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 900,
            fontSize: 96,
            color: DK.text,
            lineHeight: 1.05,
            letterSpacing: -1.5,
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 38,
            color: DK.textMuted,
            marginTop: 28,
            lineHeight: 1.35,
          }}
        >
          {subTagline}
        </div>
      </div>

      {/* iPhone-style "screen" panel */}
      <div
        style={{
          position: 'absolute',
          top: 580,
          left: 60,
          right: 60,
          bottom: 60,
          backgroundColor: DK.bg,
          borderRadius: 64,
          borderWidth: 4,
          borderColor: DK.border,
          borderStyle: 'solid',
          overflow: 'hidden',
          boxShadow: '0 80px 200px rgba(249, 115, 22, 0.15)',
        }}
      >
        {/* Status bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 50,
            paddingLeft: 80,
            paddingRight: 80,
            paddingBottom: 20,
          }}
        >
          <div style={{ color: DK.text, fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 32 }}>
            9:41
          </div>
          <div style={{ color: DK.text, fontSize: 28 }}>● ● ● ●●●</div>
        </div>

        {/* Header */}
        <div style={{ paddingLeft: 60, paddingRight: 60, paddingTop: 24 }}>
          <div
            style={{
              fontFamily: 'Archivo, sans-serif',
              fontWeight: 900,
              fontSize: 56,
              color: DK.text,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
            }}
          >
            Vandaag
          </div>
          <div
            style={{
              color: DK.textMuted,
              fontSize: 26,
              marginTop: 8,
              fontWeight: 500,
            }}
          >
            Woensdag 19 mei
          </div>
        </div>

        {/* EVE hero card with gradient + glow */}
        <div
          style={{
            margin: '36px 60px 0 60px',
            borderRadius: 28,
            background: `linear-gradient(135deg, ${DK.primaryDark} 0%, ${DK.primary} 50%, ${DK.accent} 100%)`,
            padding: '40px 44px',
            boxShadow: `0 30px 80px ${DK.accent}40`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
              }}
            >
              ✨
            </div>
            <div
              style={{
                fontFamily: 'Archivo, sans-serif',
                fontWeight: 800,
                fontSize: 28,
                color: DK.text,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Vasco voor jou
            </div>
          </div>
          <div
            style={{
              fontFamily: 'Archivo, sans-serif',
              fontWeight: 900,
              fontSize: 48,
              color: DK.text,
              lineHeight: 1.15,
              marginBottom: 12,
            }}
          >
            3 offertes wachten om verstuurd te worden
          </div>
          <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: 26, lineHeight: 1.4 }}>
            Binnen 24 uur versturen verdubbelt je acceptatie. Tik om alles in één keer te doen.
          </div>
          <div
            style={{
              marginTop: 28,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 16,
              padding: '20px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ color: DK.text, fontWeight: 700, fontSize: 28, letterSpacing: 1 }}>
              VERSTUUR ALLES
            </div>
            <div style={{ color: DK.text, fontSize: 32 }}>→</div>
          </div>
        </div>

        {/* Savings banner */}
        <div
          style={{
            margin: '24px 60px 0 60px',
            borderRadius: 20,
            backgroundColor: DK.panel,
            border: `1px solid ${DK.border}`,
            padding: '24px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{ fontSize: 36 }}>💰</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: DK.textMuted, fontSize: 22, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              Vasco bespaarde je deze week
            </div>
            <div
              style={{
                color: DK.highlight,
                fontFamily: 'Archivo, sans-serif',
                fontWeight: 900,
                fontSize: 42,
                marginTop: 4,
                textShadow: `0 0 24px ${DK.highlight}40`,
              }}
            >
              4u 23min  ·  €847
            </div>
          </div>
        </div>

        {/* Today's jobs */}
        <div style={{ paddingLeft: 60, paddingRight: 60, marginTop: 40 }}>
          <div
            style={{
              fontFamily: 'Archivo, sans-serif',
              fontWeight: 800,
              fontSize: 26,
              color: DK.textMuted,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            Agenda vandaag
          </div>
          <JobRow
            time="09:00"
            title="Lekkage badkamer — De Jong"
            address="Amstelveen"
            status="ONDERWEG"
            statusColor={DK.highlight}
          />
          <JobRow
            time="11:30"
            title="CV-ketel onderhoud — Bakker"
            address="Hoofddorp"
            status="GEPLAND"
            statusColor={DK.textMuted}
          />
          <JobRow
            time="14:00"
            title="Riool ontstoppen — Mulder"
            address="Amsterdam Zuid"
            status="GEPLAND"
            statusColor={DK.textMuted}
          />
        </div>

        {/* Bottom tab bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: DK.panel,
            borderTop: `1px solid ${DK.border}`,
            paddingTop: 20,
            paddingBottom: 60,
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          <Tab label="Vandaag" active />
          <Tab label="Werk" />
          <Tab label="Geld" />
          <Tab label="Klanten" />
          <Tab label="Vasco" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const JobRow: React.FC<{
  time: string;
  title: string;
  address: string;
  status: string;
  statusColor: string;
}> = ({ time, title, address, status, statusColor }) => (
  <div
    style={{
      backgroundColor: DK.panel,
      borderRadius: 18,
      border: `1px solid ${DK.border}`,
      padding: '24px 28px',
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 24,
    }}
  >
    <div
      style={{
        fontFamily: 'Archivo, sans-serif',
        fontWeight: 900,
        fontSize: 34,
        color: DK.highlight,
        minWidth: 90,
        textShadow: `0 0 18px ${DK.highlight}50`,
      }}
    >
      {time}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ color: DK.text, fontWeight: 700, fontSize: 26, marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ color: DK.textMuted, fontSize: 22 }}>{address}</div>
    </div>
    <div
      style={{
        color: statusColor,
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: 1,
      }}
    >
      {status}
    </div>
  </div>
);

const Tab: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}
  >
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: active ? DK.accent : DK.border,
      }}
    />
    <div
      style={{
        fontSize: 18,
        color: active ? DK.accent : DK.textMuted,
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </div>
  </div>
);
