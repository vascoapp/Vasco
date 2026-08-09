// =============================================================================
// COMPLIANCE AGENT — active expiry scanner
// =============================================================================
// The passive `complianceService` is a store. This agent runs on top of it:
//
//   1. Enumerates licenses + certifications + insurance.
//   2. Computes days-until-expiry for each, stamps stage (D-30 / D-14 / D-7 / D-1
//      / expired).
//   3. Upserts an idempotent ComplianceAlert keyed on `(itemType:itemId:stage)`
//      so re-running the scan at 28d doesn't create a duplicate row for 30d.
//   4. Queues AI action items (`cert_renewal`) with entityKey dedup so a
//      rejected queue item doesn't get spammed back on every tick.
//   5. Persists the last-run timestamp so the UI can show "Scanned 2 min ago".
//
// Lifecycle:
//   • Fires from backgroundJobScheduler daily block (alongside buildLiveActions
//     + runScheduledPurchasingAgent).
//   • User can also trigger via "Scan now" from ComplianceCenter → scan({ force: true }).
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { complianceService, type License, type Certification, type InsurancePolicy, type ComplianceAlert } from './complianceService';
import { addToQueue } from './aiActionQueueService';
import { MS_PER_DAY } from '../utils/timeConstants';
import { formatDateShortAuto } from '../i18n/formatting';

const LAST_RUN_KEY = '@vasco_compliance_agent_last_run';
const LAST_RESULT_KEY = '@vasco_compliance_agent_last_result';

export type ExpiryStage = 'D-30' | 'D-14' | 'D-7' | 'D-1' | 'expired';

export interface ComplianceScanResult {
  ranAt: string;
  totalItemsChecked: number;
  alertsAdded: number;
  alertsSkipped: number;      // already-present via idempotency
  queueItemsAdded: number;
  itemsAtRisk: number;         // certs within D-30 window
  itemsExpired: number;
}

// ─── Stage classification ───────────────────────────────────────────────────

/** Returns a stage bucket, or null if the item isn't within scanning horizon. */
function stageForExpiry(expiryDate: Date, now: Date = new Date()): ExpiryStage | null {
  const daysOut = Math.floor((expiryDate.getTime() - now.getTime()) / MS_PER_DAY);
  if (daysOut < 0) return 'expired';
  if (daysOut < 1) return 'D-1';
  if (daysOut < 7) return 'D-7';
  if (daysOut < 14) return 'D-14';
  if (daysOut < 30) return 'D-30';
  return null; // > 30 days out — not yet an alert
}

function severityForStage(stage: ExpiryStage): ComplianceAlert['severity'] {
  switch (stage) {
    case 'expired': return 'critical';
    case 'D-1':     return 'critical';
    case 'D-7':     return 'high';
    case 'D-14':    return 'medium';
    case 'D-30':    return 'low';
  }
}

function describeStage(stage: ExpiryStage, name: string, expiryDate: Date): { title: string; description: string } {
  const dateStr = formatDateShortAuto(expiryDate);
  switch (stage) {
    case 'expired':
      return {
        title: `${name} expired`,
        description: `Expired on ${dateStr}. Renew before sending new invoices for work that requires this credential.`,
      };
    case 'D-1':
      return {
        title: `${name} expires tomorrow`,
        description: `Last chance — expires ${dateStr}.`,
      };
    case 'D-7':
      return {
        title: `${name} expires in under 7 days`,
        description: `Expires ${dateStr}. Renewal typically takes 2-5 working days.`,
      };
    case 'D-14':
      return {
        title: `${name} expires in under 2 weeks`,
        description: `Expires ${dateStr}. Consider booking renewal now.`,
      };
    case 'D-30':
      return {
        title: `${name} renewal window open`,
        description: `Expires ${dateStr} — renewal reminders available in the app.`,
      };
  }
}

// ─── Idempotency: compose an alert id from (itemType, itemId, stage) ────────
function alertIdFor(itemType: string, itemId: string, stage: ExpiryStage): string {
  return `agent:${itemType}:${itemId}:${stage}`;
}

// ─── Scan core ──────────────────────────────────────────────────────────────

export interface ScanOptions {
  /** Force a fresh scan even if we ran recently. Default false. */
  force?: boolean;
  /** Minimum interval (ms) between scheduled scans. Default 6h. */
  minIntervalMs?: number;
}

