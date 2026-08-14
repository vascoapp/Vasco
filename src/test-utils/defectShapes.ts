// =============================================================================
// DEFECT SHAPES — one list, so every posture is held to the same bar
// =============================================================================
// These regexes lived inside __screenwalk__/detectors.test.tsx and therefore
// only ever ran against DUTCH renders. Every one of them describes a bug that
// is MORE likely in a language the app was not developed in: a device-locale
// date, an English month, a raw i18n key from a lookup that missed, a snake_case
// enum that escaped its label map. Running them in one language is running them
// where they are least likely to fire.
// =============================================================================

export interface DefectShape {
  name: string;
  re: RegExp;
  why: string;
}

export const DEFECT_SHAPES: DefectShape[] = [
  { name: 'ampm-time', re: /\b\d{1,2}:\d{2}\s?[AP]M\b/,
    why: 'device-locale 12-hour clock; EU markets write 24-hour time' },
  { name: 'english-month', re: /\b(January|February|March|April|June|July|August|September|October|November|December)\b|\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b\s*\d/,
    why: 'device-locale date; use formatDate(date, country)' },
  { name: 'english-weekday', re: /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/,
    why: 'device-locale date; use formatDate(date, country)' },
  { name: 'raw-i18n-key', re: /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+){1,5}$/,
    why: 'an i18next key rendered verbatim — the lookup missed' },
  { name: 'i18n-object-error', re: /returned an object instead of string/,
    why: 't() pointed at a namespace object, not a leaf key' },
  { name: 'nan-undefined', re: /\b(NaN|undefined|Invalid Date|\[object Object\])\b/,
    why: 'a value that should never reach a label' },
  { name: 'snake-enum', re: /^[a-z]+(_[a-z]+)+$/,
    why: 'a snake_case enum that escaped its label map' },
  { name: 'dollar-in-eu', re: /\$\s?\d/,
    why: 'US currency on a EU screen; use formatCurrency(amount, country)' },
];

/** Domain enums that leak as display text, matched whole or as a ' · ' segment. */
export const RAW_ENUMS = new Set([
  'completed', 'in-progress', 'in_progress', 'accepted', 'overdue', 'draft', 'paid',
  'sent', 'quoted', 'cancelled', 'canceled', 'rejected', 'expired', 'on-hold',
  'on_hold', 'approved', 'submitted', 'declined',
]);

export interface ShapeHit { screen: string; detector: string; text: string }

/** Run every shape over one screen's rendered strings. */
export function findDefectShapes(screen: string, texts: string[]): ShapeHit[] {
  const hits: ShapeHit[] = [];
  for (const text of texts) {
    for (const d of DEFECT_SHAPES) {
      if (d.re.test(text)) hits.push({ screen, detector: d.name, text });
    }
    for (const seg of text.split(/\s*[·|,]\s*/)) {
      if (RAW_ENUMS.has(seg.trim().toLowerCase())) {
        hits.push({ screen, detector: 'raw-enum', text });
        break;
      }
    }
  }
  return hits;
}
