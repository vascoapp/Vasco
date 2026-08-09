// =============================================================================
// JOB COMPLETION CHECKLIST
// =============================================================================
// Per-trade requirements that must be satisfied before a job can be marked
// `completed`. Keeps contractors compliant (gas certs, before/after photos)
// and customers happy (handover notes).
// =============================================================================

import type { Job } from '../types/contractor';
import type { JobPhotoRecord, PhotoKind } from './jobPhotoService';
import { complianceService, type Certification } from './complianceService';
import { formatDateShortAuto } from '../i18n/formatting';

export type ChecklistItemId =
  | 'before_photo'
  | 'after_photo'
  | 'handover_photo'
  | 'gas_certificate'
  | 'electrical_test'
  | 'customer_signoff'
  | 'waste_disposal_note'
  | 'warranty_info';

export interface ChecklistItem {
  id: ChecklistItemId;
  label: string;          // English fallback (kept for back-compat + analytics)
  required: boolean;
  satisfied: boolean;
  hint?: string;          // English fallback hint
  // R16.2: i18n keys for the consumer to resolve via `t()`. Service stays
  // agnostic of i18next; callers (job/[id].tsx alert, completion sheet)
  // call t(labelKey, label) and t(hintKey, hint) at render time.
  labelKey: string;
  hintKey?: string;
  /** Interpolation values for the hintKey (e.g. cert name, days remaining). */
  hintParams?: Record<string, string | number>;
}

export interface ChecklistResult {
  canComplete: boolean;
  items: ChecklistItem[];
  missingCount: number;
}

interface ChecklistContext {
  job: Job;
  photos: JobPhotoRecord[];
  signedOff?: boolean;
  /** Optional overrides — most callers leave these undefined and let the
   * checklist query `complianceService` for live cert state. Useful for
   * tests + demo-mode screens that want to force a state. */
  hasGasCert?: boolean;
  hasElectricalTest?: boolean;
  hasWasteNote?: boolean;
  hasWarrantyInfo?: boolean;
}

function hasPhotoKind(photos: JobPhotoRecord[], kind: PhotoKind): boolean {
  return photos.some((p) => p.kind === kind);
}

/** Find a valid (not expired) certification whose name matches any of the
 * given keywords (case-insensitive). Returns the matching cert or null. */
function findValidCert(keywords: string[]): Certification | null {
  try {
    const certs = complianceService.getCertifications();
    const now = Date.now();
    const lc = keywords.map((k) => k.toLowerCase());
    for (const c of certs) {
      const name = (c.name ?? '').toLowerCase();
      if (!lc.some((k) => name.includes(k))) continue;
      const expiry = c.expiryDate ? new Date(c.expiryDate).getTime() : 0;
      if (expiry <= now) continue; // expired
      return c;
    }
  } catch {}
  return null;
}

/** True when a non-expired cert matches. Pulls the override from the ctx
 * first — when explicitly provided it wins over the live lookup. */
function resolveCert(override: boolean | undefined, keywords: string[]): { ok: boolean; cert: Certification | null } {
  if (override !== undefined) return { ok: override, cert: null };
  const cert = findValidCert(keywords);
  return { ok: Boolean(cert), cert };
}

