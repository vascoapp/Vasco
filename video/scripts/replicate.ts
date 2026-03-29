#!/usr/bin/env tsx
// =============================================================================
// MULTI-LANGUAGE REPLICATOR — Auto-generate 6 language variants
// =============================================================================
// Takes a video script and generates versions for all 6 EU markets.
// Used when a HIT video is detected in one pod and needs replication.
//
// Usage:
//   npx tsx scripts/replicate.ts --template did-you-know --trade plumbing
//   npx tsx scripts/replicate.ts --template all --trade solar
// =============================================================================

import { generateScripts, type GenerateOptions } from './generate';
import { COUNTRIES, type Language, type Trade } from '../src/data/trades';
import * as fs from 'fs';
import * as path from 'path';

const LANGUAGES: Language[] = ['EN', 'NL', 'DE', 'FR', 'ES', 'IT'];

if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

  const template = (getArg('--template') ?? 'all') as GenerateOptions['template'];
  const trade = (getArg('--trade') ?? 'plumbing') as Trade;
  const outputDir = getArg('--out') ?? 'out/replicated';

  console.log(`\n🌍 Replicating "${template}" for trade "${trade}" across ${LANGUAGES.length} languages\n`);

  const outPath = path.resolve(__dirname, '..', outputDir);
  fs.mkdirSync(outPath, { recursive: true });

  let totalScripts = 0;

  for (const lang of LANGUAGES) {
    const country = COUNTRIES.find(c => c.code === lang);
    console.log(`  ${country?.flag ?? '🏳️'} ${lang} — generating...`);

    const scripts = generateScripts({ template, trade, language: lang });

    for (const script of scripts) {
      const filePath = path.join(outPath, `${script.outputFilename.replace('.mp4', '.json')}`);
      fs.writeFileSync(filePath, JSON.stringify(script, null, 2));
      console.log(`    ✅ ${script.templateId} → ${script.outputFilename}`);
      totalScripts++;
    }
  }

  console.log(`\n📦 ${totalScripts} scripts generated across ${LANGUAGES.length} languages`);
  console.log(`   Output: ${outPath}/`);
  console.log(`\nTo render all:`);
  console.log(`   for f in ${outputDir}/*.json; do`);
  console.log(`     name=$(basename "$f" .json)`);
  console.log(`     npx remotion render Root $(cat "$f" | node -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).templateId") "out/$name.mp4" --props="$f"`);
  console.log(`   done`);
}
