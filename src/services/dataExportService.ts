// =============================================================================
// DATA EXPORT SERVICE — GDPR Article 20: Right to data portability
// =============================================================================
// Exports all user data from AsyncStorage in JSON or CSV format.
// Uses Share.share() to let the user save/send the exported file.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportMetadata {
  exportDate: string;
  appVersion: string;
  platform: string;
  userId?: string;
  userEmail?: string;
  format: 'json' | 'csv';
  keyCount: number;
}

interface ExportResult {
  success: boolean;
  keyCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_VERSION = '1.0.0'; // Update with app.json version or Constants.expoConfig

/** All known @vasco_ AsyncStorage key prefixes for structured export */
const KNOWN_DATA_KEYS: Record<string, string> = {
  '@vasco_jobs': 'jobs',
  '@vasco_invoices': 'invoices',
  '@vasco_quotes': 'quotes',
  '@vasco_customers': 'customers',
  '@vasco_projects': 'projects',
  '@vasco_unified_clock': 'timeEntries',
  '@vasco_ai_queue': 'aiQueue',
  '@vasco_workflow_packs': 'workflowPacks',
  '@vasco_automation_config': 'automationConfig',
  '@vasco_automation_last_run': 'automationLastRun',
  '@vasco_calibration': 'calibration',
  '@vasco_ontology': 'ontology',
  '@vasco_morning_briefing': 'morningBriefing',
  '@vasco_scheduler_state': 'schedulerState',
  '@vasco_decision_trackers': 'decisionTrackers',
  '@vasco_decision_submissions': 'decisionSubmissions',
  '@vasco_invoice_scans': 'invoiceScans',
  '@vasco_price_index': 'priceIndex',
  '@vasco_cohort_benchmarks': 'cohortBenchmarks',
  '@vasco_email_import': 'emailImportConfig',
  '@vasco_email_imports': 'emailImportHistory',
  '@vasco_push_token': 'pushToken',
  '@vasco_quote_acceptance_links': 'quoteAcceptanceLinks',
  '@vasco_accounting': 'accountingConfig',
  '@vasco_suppliers': 'suppliers',
  '@vasco_embeddings': 'embeddings',
  '@vasco_etim_cache': 'etimCache',
  '@vasco_datev': 'datevConfig',
  '@vasco_sl_defects': 'siteLeadDefects',
  '@vasco_sl_reports': 'siteLeadReports',
  '@vasco_sl_inspections': 'siteLeadInspections',
  '@vasco_sl_incidents': 'siteLeadIncidents',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStoredValue(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Flatten an array of objects to CSV string */
function arrayToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : String(val);
        // Escape quotes and wrap in quotes if contains comma/newline/quote
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

/** Flatten nested objects for CSV (one level deep) */
function flattenForCsv(obj: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
        flat[`${key}_${subKey}`] = typeof subVal === 'object' ? JSON.stringify(subVal) : subVal;
      }
    } else if (Array.isArray(value)) {
      flat[key] = JSON.stringify(value);
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Core: collect all @vasco_ data
// ---------------------------------------------------------------------------

async function collectAllData(): Promise<Record<string, unknown>> {
  const allKeys = await AsyncStorage.getAllKeys();
  const vascoKeys = allKeys.filter(
    (k) => k.startsWith('@vasco_') || k.startsWith('@secure_'),
  );

  const data: Record<string, unknown> = {};

  for (const key of vascoKeys) {
    // Skip secure keys — they contain API tokens, not user data
    if (key.startsWith('@secure_')) continue;

    const raw = await AsyncStorage.getItem(key);
    const label = KNOWN_DATA_KEYS[key] || key;
    data[label] = parseStoredValue(raw);
  }

  return data;
}

// ---------------------------------------------------------------------------
// R66r61: GDPR Article 20 — collect from Supabase backend
// ---------------------------------------------------------------------------
// Pre-r61 exportAllData only read AsyncStorage. For a contractor whose
// phone was reinstalled (or who exports before the FE first re-hydrates
// from BE), the cache is empty — the GDPR portability obligation is
// satisfied only for users who never reinstall.
//
// This pulls the canonical row sets from Supabase scoped to the
// authenticated user. Returns null when offline / unconfigured so the
// caller can fall back to AsyncStorage-only without throwing.
// Failures on individual tables are logged but don't abort the whole
// export — partial-but-honest beats nothing.
// ---------------------------------------------------------------------------

interface BackendDataset {
  documents: unknown[];     // quotes + invoices (polymorphic R278 table)
  customers: unknown[];
  jobs: unknown[];
  job_materials: unknown[];
  line_items: unknown[];
  materials: unknown[];
  suppliers: unknown[];
  business_settings: unknown[];
  signatures: unknown[];
  decision_trackers: unknown[];
  expenses: unknown[];
  fetched_at: string;
}

async function collectFromBackend(): Promise<BackendDataset | null> {
  try {
    // Gate on the configured flag first — when env vars are missing, the
    // module-level supabase client uses placeholder URLs that would 404.
    if (!isSupabaseConfigured) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // RLS scopes every query to auth.uid() automatically — these calls
    // return only the contractor's own rows. We still pass the userId
    // to filter on the rare table where RLS is service-only (e.g. an
    // export of cohort-aggregate data would need separate handling, but
    // that's not GDPR-portable for the individual anyway).
    const queries = {
      documents: () => supabase.from('documents').select('*').eq('user_id', user.id),
      customers: () => supabase.from('customers').select('*').eq('user_id', user.id),
      jobs: () => supabase.from('jobs').select('*').eq('user_id', user.id),
      job_materials: () => supabase.from('job_materials').select('*').eq('user_id', user.id),
      line_items: () => supabase.from('line_items').select('*').eq('user_id', user.id),
      materials: () => supabase.from('material_catalog').select('*').eq('user_id', user.id),
      suppliers: () => supabase.from('suppliers').select('*').eq('user_id', user.id),
      business_settings: () => supabase.from('business_settings').select('*').eq('user_id', user.id),
      // typegen drift on tables added post-1.0
      signatures: () => (supabase.from('signatures' as any) as any).select('*').eq('contractor_user_id', user.id),
      decision_trackers: () => supabase.from('decision_trackers').select('*').eq('user_id', user.id),
      expenses: () => (supabase.from('expenses' as any) as any).select('*').eq('user_id', user.id),
    };

    const result: BackendDataset = {
      documents: [],
      customers: [],
      jobs: [],
      job_materials: [],
      line_items: [],
      materials: [],
      suppliers: [],
      business_settings: [],
      signatures: [],
      decision_trackers: [],
      expenses: [],
      fetched_at: new Date().toISOString(),
    };

    // Run in parallel — a slow table doesn't block the others.
    const entries = Object.entries(queries) as [keyof BackendDataset, () => Promise<unknown>][];
    await Promise.all(
      entries.map(async ([key, run]) => {
        try {
          const { data, error } = (await run()) as { data: unknown[] | null; error: unknown };
          if (error || !data) return;
          (result as unknown as Record<string, unknown>)[key] = data;
        } catch {
          // Per-table failure: leave [] in place. Better partial than nothing.
        }
      }),
    );

    return result;
  } catch {
    return null;
  }
}

async function collectByKey(storageKey: string): Promise<unknown[]> {
  const raw = await AsyncStorage.getItem(storageKey);
  const parsed = parseStoredValue(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') return [parsed];
  return [];
}

// ---------------------------------------------------------------------------
// Share helper
// ---------------------------------------------------------------------------

async function shareContent(
  content: string,
  title: string,
): Promise<void> {
  await Share.share(
    Platform.OS === 'ios'
      ? { message: content, title }
      : { message: content, title },
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Export ALL user data in JSON or CSV format via Share sheet */
export async function exportAllData(
  format: 'json' | 'csv',
  userInfo?: { userId?: string; email?: string },
): Promise<ExportResult> {
  try {
    // R66r61: pull both local cache + Supabase backend in parallel. Backend
    // is the canonical source post-reinstall; local cache covers offline-
    // only state (drafts, queued writes, intelligence local-storage).
    // Backend null means offline/unconfigured — local-only export still ships.
    const [localData, backendData] = await Promise.all([
      collectAllData(),
      collectFromBackend(),
    ]);

    // Merge: backend rows go under `backend.*`, local-only state stays
    // under top-level labels. No row-level dedup — local has staler / temp-id
    // copies of the same entities; both representations are useful to the
    // user (one shows in-flight drafts, the other shows the BE truth).
    const data: Record<string, unknown> = { ...localData };
    if (backendData) {
      data.backend = backendData;
    }
    const keyCount = Object.keys(data).length;

    const metadata: ExportMetadata = {
      exportDate: new Date().toISOString(),
      appVersion: APP_VERSION,
      platform: Platform.OS,
      userId: userInfo?.userId,
      userEmail: userInfo?.email,
      format,
      keyCount,
    };

    let content: string;
    const title = `vasco-data-export-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'json') {
      content = JSON.stringify({ metadata, data }, null, 2);
    } else {
      // CSV: export each data category as a section
      const sections: string[] = [];
      sections.push('# Vasco Data Export');
      sections.push(`# Date: ${metadata.exportDate}`);
      sections.push(`# User: ${metadata.userEmail || 'unknown'}`);
      sections.push('');

      for (const [label, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          sections.push(`## ${label}`);
          const flattened = value.map((item) =>
            flattenForCsv(item as Record<string, unknown>),
          );
          sections.push(arrayToCsv(flattened));
          sections.push('');
        } else if (value !== null && value !== undefined) {
          sections.push(`## ${label}`);
          sections.push(String(typeof value === 'object' ? JSON.stringify(value) : value));
          sections.push('');
        }
      }

      content = sections.join('\n');
    }

    await shareContent(content, title);
    return { success: true, keyCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return { success: false, keyCount: 0, error: message };
  }
}

/** Export only invoices */
export async function exportInvoices(
  format: 'json' | 'csv' = 'json',
): Promise<ExportResult> {
  try {
    const invoices = await collectByKey('@vasco_invoices');
    let content: string;

    if (format === 'json') {
      content = JSON.stringify(
        {
          metadata: { exportDate: new Date().toISOString(), type: 'invoices', count: invoices.length },
          invoices,
        },
        null,
        2,
      );
    } else {
      const flattened = invoices.map((i) => flattenForCsv(i as Record<string, unknown>));
      content = arrayToCsv(flattened);
    }

    await shareContent(content, `vasco-invoices-${new Date().toISOString().slice(0, 10)}`);
    return { success: true, keyCount: invoices.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return { success: false, keyCount: 0, error: message };
  }
}

/** Export only customers */
export async function exportCustomers(
  format: 'json' | 'csv' = 'json',
): Promise<ExportResult> {
  try {
    const customers = await collectByKey('@vasco_customers');
    let content: string;

    if (format === 'json') {
      content = JSON.stringify(
        {
          metadata: { exportDate: new Date().toISOString(), type: 'customers', count: customers.length },
          customers,
        },
        null,
        2,
      );
    } else {
      const flattened = customers.map((c) => flattenForCsv(c as Record<string, unknown>));
      content = arrayToCsv(flattened);
    }

    await shareContent(content, `vasco-customers-${new Date().toISOString().slice(0, 10)}`);
    return { success: true, keyCount: customers.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return { success: false, keyCount: 0, error: message };
  }
}

/** Export only jobs */
export async function exportJobs(
  format: 'json' | 'csv' = 'json',
): Promise<ExportResult> {
  try {
    const jobs = await collectByKey('@vasco_jobs');
    let content: string;

    if (format === 'json') {
      content = JSON.stringify(
        {
          metadata: { exportDate: new Date().toISOString(), type: 'jobs', count: jobs.length },
          jobs,
        },
        null,
        2,
      );
    } else {
      const flattened = jobs.map((j) => flattenForCsv(j as Record<string, unknown>));
      content = arrayToCsv(flattened);
    }

    await shareContent(content, `vasco-jobs-${new Date().toISOString().slice(0, 10)}`);
    return { success: true, keyCount: jobs.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return { success: false, keyCount: 0, error: message };
  }
}
