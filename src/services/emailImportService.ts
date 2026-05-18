// =============================================================================
// EMAIL IMPORT SERVICE — Forward supplier invoices for automatic extraction
// =============================================================================
// Contractors forward supplier invoices to their unique Vasco email address.
// Supabase email webhook → Edge Function → AI extraction → pricing moat.
//
// Setup: Each contractor gets a unique forwarding address:
//   invoices+{userId}@ingest.vascobuild.com
//
// Flow:
//   1. Contractor forwards invoice email from Technische Unie/Rexel/etc.
//   2. Email arrives at Supabase webhook (or third-party: Postmark inbound)
//   3. Edge function extracts PDF attachment
//   4. Claude Haiku Vision reads the PDF → structured line items
//   5. feedPricingMoat() stores to material_price_history
//   6. Contractor sees "3 new prices imported" notification
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId } from '../lib/currentUser';

const CONFIG_KEY = '@vasco_email_import';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailImportConfig {
  enabled: boolean;
  forwardingAddress: string; // unique per contractor
  autoImport: boolean; // auto-process without review
  notifyOnImport: boolean;
  trustedSenders: string[]; // whitelisted sender emails
  importCount: number; // total imports via email
  lastImportAt?: string;
}

export interface EmailImportEvent {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  attachmentCount: number;
  status: 'pending' | 'processed' | 'failed' | 'review';
  lineItemsExtracted: number;
  totalAmount?: number;
  supplierName?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Config management
// ---------------------------------------------------------------------------

export async function getEmailImportConfig(userId: string): Promise<EmailImportConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  // Default config with generated forwarding address
  const config: EmailImportConfig = {
    enabled: false,
    forwardingAddress: `invoices+${userId.replace(/[^a-z0-9]/gi, '')}@ingest.vascobuild.com`,
    autoImport: true,
    notifyOnImport: true,
    trustedSenders: [],
    importCount: 0,
  };

  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config)).catch(() => {});
  return config;
}

export async function updateEmailImportConfig(updates: Partial<EmailImportConfig>): Promise<void> {
  const current = await getEmailImportConfig(getCurrentUserId());
  const updated = { ...current, ...updates };
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(updated));

  // Sync to Supabase if available
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('user_settings') as any).upsert({
        user_id: getCurrentUserId(),
        setting_key: 'email_import',
        setting_value: updated,
      });
    } catch {}
  }
}

export async function enableEmailImport(userId: string): Promise<EmailImportConfig> {
  const config = await getEmailImportConfig(userId);
  config.enabled = true;
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return config;
}

export async function addTrustedSender(email: string): Promise<void> {
  const config = await getEmailImportConfig(getCurrentUserId());
  if (!config.trustedSenders.includes(email.toLowerCase())) {
    config.trustedSenders.push(email.toLowerCase());
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }
}

// ---------------------------------------------------------------------------
// Import history
// ---------------------------------------------------------------------------

const HISTORY_KEY = '@vasco_email_imports';

export async function getImportHistory(): Promise<EmailImportEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function recordImportEvent(event: EmailImportEvent): Promise<void> {
  try {
    const history = await getImportHistory();
    history.unshift(event);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));

    // Update import count
    const config = await getEmailImportConfig(getCurrentUserId());
    config.importCount++;
    config.lastImportAt = event.receivedAt;
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

// ---------------------------------------------------------------------------
// Webhook processing (called from Supabase Edge Function)
// ---------------------------------------------------------------------------

// This function would be called by the Edge Function after email processing.
// In the app, we poll for new imports or receive push notifications.
export async function checkForNewImports(): Promise<EmailImportEvent[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data } = await (supabase.from('email_imports') as any)
      .select('*')
      .eq('user_id', getCurrentUserId())
      .eq('status', 'processed')
      .order('received_at', { ascending: false })
      .limit(10);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      from: row.from_email,
      subject: row.subject,
      receivedAt: row.received_at,
      attachmentCount: row.attachment_count,
      status: row.status,
      lineItemsExtracted: row.line_items_extracted,
      totalAmount: row.total_amount,
      supplierName: row.supplier_name,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Common supplier email patterns (for auto-detection)
// ---------------------------------------------------------------------------

export const KNOWN_SUPPLIER_EMAILS: Record<string, string> = {
  // NL
  'technischeunie.nl': 'Technische Unie',
  'rexel.nl': 'Rexel Nederland',
  'solar.nl': 'Solar Nederland',
  'brouwer.nl': 'Brouwer',
  'sonepar.nl': 'Sonepar',
  // DE
  'sonepar.de': 'Sonepar Deutschland',
  'rexel.de': 'Rexel Deutschland',
  'richter-frenzel.de': 'Richter+Frenzel',
  'baywa.de': 'BayWa',
  'wuerth.com': 'Würth',
  // FR
  'rexel.fr': 'Rexel France',
  'sonepar.fr': 'Sonepar France',
  'point-p.fr': 'Point.P',
  'cedeo.fr': 'Cedeo',
  // ES
  'saltoki.es': 'Saltoki',
  'rexel.es': 'Rexel Spain',
  // IT
  'sonepar.it': 'Sonepar Italia',
  'comoli.com': 'Comoli Ferrari',
  'rexel.it': 'Rexel Italia',
  // UK
  'screwfix.com': 'Screwfix',
  'toolstation.com': 'Toolstation',
  'cef.co.uk': 'City Electrical Factors',
  'travisperkins.co.uk': 'Travis Perkins',
};

export function identifySupplierFromEmail(fromEmail: string): string | null {
  const domain = fromEmail.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  for (const [pattern, name] of Object.entries(KNOWN_SUPPLIER_EMAILS)) {
    if (domain.includes(pattern)) return name;
  }
  return null;
}
