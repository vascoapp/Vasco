#!/usr/bin/env node
/**
 * Render Vasco icon SVGs → PNGs at the sizes Expo / Apple / Android expect.
 *
 * R66r67. Author SVGs once in `assets/source/`, run this script, the PNGs
 * land in `assets/` ready for `eas build`. Brand team can replace the
 * SVG sources later; re-running this script overwrites the PNGs.
 *
 * Requirements:
 *   npm i -D sharp
 *
 * Usage:
 *   node scripts/render-icons.mjs
 *
 * Outputs:
 *   assets/icon.png           (1024×1024, solid bg — iOS app icon)
 *   assets/adaptive-icon.png  (1024×1024, transparent — Android adaptive foreground)
 *   assets/splash-icon.png    (1242×2436 centered on transparent bg — splash)
 *   assets/favicon.png        (192×192 — web favicon)
 *
 * If `sharp` isn't installed, prints install instructions and exits 1.
 * Designed so it's safe to run multiple times — PNGs are deterministic.
 */

import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');
const sourceDir = join(repoRoot, 'assets', 'source');
const outputDir = join(repoRoot, 'assets');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error(`
✗ sharp is not installed.

Install it as a dev dependency:
  npm i -D sharp

Then re-run:
  node scripts/render-icons.mjs

Why a separate dependency: Expo doesn't include image-processing tools, and
the project's prod bundle should NOT ship sharp. Keeping it dev-only.
`);
  process.exit(1);
}

/**
 * @param {string} sourceFile
 * @param {string} outFile
 * @param {{ width: number; height: number; flatten?: string }} opts
 */
async function render(sourceFile, outFile, opts) {
  const svg = readFileSync(join(sourceDir, sourceFile));
  let pipeline = sharp(svg, { density: 384 })
    .resize(opts.width, opts.height, {
      fit: 'contain',
      background: opts.flatten ?? { r: 0, g: 0, b: 0, alpha: 0 },
    });

  // iOS does not allow alpha on the app icon. Flatten onto the DK bg
  // so the alpha channel disappears.
  if (opts.flatten) {
    pipeline = pipeline.flatten({ background: opts.flatten });
  }

  const buf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(outputDir, outFile), buf);
  console.log(`✓ ${outFile} (${opts.width}×${opts.height})`);
}

console.log('Rendering Vasco icons…\n');

await render('icon-ios.svg', 'icon.png', {
  width: 1024,
  height: 1024,
  // iOS app icon — flatten to DK bg, kill alpha. Apple rejects icons with
  // transparency.
  flatten: '#0B0E11',
});

await render('adaptive-foreground.svg', 'adaptive-icon.png', {
  width: 1024,
  height: 1024,
  // Android adaptive foreground — keep transparent bg so the system
  // backgroundColor (set in app.json) shows through and OEM masks apply
  // cleanly to the foreground content only.
});

await render('splash-mark.svg', 'splash-icon.png', {
  width: 1242,
  height: 2436,
  // Splash mark — transparent bg, expo-splash-screen plugin centers it on
  // the configured backgroundColor (#0B0E11).
});

await render('favicon.svg', 'favicon.png', {
  width: 192,
  height: 192,
  // Favicon — solid bg already in the SVG.
});

// R66r69: Play Store feature graphic (1024×500). Flatten — Play
// rejects transparent feature graphics. Mirror into each per-locale
// fastlane/metadata/android/{locale}/images/featureGraphic/ dir so
// `fastlane android release` picks them up automatically.
const featureGraphicBuf = await sharp(readFileSync(join(sourceDir, 'feature-graphic.svg')), {
  density: 200,
})
  .resize(1024, 500, { fit: 'contain', background: '#0B0E11' })
  .flatten({ background: '#0B0E11' })
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(join(outputDir, 'feature-graphic.png'), featureGraphicBuf);
console.log('✓ feature-graphic.png (1024×500)');

const { mkdir } = await import('node:fs/promises');
const playLocales = ['en-US', 'nl-NL', 'de-DE', 'fr-FR', 'es-ES', 'it-IT'];
for (const loc of playLocales) {
  const dir = join(repoRoot, 'fastlane/metadata/android', loc, 'images/featureGraphic');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'featureGraphic.png'), featureGraphicBuf);
}
console.log(`✓ feature graphic copied into ${playLocales.length} fastlane/metadata/android/{locale}/ dirs`);

console.log(`
✓ Done. Run \`eas build --profile preview --platform ios\` to bundle.

Reminder: these are R66r67/r69 placeholders. Replace the SVGs in
assets/source/ with brand-team final art and re-run this script.
Don't edit the PNG outputs by hand — they'll regenerate on next run.
`);
