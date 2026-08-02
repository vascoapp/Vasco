// =============================================================================
// PHRASING STORE — runtime resolution, with gt() as the floor
// =============================================================================
// gtv() is a drop-in for gt(): same signature, same return type. It prefers an
// LLM-authored wording when one has been generated, validated and loaded, and
// otherwise returns exactly what gt() would have.
//
// Three properties this deliberately preserves:
//
//   1. NO NETWORK AT RENDER TIME. Generators run as synchronous hooks inside
//      card renders. A per-render LLM call would put 1-3s of latency in front
//      of every insight and break the offline-first path entirely. Packs are
//      produced out of band and loaded once.
//   2. THE FLOOR NEVER MOVES. Every path — no pack, missing key, missing
//      locale, pack that fails revalidation — ends at gt(). Turning the LLM
//      layer off is deleting a file, not a rollback.
//   3. VALIDATED AGAIN ON LOAD. The generator already validated before writing,
//      but a pack is data: it can be hand-edited or fetched. Trusting it once
//      at build time is the "policies without grants are inert" mistake in the
//      other direction — check at the boundary you actually depend on.
// =============================================================================

import { gt } from '../generatorTranslations';
import type { GeneratorLanguage } from '../generators/types';
import { PHRASING_SPEC_BY_KEY } from './phrasingSpecs';
import bundledPack from './generated/phrasings.json';
import {
  validatePhrasing,
  type PhrasingBundle,
  type PhrasingViolation,
} from './phrasingValidation';

export interface PhrasingPack {
  /** Bumped when the spec contract changes in a way old packs can't satisfy. */
  version: number;
  /** ISO timestamp, for provenance in bug reports. */
  generatedAt: string;
  /** 'anthropic' | 'moonshot' — which provider authored this pack. */
  provider: string;
  entries: Record<string, PhrasingBundle>;
}

export const PHRASING_PACK_VERSION = 1;

let activePack: Record<string, PhrasingBundle> = {};
let activeMeta: { version: number; generatedAt: string; provider: string } | null = null;

export interface LoadResult {
  loaded: number;
  rejected: number;
  violations: PhrasingViolation[];
}

/**
 * Install a pack. Entries that fail revalidation are dropped individually — a
 * single bad wording must not cost the other 53 their improvement, and the
 * dropped key simply keeps its gt() text.
 */
export function loadPhrasingPack(pack: PhrasingPack | null | undefined): LoadResult {
  const result: LoadResult = { loaded: 0, rejected: 0, violations: [] };

  if (!pack || typeof pack !== 'object' || !pack.entries) {
    activePack = {};
    activeMeta = null;
    return result;
  }

  if (pack.version !== PHRASING_PACK_VERSION) {
    // A pack written against a different contract may be missing placeholders
    // the generators now pass. Refuse the whole thing rather than guess.
    activePack = {};
    activeMeta = null;
    result.violations.push({
      key: '*',
      rule: 'pack_version',
      detail: `pack version ${pack.version} != expected ${PHRASING_PACK_VERSION}`,
    });
    result.rejected = Object.keys(pack.entries).length;
    return result;
  }

  const next: Record<string, PhrasingBundle> = {};
  for (const [key, bundle] of Object.entries(pack.entries)) {
    const spec = PHRASING_SPEC_BY_KEY[key];
    if (!spec) {
      // Key not (or no longer) under LLM phrasing — ignore it rather than
      // letting a stale pack widen the blast radius beyond the spec registry.
      result.rejected += 1;
      result.violations.push({ key, rule: 'unknown_key', detail: 'no spec registered for this key' });
      continue;
    }
    const issues = validatePhrasing(spec, bundle);
    if (issues.length > 0) {
      result.rejected += 1;
      result.violations.push(...issues);
      continue;
    }
    next[key] = bundle;
    result.loaded += 1;
  }

  activePack = next;
  activeMeta = { version: pack.version, generatedAt: pack.generatedAt, provider: pack.provider };
  return result;
}

/** Drop all LLM phrasing. Every gtv() call reverts to gt(). */
export function clearPhrasingPack(): void {
  activePack = {};
  activeMeta = null;
}

/** Provenance for diagnostics / the developer hub. */
export function getPhrasingPackMeta(): { version: number; generatedAt: string; provider: string } | null {
  return activeMeta;
}

/** Keys currently served by an LLM wording rather than the built-in table. */
export function getActivePhrasingKeys(): string[] {
  return Object.keys(activePack);
}

// Load the committed pack at module init. It ships empty until someone runs
// `npm run phrasing:generate`, so the default behaviour of the app is exactly
// today's behaviour — every gtv() call resolves through gt(). Auto-loading here
// rather than from a screen keeps generators working in tests and in headless
// contexts, which have no app bootstrap to hook.
loadPhrasingPack(bundledPack as PhrasingPack);

/**
 * gt() with an optional LLM-authored wording in front of it.
 *
 * Interpolation is done here rather than delegated, because the whole point is
 * that the VALUES never travel: they are injected on-device into a template
 * that was authored without ever seeing them.
 */
export function gtv(
  key: string,
  language: GeneratorLanguage,
  params?: Record<string, string | number>,
): string {
  const bundle = activePack[key];
  if (!bundle) return gt(key, language, params);

  const template = bundle[language];
  if (typeof template !== 'string' || template.length === 0) return gt(key, language, params);

  if (!params) return template;

  let text = template;
  for (const [k, v] of Object.entries(params)) {
    text = text.split(`{{${k}}}`).join(String(v));
  }
  return text;
}
