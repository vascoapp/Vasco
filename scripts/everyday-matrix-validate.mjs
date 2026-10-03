#!/usr/bin/env node
// THE EVERYDAY MATRIX — validator half. The jest half (__matrix__/*.test.tsx)
// drives the REAL screens a new contractor uses (onboarding → settings →
// customer form → quote → accept → invoice → line editor → export buttons) and
// writes what came out to .matrix/out/<cell>/: result.json (every step, every
// refusal), invoice.html (what the PDF prints), and each e-invoice file.
//
// This half judges those files with the OFFICIAL validators — never with
// samples we built (that was the blind spot: every validator check before
// 2026-10-03 ran on hand-made samples, so no defect in the forms could reach it):
//   XRechnung        KoSIT 1.6.3 + XRechnung 3.0.2 rules
//   ZUGFeRD/Factur-X veraPDF 1.30.2 (PDF/A-3b) + Mustang 2.26.0
//   FatturaPA        official XSD 1.2.2 + VFPR12 1.2.3, SDI value rules
//   Facturae         official XSD 3.2.2, FACe/B2B value rules
// …and checks CONTENT against the case: totals equal the EN 16931 figures
// computed in cases.ts (not by the app), the parties and identifiers the law
// requires are on the document.
//
//   node scripts/everyday-matrix-validate.mjs [outDir]   (default .matrix/out)
// Writes <outDir>/../report.json; exits 1 if any cell is not green.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const outDir = path.resolve(process.argv[2] ?? ".matrix/out");
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java";
const need = (p, hint) => { if (!existsSync(p)) { console.error(`❌ missing ${p} — run ${hint} once to download it`); process.exit(2); } return p; };
const kositJar = need(path.join(homedir(), ".cache/vasco-kosit/validator-1.6.3.jar"), "npm run check:kosit");
const kositConf = need(path.join(homedir(), ".cache/vasco-kosit/xrechnung-3.0.2-2026-08-31"), "npm run check:kosit");
const vera = need(path.join(homedir(), ".cache/vasco-pdfa/verapdf-1.30.2/verapdf"), "npm run check:pdfa3");
const mustang = need(path.join(homedir(), ".cache/vasco-pdfa/Mustang-CLI-2.26.0.jar"), "npm run check:pdfa3");
const xsd = path.join(homedir(), ".cache/vasco-einvoice-xsd");
need(path.join(xsd, "fatturapa-1.2.2.xsd"), "npm run check:einvoice-schemas");

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
};
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const squash = (s) => s.replace(/\s+/g, "").toUpperCase();
/** "1234.5" → the forms a document may print it in: 1.234,50 / 1,234.50 / 1234,50 / 1234.50 / 1 234,50 */
const moneyForms = (n) => {
  const [i, d] = n.toFixed(2).split(".");
  const g = (sep) => i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return [`${g(".")},${d}`, `${g(",")}.${d}`, `${i},${d}`, `${i}.${d}`, `${g(" ")},${d}`, `${g(" ")},${d}`, `${g(" ")},${d}`];
};
const hasMoney = (text, n) => moneyForms(n).some((f) => text.includes(f));
const xmlNumber = (xml, tag) => { const m = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>\\s*([-\\d.]+)\\s*<`).exec(xml); return m ? Number(m[1]) : null; };

if (!existsSync(outDir)) { console.error(`❌ ${outDir} does not exist — run the jest half first`); process.exit(2); }
const cells = readdirSync(outDir).filter((d) => existsSync(path.join(outDir, d, "result.json"))).sort();
if (!cells.length) { console.error("❌ no cells produced a result.json"); process.exit(2); }

const report = [];
const kositQueue = [];   // [cell, file]
for (const cell of cells) {
  const dir = path.join(outDir, cell);
  const res = JSON.parse(readFileSync(path.join(dir, "result.json"), "utf8"));
  const c = res.case;
  const exp = res.expected;
  const checks = [];   // { area, name, ok, detail }
  const add = (area, name, ok, detail = "") => checks.push({ area, name, ok: !!ok, detail });

  // 1. The path through the screens.
  for (const s of res.steps ?? []) add("path", s.name, s.ok, [s.detail, ...(s.alerts ?? []).map((a) => `alert: ${a}`)].filter(Boolean).join(" | "));

  // 2. The printed invoice (what the PDF renders).
  const htmlPath = path.join(dir, "invoice.html");
  if (c.formats.includes("pdf")) {
    if (!existsSync(htmlPath)) add("pdf", "PDF produced", false, "no invoice.html — the PDF button produced nothing");
    else {
      const raw = readFileSync(htmlPath, "utf8");
      const text = decode(raw.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ");
      const flat = squash(text);
      const contains = (s) => flat.includes(squash(s));
      add("pdf", "PDF produced", true);
      add("pdf", "seller name", contains(c.seller.name));
      add("pdf", "seller street", contains(c.seller.street));
      // Counted, not just present: a buyer in the same city must not satisfy the seller's check.
      const count = (needle) => flat.split(squash(needle)).length - 1;
      const sharedPc = squash(c.buyer.postcode) === squash(c.seller.postcode) ? 1 : 0;
      const sharedCity = squash(c.buyer.city) === squash(c.seller.city) ? 1 : 0;
      add("pdf", "seller postcode + city", count(c.seller.postcode) > sharedPc && count(c.seller.city) > sharedCity, `postcode ×${count(c.seller.postcode)}, city ×${count(c.seller.city)} (buyer shares: ${sharedPc}/${sharedCity})`);
      if (c.seller.vatId) add("pdf", "seller VAT id", contains(c.seller.vatId.native) || (c.seller.vatId.alt && contains(c.seller.vatId.alt)), c.seller.vatId.native);
      if (c.market === "DE" && c.seller.taxId) add("pdf", "Steuernummer or USt-IdNr (§14 Abs.4 Nr.2 UStG)", contains(c.seller.taxId.native) || contains(c.seller.vatId?.native ?? "¤"));
      if (c.seller.regNo) add("pdf", c.market === "FR" ? "SIRET/SIREN" : c.market === "NL" ? "KvK number" : "registration number", contains(c.seller.regNo.native) || contains(c.seller.regNo.native.replace(/\s/g, "").slice(0, 9)));
      if (c.market === "DE") add("pdf", "no HRB printed for a sole trader", !/HRB\s*:?\s*[A-Z0-9/]/i.test(text), "this seller has no Handelsregister entry; anything printed as HRB is a false statement");
      add("pdf", "buyer name", contains(c.buyer.name));
      add("pdf", "buyer street", contains(c.buyer.street));
      add("pdf", "buyer postcode + city", contains(c.buyer.postcode) && contains(c.buyer.city));
      // A domestic B2B invoice needs the buyer's VAT id only in France (2026 reform,
      // BT-48) — elsewhere it is required for reverse charge / intra-EU, not modelled here.
      if (c.market === "FR" && c.kind === "b2b" && c.buyer.vatId) add("pdf", "buyer SIREN (FR mention, 2026 reform)", contains(c.buyer.vatId.native.replace(/\s/g, "").slice(4)), c.buyer.vatId.native.replace(/\s/g, "").slice(4));
      // The PDF the contractor shares IS the invoice the customer receives.
      add("pdf", "not stamped as a draft", !/\b(ENTWURF|BROUILLON|BOZZA|BORRADOR|CONCEPT|DRAFT)\b/.test(text), (text.match(/\b(ENTWURF|BROUILLON|BOZZA|BORRADOR|CONCEPT|DRAFT)\b/) ?? [""])[0]);
      if (c.market === "IT" && c.kind === "b2c" && c.buyer.taxId) add("pdf", "buyer codice fiscale (B2C)", contains(c.buyer.taxId.native));
      add("pdf", "invoice number", res.invoiceNumber && contains(res.invoiceNumber), res.invoiceNumber ?? "unknown");
      for (const l of c.lines) add("pdf", `line "${l.description}"`, contains(l.description));
      add("pdf", `net ${exp.net.toFixed(2)}`, hasMoney(text, exp.net));
      add("pdf", `VAT ${exp.vat.toFixed(2)} at ${c.standardRate}%`, hasMoney(text, exp.vat) && text.includes(String(c.standardRate)));
      add("pdf", `total ${exp.gross.toFixed(2)}`, hasMoney(text, exp.gross));
      if (c.market === "DE") add("pdf", "Leistungsdatum (§14 Abs.4 Nr.6 UStG)", /Leistungs(datum|zeitraum)|Lieferdatum/i.test(text));
      if (c.market === "FR") {
        add("pdf", "late-payment penalties mention (L441-10)", /pénalités/i.test(text));
        add("pdf", "€40 recovery indemnity (D441-5)", /40\s?(€|euros?)/i.test(text));
      }
    }
  }

  // 3. E-invoices.
  const file = (name) => res.artefacts?.[name] ? path.join(dir, res.artefacts[name]) : null;
  for (const fmt of c.formats.filter((f) => f !== "pdf")) {
    const p = file(fmt);
    if (!p || !existsSync(p)) { add(fmt, `${fmt} produced`, false, res.artefactNotes?.[fmt] ?? "the export button produced no file"); continue; }
    add(fmt, `${fmt} produced`, true);
    if (fmt === "xrechnung") kositQueue.push([cell, p, add]);
    let xml = "";
    if (fmt === "zugferd" || fmt === "facturx") {
      const v = run(vera, ["--flavour", "3b", "--format", "xml", p]);
      const rep = /<validationReport [^>]*>/.exec(v.out)?.[0] ?? "";
      add(fmt, "veraPDF PDF/A-3b", /isCompliant="true"/.test(rep), rep ? "" : (v.err || v.out).slice(0, 200));
      const m = run(java, ["-jar", mustang, "--action", "validate", "--no-notices", "--source", p]);
      const overall = /<summary status="([a-z]+)"\/>\s*<\/validation>/.exec(m.out)?.[1];
      const notes = [...m.out.matchAll(/<(error)[^>]*>([\s\S]*?)<\/\1>/g)].map((x) => decode(x[2]).replace(/\s+/g, " ").slice(0, 200));
      add(fmt, "Mustang (EN 16931 + profile)", overall === "valid", notes.join(" | "));
      xml = res.artefacts?.[`${fmt}Xml`] && existsSync(path.join(dir, res.artefacts[`${fmt}Xml`])) ? readFileSync(path.join(dir, res.artefacts[`${fmt}Xml`]), "utf8") : "";
    } else {
      xml = readFileSync(p, "utf8");
    }
    if (fmt === "fatturapa" || fmt === "facturae") {
      const schemas = fmt === "fatturapa" ? ["fatturapa-1.2.2.xsd", "fatturapa-vfpr12-1.2.3.xsd"] : ["facturae-3.2.2.xsd"];
      for (const s of schemas) {
        const r = run("xmllint", ["--noout", "--schema", path.join(xsd, s), p]);
        add(fmt, `official XSD ${s}`, r.status === 0, r.err.split("\n").filter((x) => /error/i.test(x)).slice(0, 3).join(" | ").replace(dir + "/", ""));
      }
      const rules = run("npx", ["tsx", "-e", `const {${fmt === "fatturapa" ? "checkFatturaPA" : "checkFacturae"}:f}=require('./src/integrations/einvoiceValueRules');const x=require('fs').readFileSync(${JSON.stringify(p)},'utf8');console.log(JSON.stringify(f(x)))`]);
      let findings = [];
      try { findings = JSON.parse(rules.out.trim().split("\n").pop()); } catch { add(fmt, "value rules ran", false, rules.err.slice(0, 200)); }
      const errors = findings.filter((x) => x.severity === "error");
      add(fmt, fmt === "fatturapa" ? "SDI value rules" : "FACe/B2B value rules", errors.length === 0, errors.map((x) => `${x.code} ${x.message}`).join(" | "));
    }
    // Content: the file states the case's figures and parties.
    if (xml) {
      const total = fmt === "fatturapa" ? xmlNumber(xml, "ImportoTotaleDocumento")
        : fmt === "facturae" ? xmlNumber(xml, "InvoiceTotal")
        : xmlNumber(xml, "TaxInclusiveAmount") ?? xmlNumber(xml, "GrandTotalAmount");
      add(fmt, `total ${exp.gross.toFixed(2)} in the file`, total !== null && Math.abs(total - exp.gross) < 0.005, `file says ${total}`);
      const flatXml = squash(decode(xml));
      add(fmt, "buyer name in the file", flatXml.includes(squash(c.buyer.name)) || (fmt === "facturae" && flatXml.includes(squash(c.buyer.name.split(" ")[0]))));
      add(fmt, "buyer street in the file", flatXml.includes(squash(c.buyer.street)));
      const sv = c.seller.vatId ? squash(c.seller.vatId.native).replace(/^(DE|FR|NL|GB|ES|IT)/, "") : null;
      if (sv) add(fmt, "seller VAT id in the file", flatXml.includes(sv), c.seller.vatId.native);
    }
  }
  report.push({ cell, market: c.market, kind: c.kind, checks, ok: checks.length > 0 && checks.every((x) => x.ok) });
}

// KoSIT once over every XRechnung.
if (kositQueue.length) {
  const work = path.join(tmpdir(), `vasco-matrix-kosit-${Date.now()}`);
  const input = path.join(work, "in"), output = path.join(work, "out");
  mkdirSync(input, { recursive: true }); mkdirSync(output, { recursive: true });
  for (const [cell, p] of kositQueue) copyFileSync(p, path.join(input, `${cell}.xml`));
  try { execFileSync(java, ["-jar", kositJar, "-s", path.join(kositConf, "scenarios.xml"), "-r", kositConf, "-o", output, ...kositQueue.map(([cell]) => path.join(input, `${cell}.xml`))], { stdio: "pipe" }); } catch { /* reports decide */ }
  for (const [cell, , add] of kositQueue) {
    const rp = path.join(output, `${cell}-report.xml`);
    if (!existsSync(rp)) { add("xrechnung", "KoSIT", false, "no report — did it run?"); continue; }
    const x = readFileSync(rp, "utf8");
    const reasons = [...new Set([...x.matchAll(/<rep:message[^>]*level="error"[^>]*>([\s\S]*?)<\/rep:message>/g)].map((m) => m[1].replace(/\s+/g, " ").slice(0, 180)))];
    add("xrechnung", "KoSIT (XRechnung 3.0.2)", x.includes("<rep:accept>"), reasons.join(" | "));
  }
  rmSync(work, { recursive: true, force: true });
  for (const r of report) r.ok = r.checks.length > 0 && r.checks.every((x) => x.ok);
}

// Print + save.
for (const r of report) {
  const bad = r.checks.filter((x) => !x.ok);
  console.log(`${r.ok ? "🟢" : "🔴"} ${r.cell.padEnd(8)} ${r.checks.length - bad.length}/${r.checks.length} checks pass`);
  for (const x of bad) console.log(`     ✗ [${x.area}] ${x.name}${x.detail ? ` — ${x.detail}` : ""}`);
}
writeFileSync(path.join(outDir, "..", "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), cells: report }, null, 2));
const red = report.filter((r) => !r.ok).length;
console.log(`\n${red ? "🔴" : "🟢"} ${report.length - red}/${report.length} everyday cells green — report: ${path.join(outDir, "..", "report.json")}`);
process.exit(red ? 1 : 0);
