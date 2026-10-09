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
import { addToQueue, withdrawComplianceCards, cardWasHandled } from './aiActionQueueService';
import { MS_PER_DAY } from '../utils/timeConstants';
import { localDateKey } from '../utils/dateKey';
import { formatDateShortAuto } from '../i18n/formatting';
import i18n from '../i18n/i18n';
import { applySavedLanguage, applySavedCountry } from '../i18n/savedLanguage';

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

/**
 * Alert + queue-card copy. Resolved here and then STORED, so the language must
 * be the contractor's before this runs (scan awaits applySavedLanguage). It
 * was English literals for every market (sweep 2026-09-23, E2).
 */
function describeStage(stage: ExpiryStage, name: string, expiryDate: Date): { title: string; description: string } {
  const date = formatDateShortAuto(expiryDate);
  const key = stage === 'expired' ? 'expired' : stage === 'D-1' ? 'd1' : stage === 'D-7' ? 'd7' : stage === 'D-14' ? 'd14' : 'd30';
  return {
    title: i18n.t(`complianceAgent.${key}Title`, { name }),
    description: i18n.t(`complianceAgent.${key}Desc`, { date }),
  };
}

function impactFor(stage: ExpiryStage): string {
  return i18n.t(
    stage === 'expired' ? 'complianceAgent.impactExpired'
      : stage === 'D-1' ? 'complianceAgent.impactD1'
        : stage === 'D-7' ? 'complianceAgent.impactD7'
          : 'complianceAgent.impactWindow',
  );
}

// ─── Idempotency: compose an alert id from (itemType, itemId, stage) ────────
// The expiry date is part of it: resolved alerts stay in the id set, so after a
// renewal the new cycle's "D-7" collided with the old one and was skipped —
// card and all.
function alertIdFor(itemType: string, itemId: string, stage: ExpiryStage, expiryDate: Date): string {
  return `agent:${itemType}:${itemId}:${localDateKey(expiryDate)}:${stage}`;
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

  // The copy below is stored — settle the contractor's language and country
  // (currency/date format) before the first t() (CLAUDE.md, #210/#362).
  await applySavedLanguage();
  await applySavedCountry();

  // The store reads the device + account copy first: on a cold start the
  // scheduler runs before any screen has mounted, and it scanned nothing.
  await complianceService.load().catch(() => {});

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

    const id = alertIdFor(itemType, itemId, stage, expiryDate);
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
      const entityKey = `compliance:${itemType}:${itemId}:${localDateKey(expiryDate)}:${stage}`;
      try {
        // Alerts live in memory, so after a restart every stage looks new —
        // a card the contractor already dismissed must not come back.
        if (await cardWasHandled(entityKey)) return;
        // A NEW stage replaces the item's pending card: "expires in 14 days"
        // must not still be the card a week later.
        await withdrawComplianceCards(itemId, entityKey);
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
          actionLabel: i18n.t('complianceAgent.renew'),
          estimatedImpact: impactFor(stage),
          expiresAt: new Date(expiryDate.getTime() + 7 * MS_PER_DAY).toISOString(),
          // The expiry is part of the key: a renewed certificate starts a new
          // cycle — keyed on the item alone, its next expiry was never queued.
          entityKey,
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
    // The policy type is an enum ('workers_comp'); it printed raw.
    // The name the contractor gave it first; the type label only for an unnamed one.
    await emit('insurance', p.id, p.name?.trim() || i18n.t(`complianceAgent.insurance.${p.type}`, { defaultValue: String(p.type) }), new Date(p.endDate));
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
