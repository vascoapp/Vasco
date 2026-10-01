#!/usr/bin/env node
// The OFFICIAL check for our ZUGFeRD (DE) / Factur-X (FR) hybrids: veraPDF
// (PDF/A-3b, the reference PDF/A validator) and Mustang (Mustangproject — the
// ZUGFeRD/Factur-X validator: PDF/A part, XMP fx schema, embedded XML against
// the Factur-X schematron), run over invoices made by the REAL module the app
// ships (src/integrations/pdfA3Invoice.ts via scripts/pdfa3-samples.ts).
//
// Why: our own tests passed three formats the official validators rejected on
// first contact (learnings #383). For a regulated format the authority's tool
// IS the test.
//
// Needs Java 11+ (JAVA_HOME or `java` on PATH; here /usr/local/opt/openjdk@17).
// Downloads are cached in ~/.cache/vasco-pdfa. Pinned versions — bump
// deliberately. veraPDF publishes only a "latest" installer URL, so the pin is
// enforced by checking the version inside it and refusing anything else.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const VERAPDF_VERSION = "1.30.2";
const VERAPDF_URL = "https://software.verapdf.org/releases/verapdf-installer.zip";
const MUSTANG_VERSION = "2.26.0";
const MUSTANG_URL = `https://github.com/ZUGFeRD/mustangproject/releases/download/core-${MUSTANG_VERSION}/Mustang-CLI-${MUSTANG_VERSION}.jar`;

const cache = path.join(homedir(), ".cache", "vasco-pdfa");
mkdirSync(cache, { recursive: true });
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java";

// ── veraPDF ──
const veraHome = path.join(cache, `verapdf-${VERAPDF_VERSION}`);
const vera = path.join(veraHome, "verapdf");
if (!existsSync(vera)) {
  const zip = path.join(cache, "verapdf-installer.zip");
  execFileSync("curl", ["-sSfL", "-o", zip, VERAPDF_URL], { stdio: "inherit" });
  execFileSync("unzip", ["-oq", zip, "-d", cache]);
  const installer = path.join(cache, `verapdf-greenfield-${VERAPDF_VERSION}`, `verapdf-izpack-installer-${VERAPDF_VERSION}.jar`);
  if (!existsSync(installer)) {
    console.error(`❌ The veraPDF download is not ${VERAPDF_VERSION} (found: ${readdirSync(cache).filter((f) => f.startsWith("verapdf-greenfield")).join(", ")}). Bump VERAPDF_VERSION deliberately.`);
    process.exit(1);
  }
  const auto = path.join(cache, "auto-install.xml");
  writeFileSync(auto, `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<AutomatedInstallation langpack="eng">
  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
  <com.izforge.izpack.panels.target.TargetPanel id="install_dir"><installpath>${veraHome}</installpath></com.izforge.izpack.panels.target.TargetPanel>
  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">
    <pack index="0" name="veraPDF GUI" selected="true"/>
    <pack index="1" name="veraPDF Mac and *nix Scripts" selected="true"/>
    <pack index="2" name="veraPDF Validation model" selected="true"/>
    <pack index="3" name="veraPDF Documentation" selected="false"/>
    <pack index="4" name="veraPDF Sample Plugins" selected="false"/>
  </com.izforge.izpack.panels.packs.PacksPanel>
  <com.izforge.izpack.panels.install.InstallPanel id="install"/>
  <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
</AutomatedInstallation>`);
  execFileSync(java, ["-jar", installer, auto], { stdio: "inherit" });
}
// ── Mustang ──
const mustang = path.join(cache, `Mustang-CLI-${MUSTANG_VERSION}.jar`);
if (!existsSync(mustang)) execFileSync("curl", ["-sSfL", "-o", mustang, MUSTANG_URL], { stdio: "inherit" });

