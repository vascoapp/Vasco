#!/usr/bin/env node
/* eslint-disable */
// Compare all locale JSON files against en.json. Reports:
//   - keys missing in each locale
//   - keys present in other locales but not in en (dead / drifted)
// Exits 1 if any locale is missing more than 5% of keys.

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");
const BASE = "en";
const LOCALES = ["en", "nl", "de", "fr", "es", "it"];

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

const flats = {};
for (const lc of LOCALES) {
  const p = path.join(LOCALES_DIR, `${lc}.json`);
  if (!fs.existsSync(p)) {
    console.error(`Missing locale file: ${p}`);
    process.exit(1);
  }
  flats[lc] = flatten(JSON.parse(fs.readFileSync(p, "utf8")));
}

const baseKeys = new Set(Object.keys(flats[BASE]));
let failed = false;

console.log(`# i18n audit\n\nBase locale: ${BASE} (${baseKeys.size} keys)\n`);

for (const lc of LOCALES) {
  if (lc === BASE) continue;
  const lcKeys = new Set(Object.keys(flats[lc]));
  const missing = [...baseKeys].filter((k) => !lcKeys.has(k));
  const extra = [...lcKeys].filter((k) => !baseKeys.has(k));
  const pctMissing = (missing.length / baseKeys.size) * 100;
  const status = pctMissing > 5 ? "❌" : pctMissing > 1 ? "⚠️" : "✅";
  console.log(
    `${status} ${lc.toUpperCase()} — ${missing.length} missing (${pctMissing.toFixed(1)}%), ${extra.length} extra`,
  );
  if (missing.length > 0 && missing.length <= 25) {
    for (const m of missing.slice(0, 25)) console.log(`   · missing: ${m}`);
  } else if (missing.length > 25) {
    console.log(`   · first 25 missing: ${missing.slice(0, 25).join(", ")}`);
    console.log(`   · …and ${missing.length - 25} more`);
  }
  if (pctMissing > 5) failed = true;
}

process.exit(failed ? 1 : 0);
