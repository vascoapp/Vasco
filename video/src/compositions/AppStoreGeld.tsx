import React from 'react';
import { DK } from '../data/theme';
import { AppStoreShell, ScreenHeader, TabBar } from './appStoreShell';
import { STRINGS, type ScreenshotLocale } from '../data/screenshotStrings';

export type AppStoreGeldProps = {
  tagline: string;
  subTagline: string;
  locale?: ScreenshotLocale;
};

// App Store screenshot #3 — Money tab (outstanding invoices + payment-link CTA).
// R88: locale-aware.
export const AppStoreGeld: React.FC<AppStoreGeldProps> = ({ tagline, subTagline, locale = 'nl' }) => {
  const s = STRINGS[locale].geld;
  // Pick a tone per row by status string heuristic (overdue → error, due → highlight).
  const toneFor = (status: string): string => {
    const lower = status.toLowerCase();
    if (lower.includes('overdue') || lower.includes('over tijd')) return DK.error;
    if (lower.includes('due') || lower.includes('verlopen')) return DK.highlight;
    return DK.textMuted;
  };
  return (
    <AppStoreShell tagline={tagline} subTagline={subTagline}>
      <ScreenHeader title={s.title} subtitle={s.subtitle} />

      {/* KPI strip */}
      <div
        style={{
          margin: '36px 60px 0 60px',
          display: 'flex',
          gap: 16,
        }}
      >
        <Kpi label={s.kpi1Label} value={s.kpi1Value} tone={DK.text} />
        <Kpi label={s.kpi2Label} value={s.kpi2Value} tone={DK.error} />
      </div>

      {/* Invoice list */}
      <div style={{ paddingLeft: 60, paddingRight: 60, marginTop: 32 }}>
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
          {s.sectionTitle}
        </div>
        {s.rows.map((row, idx) => (
          <InvoiceRow
            key={idx}
            customer={row.customer}
            invoiceRef={row.ref}
            amount={row.amount}
            status={row.status}
            statusColor={toneFor(row.status)}
            cta={row.cta}
          />
        ))}
      </div>

      {/* Bottom auto-incasso card */}
      <div
        style={{
          position: 'absolute',
          bottom: 230,
          left: 60,
          right: 60,
          background: `linear-gradient(135deg, ${DK.primaryDark} 0%, ${DK.primary} 60%, ${DK.accent} 100%)`,
          borderRadius: 24,
          padding: '28px 36px',
          boxShadow: `0 20px 60px ${DK.accent}40`,
        }}
      >
        <div
          style={{
            color: DK.text,
            fontFamily: 'Archivo, sans-serif',
            fontWeight: 900,
            fontSize: 32,
            lineHeight: 1.2,
          }}
        >
          {s.bottomCardTitle}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 24, marginTop: 8 }}>
          {s.bottomCardBody}
        </div>
      </div>

      <TabBar active="Geld" locale={locale} />
    </AppStoreShell>
  );
};

const Kpi: React.FC<{ label: string; value: string; tone: string }> = ({ label, value, tone }) => (
  <div
    style={{
      flex: 1,
      backgroundColor: DK.panel,
      borderRadius: 18,
      border: `1px solid ${DK.border}`,
      padding: '20px 24px',
    }}
  >
    <div
      style={{
        color: DK.textMuted,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: 'Archivo, sans-serif',
        fontWeight: 900,
        fontSize: 44,
        color: tone,
        marginTop: 6,
      }}
    >
      {value}
    </div>
  </div>
);

const InvoiceRow: React.FC<{
  customer: string;
  invoiceRef: string;
  amount: string;
  status: string;
  statusColor: string;
  cta?: string;
}> = ({ customer, invoiceRef, amount, status, statusColor, cta }) => (
  <div
    style={{
      backgroundColor: DK.panel,
      borderRadius: 18,
      border: `1px solid ${DK.border}`,
      padding: '20px 24px',
      marginBottom: 14,
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ color: DK.text, fontWeight: 700, fontSize: 26 }}>{customer}</div>
        <div style={{ color: DK.textMuted, fontSize: 20, marginTop: 4 }}>{invoiceRef}</div>
      </div>
      <div
        style={{
          fontFamily: 'Archivo, sans-serif',
          fontWeight: 900,
          fontSize: 36,
          color: DK.text,
        }}
      >
        {amount}
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
      <div style={{ color: statusColor, fontSize: 20, fontWeight: 700 }}>{status}</div>
      {cta ? (
        <div
          style={{
            paddingLeft: 18,
            paddingRight: 18,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 10,
            backgroundColor: `${DK.accent}30`,
            color: DK.accent,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 0.8,
          }}
        >
          {cta}
        </div>
      ) : null}
    </div>
  </div>
);
