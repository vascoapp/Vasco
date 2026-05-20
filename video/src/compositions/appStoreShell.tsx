import React from 'react';
import { AbsoluteFill } from 'remotion';
import { DK } from '../data/theme';
import { STRINGS, type ScreenshotLocale } from '../data/screenshotStrings';

// Shared "App Store screenshot" frame used by all 5 hero screens.
// Top tagline strip + dark phone-style panel beneath. Screen-specific
// children render inside the panel.

export type ShellProps = {
  tagline: string;
  subTagline: string;
  children: React.ReactNode;
};

export const AppStoreShell: React.FC<ShellProps> = ({ tagline, subTagline, children }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: DK.bg, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ paddingTop: 110, paddingLeft: 90, paddingRight: 90, paddingBottom: 60 }}>
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

        {children}
      </div>
    </AbsoluteFill>
  );
};

export const ScreenHeader: React.FC<{ title: string; subtitle?: string }> = ({
  title,
  subtitle,
}) => (
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
      {title}
    </div>
    {subtitle ? (
      <div style={{ color: DK.textMuted, fontSize: 26, marginTop: 8, fontWeight: 500 }}>
        {subtitle}
      </div>
    ) : null}
  </div>
);

// R88: tab labels now locale-aware via STRINGS[locale].tabs. The `active`
// prop still uses the canonical NL key names so callers don't need to
// change — we resolve to the locale-specific label at render time.
type TabKey = 'vandaag' | 'werk' | 'geld' | 'klanten' | 'vasco';
const TAB_KEYS: TabKey[] = ['vandaag', 'werk', 'geld', 'klanten', 'vasco'];

export const TabBar: React.FC<{
  active: 'Vandaag' | 'Werk' | 'Geld' | 'Klanten' | 'Vasco';
  locale?: ScreenshotLocale;
}> = ({ active, locale = 'nl' }) => {
  const labels = STRINGS[locale].tabs as Record<TabKey, string>;
  const activeKey = active.toLowerCase() as TabKey;
  return (
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
      {TAB_KEYS.map((k) => {
        const isActive = k === activeKey;
        return (
          <div
            key={k}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: isActive ? DK.accent : DK.border,
              }}
            />
            <div
              style={{
                fontSize: 18,
                color: isActive ? DK.accent : DK.textMuted,
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {labels[k]}
            </div>
          </div>
        );
      })}
    </div>
  );
};
