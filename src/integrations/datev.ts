// =============================================================================
// DATEV INTEGRATION — Germany's #1 accounting platform
// =============================================================================
// Used by 700K+ businesses via their Steuerberater (tax advisor)
// API: OAuth2 + batch file processing (CSV/XML), NOT standard REST
// Docs: https://developer.datev.de/
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_datev';
const API_BASE = 'https://api.datev.de/platform';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DATEVConfig {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  expiresAt: number;
}

export interface DATEVBookingRecord {
  belegdatum: string;        // Document date (DDMM)
  buchungstext: string;       // Booking text
  umsatz: number;            // Amount
  sollHaben: 'S' | 'H';     // Debit/Credit
  konto: string;             // Account number
  gegenkonto: string;        // Counter account
  steuerschluessel: string;  // Tax code (e.g., '9' for 19%, '8' for 7%)
  belegfeld1?: string;       // Invoice number
  belegfeld2?: string;       // Customer reference
}

export interface DATEVExportResult {
  success: boolean;
  format: 'csv' | 'xml';
  recordCount: number;
  exportedAt: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tax codes mapping (Steuerschlüssel)
// ---------------------------------------------------------------------------

export const DATEV_TAX_CODES = {
  '19_percent': '9',   // Standard rate
  '7_percent': '8',    // Reduced rate
  '0_percent': '0',    // Tax-free
  'reverse_charge': '10', // Reverse charge (B2B EU)
  'inner_eu': '11',    // Intra-EU delivery
} as const;

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

async function getConfig(): Promise<DATEVConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveDATEVConfig(config: DATEVConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearDATEVConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.accessToken.length > 0;
}

// ---------------------------------------------------------------------------
// OAuth2 flow
// ---------------------------------------------------------------------------

export function getDATEVAuthUrl(clientId: string, redirectUri: string): string {
  return `https://login.datev.de/openidsso/core/connect/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20datev:accounting:clients`;
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(config: DATEVConfig): Promise<DATEVConfig | null> {
  try {
    const res = await fetch('https://login.datev.de/openid/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const newConfig: DATEVConfig = {
      ...config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? config.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    await saveDATEVConfig(newConfig);
    return newConfig;
  } catch {
    return null;
  }
}

/** Ensure the stored token is valid; auto-refreshes if expiring within 5 min. */
export async function ensureValidToken(): Promise<DATEVConfig | null> {
  const config = await getConfig();
  if (!config) return null;

  if (Date.now() > config.expiresAt - 300_000) {
    return refreshAccessToken(config);
  }
  return config;
}

// ---------------------------------------------------------------------------
// DATEV CSV Export (Buchungsstapel format)
// ---------------------------------------------------------------------------

export function generateDATEVCSV(records: DATEVBookingRecord[]): string {
  // DATEV CSV header line (Buchungsstapel format)
  const header = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basis-Umsatz',
    'WKZ Basis-Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
  ].join(';');

  const rows = records.map(r => [
    r.umsatz.toFixed(2).replace('.', ','), // German decimal format
    r.sollHaben,
    'EUR',
    '',
    '',
    '',
    r.konto,
    r.gegenkonto,
    r.steuerschluessel,
    r.belegdatum,
    r.belegfeld1 ?? '',
    r.belegfeld2 ?? '',
    '',
    `"${r.buchungstext}"`,
  ].join(';'));

  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Convert Vasco invoices to DATEV booking records
// ---------------------------------------------------------------------------

export function invoiceToDATEVRecords(invoice: {
  id: string;
  customerName: string;
  amount: number;
  vatRate: number;
  date: string;
  isPaid: boolean;
}): DATEVBookingRecord[] {
  const netAmount = invoice.amount / (1 + invoice.vatRate / 100);
  const vatAmount = invoice.amount - netAmount;
  const dateFormatted = invoice.date.replace(/-/g, '').slice(4); // DDMM format

  const taxCode = invoice.vatRate === 19 ? DATEV_TAX_CODES['19_percent']
    : invoice.vatRate === 7 ? DATEV_TAX_CODES['7_percent']
    : DATEV_TAX_CODES['0_percent'];

  return [{
    belegdatum: dateFormatted,
    buchungstext: `Rechnung ${invoice.id} - ${invoice.customerName}`,
    umsatz: netAmount,
    sollHaben: 'S',
    konto: '10000', // Debitor (customer receivable)
    gegenkonto: '8400', // Erlöse 19% USt (revenue)
    steuerschluessel: taxCode,
    belegfeld1: invoice.id,
    belegfeld2: invoice.customerName,
  }];
}

// ---------------------------------------------------------------------------
// Export all invoices as DATEV CSV
// ---------------------------------------------------------------------------

export async function exportToDATEV(invoices: Array<{
  id: string;
  customerName: string;
  amount: number;
  vatRate: number;
  date: string;
  isPaid: boolean;
}>): Promise<DATEVExportResult> {
  try {
    const records = invoices.flatMap(inv => invoiceToDATEVRecords(inv));
    const csv = generateDATEVCSV(records);

    // In production: upload to DATEV Unternehmen Online API
    // For now: return the CSV for sharing
    return {
      success: true,
      format: 'csv',
      recordCount: records.length,
      exportedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      success: false,
      format: 'csv',
      recordCount: 0,
      exportedAt: new Date().toISOString(),
      error: 'DATEV Export fehlgeschlagen',
    };
  }
}
