// =============================================================================
// docs/play-store-listing.md → the files fastlane UPLOADS, for both stores.
// =============================================================================
// The doc is the copy `npm run check:listing` verifies against production
// (no dark features, no integration without a connect flow). fastlane reads
// fastlane/metadata/** — which had drifted: on 2026-10-09 both the iOS
// description and the Play full description still promised AI, photo
// scanning, "end-to-end encryption" and nine accounting integrations, while
// the checked doc did not. This writes the doc into those files; the check
// then fails if they ever differ again.
//
//   node scripts/sync-store-copy.mjs
// =============================================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const STORE_LOCALES = { en: 'en-US', nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };

/** The doc's text as a store shows it: plain text, no markdown. */
export function plain(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').trim() + '\n';
}

export function readListing(src = readFileSync(join(ROOT, 'docs/play-store-listing.md'), 'utf8')) {
  const shorts = {}, fulls = {};
  for (const m of src.matchAll(/^\|\s*\*\*(en|nl|de|fr|es|it)\*\*\s*\|\s*(.+?)\s*\|\s*$/gm)) shorts[m[1]] = m[2];
  for (const loc of Object.keys(STORE_LOCALES)) {
    const m = new RegExp(`\\n### ${loc}\\n([\\s\\S]*?)(?=\\n### |\\n---)`).exec(src);
    if (m) fulls[loc] = m[1].trim();
  }
  return { shorts, fulls };
}

/** Every file fastlane uploads that must carry the doc's text. */
export function targets() {
  const { shorts, fulls } = readListing();
  const out = [];
  for (const [loc, dir] of Object.entries(STORE_LOCALES)) {
    if (!fulls[loc] || !shorts[loc]) throw new Error(`docs/play-store-listing.md: no ${loc} copy`);
    // App Store locale codes differ from Play's for Italian ("it", not "it-IT").
    const asc = loc === 'it' ? 'it' : dir;
    out.push([`fastlane/metadata/${asc}/description.txt`, plain(fulls[loc])]);               // App Store
    out.push([`fastlane/metadata/android/${dir}/full_description.txt`, plain(fulls[loc])]);   // Play
    out.push([`fastlane/metadata/android/${dir}/short_description.txt`, plain(shorts[loc])]); // Play
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [rel, text] of targets()) writeFileSync(join(ROOT, rel), text);
  console.log(`synced ${targets().length} store files from docs/play-store-listing.md`);
}
