/**
 * @jest-environment node
 *
 * The law you cite has to be the reader's law.
 *
 * Every locale cited the DUTCH statute — "art. 7:755 BW" — when telling a
 * German, French, Spanish or Italian contractor that extra work must be
 * flagged before it can be billed (#339). The RULE is right in each market;
 * the citation was not, and in FR/ES the requirement is stricter (written
 * authorisation on a fixed-price contract).
 */
import fs from 'fs';
import path from 'path';
import { extraWorkStatute, statuteSuffix, EXTRA_WORK_STATUTE } from '../extraWorkLaw';

const ROOT = path.resolve(__dirname, '../../..');
const LOCALES = ['de', 'en', 'en-US', 'nl', 'fr', 'es', 'it'];

describe('extraWorkStatute', () => {
  it('gives each market its own statute', () => {
    expect(extraWorkStatute('NL')).toBe('art. 7:755 BW');
    expect(extraWorkStatute('DE')).toBe('§ 650b/650c BGB');
    expect(extraWorkStatute('FR')).toBe('art. 1793 C. civ.');
    expect(extraWorkStatute('ES')).toBe('art. 1593 CC');
    expect(extraWorkStatute('IT')).toBe('art. 1659 c.c.');
  });

  it('invents nothing where there is no statute', () => {
    expect(extraWorkStatute('UK')).toBeNull();
    expect(extraWorkStatute('US')).toBeNull();
    expect(extraWorkStatute(undefined)).toBeNull();
    expect(statuteSuffix('UK')).toBe('');
    expect(statuteSuffix(null)).toBe('');
  });

  it('formats the suffix so the sentence reads either way', () => {
    expect(statuteSuffix('DE')).toBe(' (§ 650b/650c BGB)');
  });

  it('covers every market the app ships to', () => {
    expect(Object.keys(EXTRA_WORK_STATUTE).sort()).toEqual(['DE', 'ES', 'FR', 'IT', 'NL', 'UK', 'US']);
  });
});

describe('the copy no longer hardcodes one country\'s law', () => {
  it.each(LOCALES)('%s uses the {{statute}} slot, not art. 7:755 BW', (loc) => {
    const raw = fs.readFileSync(path.join(ROOT, `src/i18n/locales/${loc}.json`), 'utf8');
    expect(raw).not.toMatch(/7:755/);
    const j = JSON.parse(raw);
    const body = j.decisions?.recordWarningBody;
    if (body) expect(body).toMatch(/\{\{statute\}\}/);
    const hint = j.projectBilling?.warningMissingHint;
    if (hint) expect(hint).toMatch(/\{\{statute\}\}/);
  });

  it('both render sites fill the slot', () => {
    // stripComments: a comment mentioning `statute: statuteSuffix(` satisfied
    // this while the sentence printed the raw {{statute}} slot.
    const { stripComments } = require('../../utils/stripComments');
    for (const rel of ['app/(contractor)/decisions.tsx', 'app/contractor/project-billing/[id].tsx']) {
      const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      expect(src).toMatch(/statute:\s*statuteSuffix\(/);
    }
  });
});

describe('the screens read the statute country profile-first', () => {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '../../..');
  const screens = ['app/(contractor)/decisions.tsx', 'app/contractor/project-billing/[id].tsx'];

  // `user?.country ?? 'NL'` cited "art. 7:755 BW" at a German contractor whose
  // profile says DE (#218: the profile outranks the account), and invented the
  // Dutch statute for an account with no country at all — the citation sits
  // beside a warning the contractor shows their customer.
  it.each(screens)('%s prefers businessProfile.country and does not default to NL', (rel) => {
    const { stripComments } = require('../../utils/stripComments');
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const at = src.indexOf('const country =');
    expect(at).toBeGreaterThan(-1);
    const end = src.indexOf(';', at);
    expect(end).toBeGreaterThan(at);
    const decl = src.slice(at, end);
    expect(decl).toMatch(/businessProfile\.country/);
    // `??` AND `||`, single or double quotes: `businessProfile.country ??
    // user?.country || 'NL'` would have passed the first version.
    expect(decl).not.toMatch(/(\?\?|\|\|)\s*['"]NL['"]/);
  });
});