// ── Samples, through the real module ──
const work = path.join(tmpdir(), `vasco-pdfa-${Date.now()}`);
mkdirSync(work, { recursive: true });
execFileSync("npx", ["tsx", "scripts/pdfa3-samples.ts", work], { stdio: "inherit" });
const files = readdirSync(work).filter((f) => f.endsWith(".pdf")).sort();
if (files.length === 0) { console.error("❌ no samples generated"); process.exit(1); }

// Both validators exit non-zero on a rejection — the case this check exists
// for (learnings #382) — so never let that throw; read their reports.
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
};
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

let failed = 0;
console.log(`veraPDF ${VERAPDF_VERSION} (PDF/A-3b) + Mustang ${MUSTANG_VERSION}\n`);
for (const f of files) {
  const pdf = path.join(work, f);
  const reasons = [];

  // veraPDF, flavour forced to 3b: the file must not get to pick a laxer one.
  const v = run(vera, ["--flavour", "3b", "--format", "xml", pdf]);
  const report = /<validationReport [^>]*>/.exec(v.out)?.[0] ?? "";
  const veraOk = /isCompliant="true"/.test(report) && /profileName="PDF\/A-3B /i.test(report);
  if (!veraOk) {
    for (const m of v.out.matchAll(/<rule ([^>]*)>([\s\S]*?)<\/rule>/g)) {
      const attr = (k) => new RegExp(`${k}="([^"]*)"`).exec(m[1])?.[1];
      if (attr("status") !== "failed") continue;
      const desc = /<description>([\s\S]*?)<\/description>/.exec(m[2])?.[1] ?? "";
      reasons.push(`veraPDF ${attr("clause")}-${attr("testNumber")} (${attr("failedChecks")}×): ${decode(desc).replace(/\s+/g, " ").slice(0, 200)}`);
    }
    if (!reasons.length) reasons.push(`veraPDF: no compliant verdict (exit ${v.status}) ${(v.err || v.out).slice(0, 300)}`);
  }

  // Mustang: PDF/A part + the embedded XML against the profile's schematron.
  const m = run(java, ["-jar", mustang, "--action", "validate", "--no-notices", "--source", pdf]);
  const overall = /<\/xml>\s*<messages>[\s\S]*?<\/messages>\s*<summary status="([a-z]+)"\/>\s*<\/validation>/.exec(m.out)?.[1]
    ?? /<summary status="([a-z]+)"\/>\s*<\/validation>/.exec(m.out)?.[1];
  const pdfPart = /<pdf>[\s\S]*?<summary status="([a-z]+)"\/>/.exec(m.out)?.[1];
  const xmlPart = /<xml>[\s\S]*?<summary status="([a-z]+)"\/>/.exec(m.out)?.[1];
  const profile = /<profile>([^<]+)<\/profile>/.exec(m.out)?.[1] ?? "?";
  const mustangOk = overall === "valid" && pdfPart === "valid" && xmlPart === "valid";
  const notes = [...m.out.matchAll(/<(error|warning)[^>]*>([\s\S]*?)<\/\1>/g)]
    .map((x) => `Mustang ${x[1]}: ${decode(x[2]).replace(/\s+/g, " ").slice(0, 220)}`);
  if (!mustangOk) {
    reasons.push(...notes);
    if (!notes.length) reasons.push(`Mustang: overall=${overall} pdf=${pdfPart} xml=${xmlPart} (exit ${m.status}) ${m.err.slice(-300)}`);
  }

  const ok = veraOk && mustangOk;
  console.log(`${ok ? "✅" : "❌"} ${f.padEnd(30)} veraPDF ${veraOk ? "compliant" : "NOT compliant"} · Mustang ${overall ?? "no verdict"} (pdf ${pdfPart ?? "?"}, xml ${xmlPart ?? "?"}, profile ${profile})`);
  for (const r of [...new Set(ok ? notes : reasons)]) console.log(`     ${r}`);
  if (!ok) failed++;
}
rmSync(work, { recursive: true, force: true });
if (failed) { console.error(`\n${failed} hybrid invoice(s) REJECTED`); process.exit(1); }
console.log(`\n✅ veraPDF and Mustang accept every generated hybrid (${files.length})`);
