#!/usr/bin/env node
/**
 * Pre-submission validator for fastlane/metadata/.
 *
 * R66r71. Catches ASC field-length violations BEFORE fastlane deliver
 * runs and Apple rejects with ERROR ITMS-90000 etc.
 *
 * Field length limits (Apple + Google):
 *   App Store Connect:
 *     - name              30
 *     - subtitle          30
 *     - keywords         100  (comma-separated, total chars including commas)
 *     - description     4000
 *     - promotional_text 170
 *     - release_notes   4000
 *   Play Console:
 *     - title             50
 *     - short_description 80
 *     - full_description 4000
 *     - changelog       500  (per Play; Apple equivalent is release_notes)
 *
 * Run:
 *   npm run check:listings
 *
 * Exits non-zero if any violation found. Use in CI before `fastlane deliver`.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

const ASC_LIMITS = {
  'name.txt': 30,
  'subtitle.txt': 30,
  'keywords.txt': 100,
  'description.txt': 4000,
  'promotional_text.txt': 170,
  'release_notes.txt': 4000,
};

const PLAY_LIMITS = {
  'title.txt': 50,
  'short_description.txt': 80,
  'full_description.txt': 4000,
};

const ASC_REQUIRED = Object.keys(ASC_LIMITS).concat([
  'support_url.txt', 'marketing_url.txt', 'privacy_url.txt',
]);
const PLAY_REQUIRED = Object.keys(PLAY_LIMITS);

const ASC_LOCALES = ['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'es-ES', 'it'];
// Play keeps "it-IT"; Apple's code for Italian is plain "it".
const PLAY_LOCALES = ['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'es-ES', 'it-IT'];

let errors = 0;
let warnings = 0;

function error(msg) {
  console.error(`  ✗ ${msg}`);
  errors++;
}
function warn(msg) {
  console.warn(`  ⚠ ${msg}`);
  warnings++;
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function trimTrailingNewline(s) {
  return s.replace(/\n+$/, '');
}

function checkFile(path, limit) {
  if (!existsSync(path)) {
    error(`MISSING ${path.replace(repoRoot + '/', '')}`);
    return;
  }
  const content = trimTrailingNewline(readFileSync(path, 'utf8'));
  const len = content.length;
  if (limit && len > limit) {
    error(`OVER LIMIT (${len}/${limit}) ${path.replace(repoRoot + '/', '')}`);
  } else if (len === 0) {
    error(`EMPTY ${path.replace(repoRoot + '/', '')}`);
  } else {
    const occupancy = limit ? `${len}/${limit}` : `${len} chars`;
    ok(`${path.replace(repoRoot + '/', '')} (${occupancy})`);
  }

  // Sanity check: trailing whitespace on URL fields
  if (path.endsWith('_url.txt') && (content.startsWith('http') === false)) {
    warn(`${path.replace(repoRoot + '/', '')} doesn't start with http`);
  }
}

console.log('═══════════════════════════════════════════════════');
console.log('  App Store Connect — iOS metadata');
console.log('═══════════════════════════════════════════════════');

for (const loc of ASC_LOCALES) {
  console.log(`\n— ${loc} —`);
  const dir = join(repoRoot, 'fastlane/metadata', loc);
  if (!existsSync(dir)) {
    error(`MISSING DIR fastlane/metadata/${loc}/`);
    continue;
  }
  for (const filename of ASC_REQUIRED) {
    checkFile(join(dir, filename), ASC_LIMITS[filename]);
  }
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  Play Console — Android metadata');
console.log('═══════════════════════════════════════════════════');

for (const loc of PLAY_LOCALES) {
  console.log(`\n— ${loc} —`);
  const dir = join(repoRoot, 'fastlane/metadata/android', loc);
  if (!existsSync(dir)) {
    error(`MISSING DIR fastlane/metadata/android/${loc}/`);
    continue;
  }
  for (const filename of PLAY_REQUIRED) {
    checkFile(join(dir, filename), PLAY_LIMITS[filename]);
  }
  // Changelog check
  const changelogDir = join(dir, 'changelogs');
  if (!existsSync(changelogDir)) {
    error(`MISSING fastlane/metadata/android/${loc}/changelogs/`);
  } else {
    const files = readdirSync(changelogDir).filter((f) => /^\d+\.txt$/.test(f));
    if (files.length === 0) {
      error(`NO CHANGELOG FILES in fastlane/metadata/android/${loc}/changelogs/`);
    } else {
      for (const f of files) {
        const path = join(changelogDir, f);
        const content = trimTrailingNewline(readFileSync(path, 'utf8'));
        if (content.length > 500) {
          error(`OVER LIMIT (${content.length}/500) fastlane/metadata/android/${loc}/changelogs/${f}`);
        } else {
          ok(`changelogs/${f} (${content.length}/500)`);
        }
      }
    }
  }
  // Feature graphic
  const fg = join(dir, 'images/featureGraphic/featureGraphic.png');
  if (!existsSync(fg)) {
    warn(`MISSING featureGraphic.png in ${loc} (run \`npm run render:icons\`)`);
  } else {
    ok('featureGraphic.png present');
  }
}

console.log('\n═══════════════════════════════════════════════════');
console.log('  Top-level metadata');
console.log('═══════════════════════════════════════════════════');

for (const f of ['copyright.txt', 'primary_category.txt']) {
  checkFile(join(repoRoot, 'fastlane/metadata', f), null);
}

console.log('\n— review_information —');
for (const f of ['first_name.txt', 'last_name.txt', 'phone_number.txt', 'email_address.txt',
                  'demo_user.txt', 'notes.txt']) {
  const path = join(repoRoot, 'fastlane/metadata/review_information', f);
  checkFile(path, null);
  const content = existsSync(path) ? trimTrailingNewline(readFileSync(path, 'utf8')) : '';
  // Flag known placeholders
  if (f === 'first_name.txt' && content === 'Merle') warn(`review_information/first_name.txt is placeholder "Merle"`);
  if (f === 'last_name.txt' && content === 'Slendebroek') warn(`review_information/last_name.txt is placeholder "Slendebroek"`);
  if (f === 'phone_number.txt' && content === '+31000000000') warn(`review_information/phone_number.txt is placeholder +31000000000`);
}

// ── honesty + reviewer login (2026-10-09) ───────────────────────────────────
// The App Store fields fastlane uploads advertised AI, an "EVE" agent, photo
// scanning and a demo screen the shipping build does not have, and named
// accounting tools nothing in the app connects to. Same rules as the Play
// copy (scripts/check-store-listing.mjs): scan every uploaded text field.
{
  const { readFileSync: rf, existsSync: ex } = await import('node:fs');
  const DARK = /\b(AI|K\.?I\.?|EVE|kunstmatige intelligentie|intelligence artificielle|intelligenza artificiale|inteligencia artificial|foto[- ]?scan|photo[- ]?to|Beleg-Scanner|demo|DATEV|Lexoffice|SevDesk|Pennylane|Holded|Fatture in Cloud|Xero|QuickBooks|TicketBAI|Verifactu|Chorus|end-to-end|Ende-zu-Ende)\b/i;
  const FIELDS = ['name.txt', 'subtitle.txt', 'promotional_text.txt', 'description.txt', 'keywords.txt', 'release_notes.txt'];
  console.log('\n— no claims the live build cannot keep —');
  for (const loc of ['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'es-ES', 'it']) {
    for (const f of FIELDS) {
      const path = join(repoRoot, 'fastlane/metadata', loc, f);
      if (!ex(path)) continue;
      const hit = rf(path, 'utf8').match(DARK);
      if (hit) error(`${loc}/${f} claims "${hit[0]}" — dark in production or not connectable`);
    }
  }
  // German store copy is Sie (CLAUDE.md): no du/dein/deine.
  const de = FIELDS.map((f) => { try { return rf(join(repoRoot, 'fastlane/metadata/de-DE', f), 'utf8'); } catch { return ''; } }).join('\n');
  const du = de.match(/\b(du|dich|dir|dein|deine|deinen|deiner|tippe|bestätigst)\b/i);
  if (du) error(`de-DE uses "${du[0]}" — German store copy is Sie`);
  // The reviewer's password is NOT committed: the upload reads it from secrets/.
  // secrets/ is gitignored, so CI never has it — the upload runs on the Mac.
  if (!ex(join(repoRoot, 'secrets/reviewer-account.txt'))) (process.env.CI ? warn : error)('secrets/reviewer-account.txt missing — App Review needs the sign-in password');
  else ok('reviewer password present in secrets/ (not in fastlane/metadata)');
}

console.log();
if (errors > 0) {
  console.error(`✗ check-asc-listing FAILED: ${errors} error(s), ${warnings} warning(s).`);
  process.exit(1);
}
if (warnings > 0) {
  console.log(`⚠ check-asc-listing passed with ${warnings} warning(s).`);
} else {
  console.log('✓ check-asc-listing clean — ready for fastlane deliver / supply.');
}
