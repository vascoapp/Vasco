/**
 * @jest-environment node
 */
// Decisions the user made on 2026-09-17, pinned so they cannot drift back in
// silently. Each one was a live defect on the contractor's main sales surface.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const LOCALES = ['de', 'en', 'nl', 'fr', 'es', 'it'];
const locale = (l: string) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l}.json`), 'utf8'));

describe('a package quotes the contractor own price', () => {
  it('every tier multiplier is 1', () => {
    const src = read('src/services/quoteTierPresetService.ts');
    const line = /TIER_MULTIPLIER[^=]*=\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
    expect(line).toMatch(/good:\s*1\b/);
    expect(line).toMatch(/better:\s*1\b/);
    expect(line).toMatch(/best:\s*1\b/);
    expect(line).not.toMatch(/1\.\d/);
  });
});

describe('no statutory right is sold as a feature', () => {
  it('no tier feature string in any locale mentions a warranty', () => {
    for (const l of LOCALES) {
      const quotes = locale(l).quotes ?? {};
      for (const [key, value] of Object.entries(quotes)) {
        if (!/^tier(Good|Better|Best)Feature/.test(key)) continue;
        expect(`${l}.${key}: ${value}`).not.toMatch(/warrant|garant|gewährleistung/i);
      }
    }
  });

  it('presets saved before the decision are stripped on load', () => {
    const src = read('src/services/quoteTierPresetService.ts');
    expect(src).toMatch(/isLegacyWarrantyFeature/);
    // The cleaner has to run inside the merge path, not just be defined.
    const at = src.indexOf('function cleanPreset');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, src.indexOf('\n}', at))).toMatch(/isLegacyWarrantyFeature/);
  });
});

describe('the audit trail describes itself instead of claiming conformity', () => {
  it('no locale says GoBD-konform / GoBD-compliant', () => {
    for (const l of LOCALES) {
      const value = locale(l).profile?.auditTrailValueGobd;
      expect(`${l}: ${value}`).not.toMatch(/gobd[- ]?(konform|compliant|conforme)/i);
    }
  });

  it('the screen does not hardcode the claim either', () => {
    expect(read('app/contractor/profile.tsx')).not.toMatch(/'GoBD-compliant'|'GoBD-konform'/);
  });
});
