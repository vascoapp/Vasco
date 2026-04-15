// =============================================================================
// JOB COMPLETION CHECKLIST
// =============================================================================
// Per-trade requirements that must be satisfied before a job can be marked
// `completed`. Keeps contractors compliant (gas certs, before/after photos)
// and customers happy (handover notes).
// =============================================================================

import type { Job } from '../types/contractor';
import type { JobPhotoRecord, PhotoKind } from './jobPhotoService';

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
  label: string;
  required: boolean;
  satisfied: boolean;
  hint?: string;
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
  hasGasCert?: boolean;
  hasElectricalTest?: boolean;
  hasWasteNote?: boolean;
  hasWarrantyInfo?: boolean;
}

function hasPhotoKind(photos: JobPhotoRecord[], kind: PhotoKind): boolean {
  return photos.some((p) => p.kind === kind);
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
    required: needsVisualEvidence,
    satisfied: hasPhotoKind(ctx.photos, 'before'),
  });
  items.push({
    id: 'after_photo',
    label: 'After photo',
    required: needsVisualEvidence,
    satisfied: hasPhotoKind(ctx.photos, 'after'),
  });
  items.push({
    id: 'handover_photo',
    label: 'Handover photo',
    required: false,
    satisfied: hasPhotoKind(ctx.photos, 'handover'),
  });

  // Regulated trades — compliance paperwork
  if (trade === 'gas' || trade === 'plumbing') {
    items.push({
      id: 'gas_certificate',
      label: 'Gas safety / CW certificate',
      required: trade === 'gas',
      satisfied: Boolean(ctx.hasGasCert),
      hint: 'Upload Gaskeur / CW-attest before closing the job',
    });
  }
  if (trade === 'electrical') {
    items.push({
      id: 'electrical_test',
      label: 'Electrical test report',
      required: true,
      satisfied: Boolean(ctx.hasElectricalTest),
      hint: 'NEN 1010 / EICR report is required for handover',
    });
  }

  // Waste note for any trade that moves construction debris
  if (['roofing', 'tiling', 'plastering', 'flooring', 'carpentry'].includes(trade)) {
    items.push({
      id: 'waste_disposal_note',
      label: 'Waste disposal note',
      required: false,
      satisfied: Boolean(ctx.hasWasteNote),
    });
  }

  items.push({
    id: 'warranty_info',
    label: 'Warranty information sent',
    required: false,
    satisfied: Boolean(ctx.hasWarrantyInfo),
  });

  items.push({
    id: 'customer_signoff',
    label: 'Customer sign-off',
    required: true,
    satisfied: Boolean(ctx.signedOff),
    hint: 'Capture a digital signature to close the job',
  });

  const missingRequired = items.filter((i) => i.required && !i.satisfied);
  return {
    items,
    missingCount: missingRequired.length,
    canComplete: missingRequired.length === 0,
  };
}
