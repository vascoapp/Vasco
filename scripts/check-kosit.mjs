#!/usr/bin/env node
// The OFFICIAL XRechnung check: KoSIT's validator + the XRechnung 3.0 rule set,
// run over invoices our own generators produce (scripts/kosit-samples.ts).
//
// Why this exists: our own validator passed every XRechnung we generated while
// the authoritative one rejected all of them — wrong BT-24 identifier (no
// scenario matched), then no BT-23 / BT-34 / BT-49 (2026-10-01, learnings #382).
// "Passing our validator is NOT conformance" (einvoice memory, 2026-08-19).
//
// Needs Java 11+ (JAVA_HOME or `java` on PATH). Downloads are cached in
// ~/.cache/vasco-kosit. Pinned versions — bump deliberately.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const VALIDATOR = "https://github.com/itplr-kosit/validator/releases/download/v1.6.3/validator-1.6.3-standalone.jar";
const CONFIG = "https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0.2-validator-configuration-2026-08-31.zip";
const cache = path.join(homedir(), ".cache", "vasco-kosit");
mkdirSync(cache, { recursive: true });
const jar = path.join(cache, "validator-1.6.3.jar");
const conf = path.join(cache, "xrechnung-3.0.2-2026-08-31");
if (!existsSync(jar)) execFileSync("curl", ["-sSfL", "-o", jar, VALIDATOR], { stdio: "inherit" });
if (!existsSync(path.join(conf, "scenarios.xml"))) {
  const zip = path.join(cache, "conf.zip");
  execFileSync("curl", ["-sSfL", "-o", zip, CONFIG], { stdio: "inherit" });
  execFileSync("unzip", ["-oq", zip, "-d", conf]);
}
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "java") : "java";

const work = path.join(tmpdir(), `vasco-kosit-${Date.now()}`);
const input = path.join(work, "in"), output = path.join(work, "out");
mkdirSync(input, { recursive: true }); mkdirSync(output, { recursive: true });
execFileSync("npx", ["tsx", "scripts/kosit-samples.ts", input], { stdio: "inherit" });
const files = readdirSync(input).map((f) => path.join(input, f));
// The validator exits non-zero when it rejects anything — that is the case
// this check exists for, so read the reports either way.
try {
  execFileSync(java, ["-jar", jar, "-s", path.join(conf, "scenarios.xml"), "-r", conf, "-o", output, ...files], { stdio: "pipe" });
} catch { /* reports below decide */ }

let failed = 0;
const reports = readdirSync(output).filter((x) => x.endsWith("-report.xml"));
if (reports.length !== files.length) {
  console.error(`❌ KoSIT wrote ${reports.length} report(s) for ${files.length} invoice(s) — did it run?`);
  process.exit(1);
}
for (const f of readdirSync(output).filter((x) => x.endsWith("-report.xml")).sort()) {
  const xml = readFileSync(path.join(output, f), "utf8");
  const accepted = xml.includes("<rep:accept>");
  const reasons = [...xml.matchAll(/<rep:message[^>]*level="(error|warning)"[^>]*>([\s\S]*?)<\/rep:message>/g)]
    .map((m) => `${m[1]}: ${m[2].replace(/\s+/g, " ").slice(0, 160)}`);
  const noScenario = xml.includes("<rep:noScenarioMatched>");
  console.log(`${accepted ? "✅" : "❌"} ${f.replace("-report.xml", "")}${noScenario ? " — no scenario matched (wrong BT-24?)" : ""}`);
  for (const r of [...new Set(reasons)]) console.log(`     ${r}`);
  if (!accepted) failed++;
}
rmSync(work, { recursive: true, force: true });
if (failed) { console.error(`\n${failed} invoice(s) REJECTED by KoSIT`); process.exit(1); }
console.log("\n✅ KoSIT accepts every generated invoice");
