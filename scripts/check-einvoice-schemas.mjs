#!/usr/bin/env node
// The OFFICIAL schemas for Italy (FatturaPA 1.2.2, Agenzia delle Entrate) and
// Spain (Facturae 3.2.2), over invoices built EXACTLY as the invoice screen
// builds them (scripts/einvoice-schema-samples.ts). First run 2026-10-01: every
// Italian invoice with a due date was schema-invalid (SDI 00200), and a
// self-employed Spanish seller had no FirstSurname. Schema validity is the
// FIRST gate only — SDI and FACe add value rules on top (e.g. SDI 00400/00401).
//
// Needs xmllint (macOS: built in). Schemas cached in ~/.cache/vasco-einvoice-xsd.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const SCHEMAS = {
  "fatturapa-1.2.2.xsd": "https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_v1.2.2.xsd",
  "facturae-3.2.2.xsd": "https://www.facturae.gob.es/content/dam/facturae/formato/versiones/Facturaev3_2_2.xml",
  "xmldsig-core-schema.xsd": "https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd",
};
const cache = path.join(homedir(), ".cache", "vasco-einvoice-xsd");
mkdirSync(cache, { recursive: true });
for (const [file, url] of Object.entries(SCHEMAS)) {
  const p = path.join(cache, file);
  if (existsSync(p)) continue;
  execFileSync("curl", ["-sSfL", "-A", "Mozilla/5.0", "-o", p, url], { stdio: "inherit" });
  // Both import the W3C signature schema by URL; validate offline against our copy.
  writeFileSync(p, readFileSync(p, "utf8").replace(/schemaLocation="http[^"]*xmldsig-core-schema\.xsd"/g, 'schemaLocation="xmldsig-core-schema.xsd"'));
}

const work = path.join(tmpdir(), `vasco-xsd-${Date.now()}`);
mkdirSync(work, { recursive: true });
execFileSync("npx", ["tsx", "scripts/einvoice-schema-samples.ts", work], { stdio: "inherit" });

let failed = 0;
const files = readdirSync(work).filter((f) => f.endsWith(".xml")).sort();
if (files.length === 0) { console.error("❌ no samples were written"); process.exit(1); }
for (const f of files) {
  const schema = path.join(cache, f.startsWith("it-") ? "fatturapa-1.2.2.xsd" : "facturae-3.2.2.xsd");
  try {
    execFileSync("xmllint", ["--noout", "--schema", schema, path.join(work, f)], { stdio: "pipe" });
    console.log(`✅ ${f}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${f}`);
    for (const l of String(e.stderr ?? "").split("\n").filter((x) => /error/i.test(x)).slice(0, 4)) console.log(`     ${l.replace(work + "/", "")}`);
  }
}
rmSync(work, { recursive: true, force: true });
if (failed) { console.error(`\n${failed} invoice(s) INVALID against the official schema`); process.exit(1); }
console.log("\n✅ every Italian and Spanish sample is valid against its official schema");
