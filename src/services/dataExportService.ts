// =============================================================================
// DATA EXPORT SERVICE — GDPR Article 20: Right to data portability
// =============================================================================
// Exports all user data from AsyncStorage in JSON or CSV format.
// Uses Share.share() to let the user save/send the exported file.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Platform } from 'react-native';

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
    const data = await collectAllData();
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
