// =============================================================================
// DATA EXPORT SERVICE — GDPR Article 20: Right to data portability
// =============================================================================
// Exports all user data from AsyncStorage in JSON or CSV format.
// Uses Share.share() to let the user save/send the exported file.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { selectAllPages } from '../lib/dataProvider';
import { todayKey } from '../utils/dateKey';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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
  /**
   * The backend was reached and EVERY table was read in full. Only a complete
   * export may be offered as "your records" before account deletion — an
   * offline export (local cache only) or one missing a table is not.
   */
  complete?: boolean;
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
  // Records a business must keep too (review 2026-09-24): incoming supplier
  // invoices, the GoBD audit chain, projects, POs, filings, adviser seats,
  // customer questions.
  scanned_invoices: unknown[];
  gobd_audit_log: unknown[];
  projects: unknown[];
  purchase_orders: unknown[];
  regulated_submissions: unknown[];
  accountant_handovers: unknown[];
  customer_questions: unknown[];
  // …and what the review found still missing: photo records (the files stay
  // in storage — the rows say which exist), invoice numbering, workers,
  // extracted supplier documents and their lines, and the customer's
  // decisions behind any meerwerk invoice (tracker-keyed).
  job_photos: unknown[];
  document_counters: unknown[];
  workers: unknown[];
  extracted_documents: unknown[];
  extracted_line_items: unknown[];
  decision_items: unknown[];
  decision_submissions: unknown[];
  decision_activities: unknown[];
  fetched_at: string;
  /**
   * Tables that could not be read in full. An Art. 15/20 export that is
   * silently missing a table is worse than one that says so (C3).
   */
  incomplete_tables: string[];
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
      scanned_invoices: () => (supabase.from('scanned_invoices' as any) as any).select('*').eq('user_id', user.id),
      gobd_audit_log: () => (supabase.from('gobd_audit_log' as any) as any).select('*').eq('user_id', user.id),
      projects: () => (supabase.from('projects' as any) as any).select('*').eq('user_id', user.id),
      purchase_orders: () => (supabase.from('purchase_orders' as any) as any).select('*').eq('user_id', user.id),
      regulated_submissions: () => (supabase.from('regulated_submissions' as any) as any).select('*').eq('user_id', user.id),
      accountant_handovers: () => (supabase.from('accountant_handovers' as any) as any).select('*').eq('user_id', user.id),
      customer_questions: () => (supabase.from('customer_questions' as any) as any).select('*').eq('contractor_user_id', user.id),
      job_photos: () => (supabase.from('job_photos' as any) as any).select('*').eq('user_id', user.id),
      document_counters: () => (supabase.from('document_counters' as any) as any).select('*').eq('user_id', user.id),
      workers: () => (supabase.from('workers' as any) as any).select('*').eq('user_id', user.id),
      extracted_documents: () => (supabase.from('extracted_documents' as any) as any).select('*').eq('user_id', user.id),
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
      scanned_invoices: [],
      gobd_audit_log: [],
      projects: [],
      purchase_orders: [],
      regulated_submissions: [],
      accountant_handovers: [],
      customer_questions: [],
      job_photos: [],
      document_counters: [],
      workers: [],
      extracted_documents: [],
      extracted_line_items: [],
      decision_items: [],
      decision_submissions: [],
      decision_activities: [],
      fetched_at: new Date().toISOString(),
      incomplete_tables: [],
    };

    // Every row, page by page: each unranged read stopped at 1000 rows, so a
    // contractor with a few years of documents or line items got a truncated
    // export that reported success (sweep 2026-09-23, C3). Ordered by id so
    // no row is skipped or repeated between pages.
    const entries = Object.entries(queries) as [keyof BackendDataset, () => any][];
    await Promise.all(
      entries.map(async ([key, build]) => {
        try {
          const rows = await selectAllPages<unknown>(() => build().order('id', { ascending: true }));
          (result as unknown as Record<string, unknown>)[key] = rows;
        } catch {
          // Per-table failure: keep the rest, but SAY which table is missing.
          result.incomplete_tables.push(String(key));
        }
      }),
    );

    // Second pass: rows owned through a parent, fetched by the parent ids in
    // chunks (a long `.in()` list overflows the URL). A parent that could not
    // be read makes its children incomplete too — never an empty "success".
    const byParent = async (key: keyof BackendDataset, table: string, column: string, parent: keyof BackendDataset) => {
      if (result.incomplete_tables.includes(String(parent))) {
        result.incomplete_tables.push(String(key));
        return;
      }
      const ids = (result[parent] as Array<{ id: string }>).map((r) => r.id);
      const rows: unknown[] = [];
      try {
        for (let i = 0; i < ids.length; i += 100) {
          const chunk = ids.slice(i, i + 100);
          rows.push(...await selectAllPages<unknown>(() =>
            (supabase.from(table as any) as any).select('*').in(column, chunk).order('id', { ascending: true })));
        }
        (result as unknown as Record<string, unknown>)[key] = rows;
      } catch {
        result.incomplete_tables.push(String(key));
      }
    };
    await Promise.all([
      byParent('extracted_line_items', 'extracted_line_items', 'document_id', 'extracted_documents'),
      byParent('decision_items', 'decision_items', 'tracker_id', 'decision_trackers'),
      byParent('decision_submissions', 'decision_submissions', 'tracker_id', 'decision_trackers'),
      byParent('decision_activities', 'decision_activities', 'tracker_id', 'decision_trackers'),
    ]);

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

/**
 * Hand the export over as a FILE. It went out as one share-sheet MESSAGE —
 * which iOS saves as a .txt and Android carries in an intent, whose ~1 MB
 * binder limit the largest accounts (the ones with the most to keep) exceed
 * (review 2026-09-24). Same pattern as the e-invoice export.
 */
async function shareContent(
  content: string,
  title: string,
  kind: 'json' | 'csv' = 'json',
): Promise<void> {
  const file = new File(Paths.cache, `${title}.${kind}`);
  if (file.exists) file.delete();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: kind === 'json' ? 'application/json' : 'text/csv',
      dialogTitle: title,
      UTI: kind === 'json' ? 'public.json' : 'public.comma-separated-values-text',
    });
  } else {
    await Share.share({ message: content, title });
  }
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
    const title = `vasco-data-export-${todayKey()}`;

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

    await shareContent(content, title, format);
    // "Complete" = the backend answered and every table was read in full.
    // Offline, this is the device cache only — not the business's records.
    const complete = !!backendData && backendData.incomplete_tables.length === 0;
    return { success: true, keyCount, complete };
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

    await shareContent(content, `vasco-invoices-${todayKey()}`, 'csv');
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

    await shareContent(content, `vasco-customers-${todayKey()}`, 'csv');
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

    await shareContent(content, `vasco-jobs-${todayKey()}`, 'csv');
    return { success: true, keyCount: jobs.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return { success: false, keyCount: 0, error: message };
  }
}