export async function scan(opts: ScanOptions = {}): Promise<ComplianceScanResult> {
  const minInterval = opts.minIntervalMs ?? 6 * 60 * 60 * 1000;
  const now = new Date();

  // Throttle non-forced scans so the scheduler's daily block doesn't double-fire.
  if (!opts.force) {
    try {
      const raw = await AsyncStorage.getItem(LAST_RUN_KEY);
      if (raw) {
        const last = new Date(raw);
        if (now.getTime() - last.getTime() < minInterval) {
          const cached = await getLastResult();
          if (cached) return cached;
        }
      }
    } catch {}
  }

  const licenses = complianceService.getLicenses();
  const certs = complianceService.getCertifications();
  const policies = complianceService.getInsurancePolicies();

  const result: ComplianceScanResult = {
    ranAt: now.toISOString(),
    totalItemsChecked: licenses.length + certs.length + policies.length,
    alertsAdded: 0,
    alertsSkipped: 0,
    queueItemsAdded: 0,
    itemsAtRisk: 0,
    itemsExpired: 0,
  };

  // Track which alerts we've seen this run so we can skip duplicates.
  const existingAlerts = new Set(complianceService.getAllAlertIds());

  const emit = async (
    itemType: 'license' | 'certification' | 'insurance',
    itemId: string,
    itemName: string,
    expiryDate: Date,
    renewalUrl?: string,
  ) => {
    const stage = stageForExpiry(expiryDate, now);
    if (!stage) return;

    if (stage === 'expired') result.itemsExpired += 1;
    else result.itemsAtRisk += 1;

    const id = alertIdFor(itemType, itemId, stage);
    if (existingAlerts.has(id)) {
      result.alertsSkipped += 1;
      return;
    }
    const { title, description } = describeStage(stage, itemName, expiryDate);
    const alert: ComplianceAlert = {
      id,
      type:
        itemType === 'license' ? 'license_expiry'
          : itemType === 'certification' ? 'certification_expiry'
            : 'insurance_expiry',
      severity: severityForStage(stage),
      title,
      description,
      relatedItemId: itemId,
      relatedItemType: itemType,
      dueDate: expiryDate,
      createdAt: now,
      acknowledged: false,
    };
    complianceService.addAlert(alert);
    result.alertsAdded += 1;

    // Queue an actionable cert_renewal item — entityKey scopes the dedup so
    // rejecting once doesn't re-queue on next scan, and same (item, stage)
    // doesn't double-queue within a session.
    if (stage !== 'D-30') {
      // D-30 is informational — don't pester the queue until D-14.
      try {
        await addToQueue({
          type: 'cert_renewal',
          title,
          description,
          preparedData: {
            name: itemName,
            expiryDate: expiryDate.toISOString(),
            itemId,
            itemType,
            stage,
            renewalUrl,
          },
          actionLabel: 'Renew',
          estimatedImpact: stage === 'expired'
            ? 'Critical — cannot invoice without this'
            : stage === 'D-1' ? 'Expires tomorrow'
              : stage === 'D-7' ? 'Under 7 days left'
                : 'Renewal window open',
          expiresAt: new Date(expiryDate.getTime() + 7 * MS_PER_DAY).toISOString(),
          entityKey: `compliance:${itemType}:${itemId}`,
          sourceGeneratorId: 'compliance-agent',
        });
        result.queueItemsAdded += 1;
      } catch {}
    }
  };

  for (const lic of licenses) {
    await emit('license', lic.id, lic.name, new Date(lic.expiryDate));
  }
  for (const cert of certs) {
    await emit('certification', cert.id, cert.name, new Date(cert.expiryDate));
  }
  for (const p of policies) {
    await emit('insurance', p.id, `${p.type} insurance`, new Date(p.endDate));
  }

  // Persist run metadata
  try {
    await AsyncStorage.multiSet([
      [LAST_RUN_KEY, result.ranAt],
      [LAST_RESULT_KEY, JSON.stringify(result)],
    ]);
  } catch {}

  return result;
}

// ─── Status accessors (UI-facing) ────────────────────────────────────────────

export async function getLastRun(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_RUN_KEY);
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

export async function getLastResult(): Promise<ComplianceScanResult | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
