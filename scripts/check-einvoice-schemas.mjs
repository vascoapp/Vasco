#!/usr/bin/env node
// The OFFICIAL schemas for Italy (FatturaPA, Agenzia delle Entrate) and Spain
// (Facturae 3.2.2), over invoices built EXACTLY as the invoice screen builds
// them (scripts/einvoice-schema-samples.ts). First run 2026-10-01: every
// Italian invoice with a due date was schema-invalid (SDI 00200), and a
// self-employed Spanish seller had no FirstSurname.
//
// Italy is checked against BOTH 1.2.2 and the current VFPR12 1.2.3 (in force
// since 1 April 2025, Allegato A 1.9 — the schema SDI applies to FPR12 today).
//
// Schema validity is the FIRST gate only. The second — SDI's and FACe's VALUE
// rules (Elenco controlli v2.0, Orden HAP/1650/2015 Anexo II) — runs right
// after: scripts/check-einvoice-rules.ts (also `npm run check:einvoice-rules`).
//
// A sample the samples script lists in expected.json with code 00200 is a
// deliberate schema refusal (e.g. an emoji in a line description): xmllint
// MUST reject it, which also proves the on-device 00200 check agrees with the
// real schema.
//
// Needs xmllint (macOS: built in). Schemas cached in ~/.cache/vasco-einvoice-xsd.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const SCHEMAS = {
  "fatturapa-1.2.2.xsd": "https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_v1.2.2.xsd",
  "fatturapa-vfpr12-1.2.3.xsd": "https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.4/Schema_VFPR12_v1.2.3.xsd",
  "facturae-3.2.2.xsd": "https://www.facturae.gob.es/content/dam/facturae/formato/versiones/Facturaev3_2_2.xml",
  "xmldsig-core-schema.xsd": "https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd",
};
const cache = path.join(homedir(), ".cache", "vasco-einvoice-xsd");
mkdirSync(cache, { recursive: true });
for (const [file, url] of Object.entries(SCHEMAS)) {
  const p = path.join(cache, file);
  if (existsSync(p)) continue;
  execFileSync("curl", ["-sSfL", "-A", "Mozilla/5.0", "-o", p, url], { stdio: "inherit" });
  // All import the W3C signature schema by URL; validate offline against our copy.
  writeFileSync(p, readFileSync(p, "utf8").replace(/schemaLocation="http[^"]*xmldsig-core-schema\.xsd"/g, 'schemaLocation="xmldsig-core-schema.xsd"'));
}

const work = path.join(tmpdir(), `vasco-xsd-${Date.now()}`);
mkdirSync(work, { recursive: true });
execFileSync("npx", ["tsx", "scripts/einvoice-schema-samples.ts", work], { stdio: "inherit" });
const expected = JSON.parse(readFileSync(path.join(work, "expected.json"), "utf8"));

let failed = 0;
const files = readdirSync(work).filter((f) => f.endsWith(".xml")).sort();
if (files.length === 0) { console.error("❌ no samples were written"); process.exit(1); }
for (const f of files) {
  const schemas = f.startsWith("it-") ? ["fatturapa-1.2.2.xsd", "fatturapa-vfpr12-1.2.3.xsd"] : ["facturae-3.2.2.xsd"];
  const mustFail = (expected[f] ?? []).includes("00200");
  for (const s of schemas) {
    let errors = "";
    try {
      execFileSync("xmllint", ["--noout", "--schema", path.join(cache, s), path.join(work, f)], { stdio: "pipe" });
    } catch (e) {
      errors = String(e.stderr ?? "") || "xmllint failed";
    }
    const ok = mustFail ? errors !== "" : errors === "";
    if (!ok) failed++;
    console.log(`${ok ? "✅" : "❌"} ${f}  [${s}]${mustFail ? "  (must be rejected)" : ""}`);
    for (const l of errors.split("\n").filter((x) => /error/i.test(x)).slice(0, 4)) console.log(`     ${l.replace(work + "/", "")}`);
    if (mustFail && !errors) console.log("     → expected the schema to reject this sample, it accepted it");
  }
}
if (failed) {
  rmSync(work, { recursive: true, force: true });
  console.error(`\n${failed} schema result(s) not as expected`);
  process.exit(1);
}
console.log("\n✅ every Italian and Spanish sample is valid against its official schema (refusals refused)\n");

// Gate two: the value rules, on the same files.
try {
  execFileSync("npx", ["tsx", "scripts/check-einvoice-rules.ts", work], { stdio: "inherit" });
} catch {
  rmSync(work, { recursive: true, force: true });
  process.exit(1);
}
rmSync(work, { recursive: true, force: true });