// R16.2: returns { fallback, key, params } so the consumer can render via t().
function certHint(
  kind: string,
  cert: Certification | null,
  fallback: string,
  fallbackKey: string,
): { hint: string; hintKey: string; hintParams?: Record<string, string | number> } {
  if (!cert) return { hint: fallback, hintKey: fallbackKey };
  const days = Math.floor((new Date(cert.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) {
    const date = formatDateShortAuto(new Date(cert.expiryDate));
    return {
      hint: `${cert.name} expired on ${date}. Renew before closing.`,
      hintKey: 'checklist.certExpired',
      hintParams: { name: cert.name, date },
    };
  }
  if (days < 14) {
    return {
      hint: `${cert.name} expires in ${days} day${days === 1 ? '' : 's'} — renew soon to keep this ${kind} valid.`,
      hintKey: 'checklist.certExpiringSoon',
      // `count` drives the i18next plural; `days` stays for any caller that
      // still interpolates it.
      hintParams: { name: cert.name, days, count: days, kind },
    };
  }
  return { hint: fallback, hintKey: fallbackKey };
}

/** Evaluate the checklist. Returns `canComplete=false` if any required item is missing. */
export function evaluateCompletion(ctx: ChecklistContext): ChecklistResult {
  const trade = (ctx.job.trade ?? 'general').toLowerCase();
  const items: ChecklistItem[] = [];

  // Universal: before + after photos strongly recommended; required for
  // trades where visual evidence matters.
  const needsVisualEvidence = ['painting', 'tiling', 'plastering', 'flooring', 'roofing', 'landscaping'].includes(trade);
  items.push({
    id: 'before_photo',
    label: 'Before photo',
    labelKey: 'checklist.beforePhoto',
    required: needsVisualEvidence,
    satisfied: hasPhotoKind(ctx.photos, 'before'),
  });
  items.push({
    id: 'after_photo',
    label: 'After photo',
    labelKey: 'checklist.afterPhoto',
    required: needsVisualEvidence,
    satisfied: hasPhotoKind(ctx.photos, 'after'),
  });
  items.push({
    id: 'handover_photo',
    label: 'Handover photo',
    labelKey: 'checklist.handoverPhoto',
    required: false,
    satisfied: hasPhotoKind(ctx.photos, 'handover'),
  });

  // Regulated trades — compliance paperwork. Resolve against live cert state
  // so an expired Gaskeur actually blocks the job completion.
  if (trade === 'gas' || trade === 'plumbing') {
    const gas = resolveCert(ctx.hasGasCert, ['gaskeur', 'cw-', 'gas safe', 'gasfitter']);
    const gasHint = certHint('gas cert', gas.cert, 'Upload Gaskeur / CW-attest before closing the job', 'checklist.gasCertHint');
    items.push({
      id: 'gas_certificate',
      label: 'Gas safety / CW certificate',
      labelKey: 'checklist.gasCert',
      required: trade === 'gas',
      satisfied: gas.ok,
      hint: gasHint.hint,
      hintKey: gasHint.hintKey,
      hintParams: gasHint.hintParams,
    });
  }
  if (trade === 'electrical') {
    const elec = resolveCert(ctx.hasElectricalTest, ['nen 1010', 'nen1010', 'eicr', '18th edition', 'niceic']);
    const elecHint = certHint('electrical test', elec.cert, 'NEN 1010 / EICR report is required for handover', 'checklist.electricalHint');
    items.push({
      id: 'electrical_test',
      label: 'Electrical test report',
      labelKey: 'checklist.electricalTest',
      required: true,
      satisfied: elec.ok,
      hint: elecHint.hint,
      hintKey: elecHint.hintKey,
      hintParams: elecHint.hintParams,
    });
  }

  // Waste note for any trade that moves construction debris
  if (['roofing', 'tiling', 'plastering', 'flooring', 'carpentry'].includes(trade)) {
    items.push({
      id: 'waste_disposal_note',
      label: 'Waste disposal note',
      labelKey: 'checklist.wasteNote',
      required: false,
      satisfied: Boolean(ctx.hasWasteNote),
    });
  }

  items.push({
    id: 'warranty_info',
    label: 'Warranty information sent',
    labelKey: 'checklist.warrantyInfo',
    required: false,
    satisfied: Boolean(ctx.hasWarrantyInfo),
  });

  items.push({
    id: 'customer_signoff',
    label: 'Customer sign-off',
    labelKey: 'checklist.customerSignoff',
    required: true,
    satisfied: Boolean(ctx.signedOff),
    hint: 'Capture a digital signature to close the job',
    hintKey: 'checklist.customerSignoffHint',
  });

  const missingRequired = items.filter((i) => i.required && !i.satisfied);
  return {
    items,
    missingCount: missingRequired.length,
    canComplete: missingRequired.length === 0,
  };
}
