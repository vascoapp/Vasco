/**
 * Detectors — the ratchet.
 *
 * Mounts every contractor/aannemer screen in Dutch and asserts that nothing a
 * contractor reads matches a known defect shape. Each detector encodes a bug
 * class this codebase has actually shipped, so a new instance fails here
 * instead of waiting for someone to notice it on a device.
 *
 * KNOWN holds the violations that exist today. The list is the finding list:
 * delete an entry when the bug is fixed. Anything NOT in KNOWN fails the build.
 *
 * Why this catches what a simulator walk does not: node's default locale is
 * en-US, so the harness runs the configuration that actually exposes
 * device-locale formatting — a Dutch contractor holding an English phone. On a
 * nl-NL simulator every `toLocaleDateString(undefined)` renders Dutch and the
 * bug is invisible.
 */
import path from 'path';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { APP_DIR, PARAMS, listScreens, routeId } from './screens';

interface Violation { screen: string; detector: string; text: string }

const DETECTORS: { name: string; re: RegExp; why: string }[] = [
  { name: 'ampm-time', re: /\b\d{1,2}:\d{2}\s?[AP]M\b/,
    why: 'device-locale 12-hour clock; EU markets write 24-hour time' },
  { name: 'english-month', re: /\b(January|February|March|April|June|July|August|September|October|November|December)\b|\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b\s*\d/,
    why: 'device-locale date; use formatDate(date, country)' },
  { name: 'english-weekday', re: /\b(Monday|Tuesday|Wednesday|Thursday|Thursday|Friday|Saturday|Sunday)\b/,
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
const ENUMS = new Set([
  'completed', 'in-progress', 'in_progress', 'accepted', 'overdue', 'draft', 'paid',
  'sent', 'quoted', 'cancelled', 'canceled', 'rejected', 'expired', 'on-hold',
  'on_hold', 'approved', 'submitted', 'declined',
]);

const POSTURE = process.env.WALK_POSTURE === 'fresh' ? 'fresh' : 'demo';

/**
 * Violations present today, in BOTH postures. Format: `screen :: detector`.
 * Each is a real defect — see the walk write-up. Remove the entry on fix.
 */
const KNOWN = new Set<string>([
  // Empty. `legal.tsx :: english-month` lived here — LAST_UPDATED was the
  // literal 'March 2026', rendered verbatim to German, French, Spanish and
  // Italian readers. Now stored as a date and formatted in the ACTIVE language,
  // so the entry went stale and the check below caught it, which is exactly
  // what this list is for.
]);

/**
 * Violations that need data to surface, so they only fire in one posture.
 * Empty in both today — kept because the postures genuinely reach different
 * branches (the quote-acceptance error path, for one, needs an empty backend).
 */
const KNOWN_BY_POSTURE: Record<string, string[]> = {
  demo: [],
  fresh: [],
};
KNOWN_BY_POSTURE[POSTURE].forEach((k) => KNOWN.add(k));

describe('screen detectors', () => {
  const screens = listScreens();
  const violations: Violation[] = [];

  it('finds no unknown defect shapes on any contractor screen', async () => {
    for (const rel of screens) {
      const id = routeId(rel);
      let Screen: any;
      try {
        Screen = require(path.join(APP_DIR, rel)).default;
      } catch {
        continue;
      }
      if (typeof Screen !== 'function') continue;

      const r = await walkScreen(Screen, { params: PARAMS[id] ?? {} });
      for (const text of [...r.texts, ...r.a11yLabels]) {
        for (const d of DETECTORS) {
          if (d.re.test(text)) violations.push({ screen: id, detector: d.name, text });
        }
        for (const seg of text.split(/\s*[·|,]\s*/)) {
          if (ENUMS.has(seg.trim().toLowerCase())) {
            violations.push({ screen: id, detector: 'raw-enum', text });
            break;
          }
        }
      }
      teardown(r);
    }

    const unknown = violations.filter((v) => !KNOWN.has(`${v.screen} :: ${v.detector}`));
    if (unknown.length) {
      const detail = unknown
        .map((v) => {
          const why = DETECTORS.find((d) => d.name === v.detector)?.why ?? 'raw domain enum rendered as a label';
          return `  ${v.screen}\n    [${v.detector}] ${JSON.stringify(v.text.slice(0, 120))}\n    -> ${why}`;
        })
        .join('\n');
      throw new Error(`${unknown.length} new screen defect(s):\n${detail}`);
    }

    // Keep KNOWN honest: an entry that no longer fires has been fixed and must
    // be deleted, or it silently stops protecting anything.
    const fired = new Set(violations.map((v) => `${v.screen} :: ${v.detector}`));
    const stale = [...KNOWN].filter((k) => !fired.has(k));
    expect(stale).toEqual([]);
  }, 900_000);
});
