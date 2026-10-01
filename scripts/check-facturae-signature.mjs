#!/usr/bin/env node
// THE AUTHORITY-GRADE CHECK of our Facturae signatures: the European
// Commission's DSS (Digital Signature Service, eu.europa.ec.joinup.sd-dss,
// pinned 6.5) validates XAdES files the way the EU's own validation service
// does. FACe's signature check (@firma) is not public; DSS is the open
// reference implementation of the same ETSI standards.
//
// What it does, offline after the first run (cache ~/.cache/vasco-xades):
//   1. a THROWAWAY test PKI with openssl, per run, in a temp dir — a CA
//      ("VASCO TEST CA - NOT TRUSTED"), an FNMT-shaped representative
//      certificate (serialNumber IDCES-…, organizationIdentifier VATES-…) and
//      an autónomo one, each exported as a password-protected .p12, plus the
//      CA's CRL. No key is kept or committed;
//   2. signed samples built through the app's own path
//      (scripts/facturae-signature-samples.ts): mapper → generator → the
//      import screen's .p12 reader → signFacturae;
//   3. per sample: the official Facturae 3.2.2 XSD (xmllint, xmldsig resolved
//      locally), the FACe value rules (scripts/check-einvoice-rules.ts), and
//      DSS with the test CA as the ONLY trust anchor, its CRL as the only
//      revocation data, and the policy PDF as published today.
//
// A sample passes DSS only if: indication TOTAL_PASSED; format XAdES-BASELINE-B
// (or -EPES); signature intact; all three references (the invoice, the
// SignedProperties, the KeyInfo) found and intact; policy id = the Facturae
// v3.1 URL with the REGISTERED SHA-1 digest; ClaimedRole "emisor". The
// tampered sample must FAIL (proves the harness has teeth).
//
// ⚠️ DSS also recomputes the policy digest from the PDF served at the policy
// URL today and reports a MISMATCH: that file was re-published (SHA-1
// f/LPQFpMc/…) after the policy's registered digest (Ohixl6upD6av8N7pEvDABhEL6hM=,
// what FACe and every Facturae signer use). Printed as a note, not a failure.
//
// Needs: Java 17 (JAVA_HOME, default /usr/local/opt/openjdk@17), openssl,
// xmllint, curl. First run downloads Maven 3.9.11 (sha512-checked) and the
// DSS jars from Maven Central. Uploads NOTHING anywhere.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JAVA_HOME = process.env.JAVA_HOME || "/usr/local/opt/openjdk@17";
const JAVA = path.join(JAVA_HOME, "bin", "java");
const JAVAC = path.join(JAVA_HOME, "bin", "javac");
const CACHE = path.join(homedir(), ".cache", "vasco-xades");
const MAVEN_VERSION = "3.9.11";
const DSS_VERSION = "6.5";
const MAVEN_URL = `https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz`;
const POLICY_URL = "https://www.facturae.gob.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf";
const POLICY_ID = "http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf";
const POLICY_DIGEST = "SHA1:Ohixl6upD6av8N7pEvDABhEL6hM=";
const XSD_CACHE = path.join(homedir(), ".cache", "vasco-einvoice-xsd");
const PASSWORD = `t-${Date.now().toString(36)}`;

const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.error) fail(`${cmd}: ${r.error.message}`);
  return r;
};
const must = (cmd, args, opts = {}) => {
  const r = run(cmd, args, opts);
  if (r.status !== 0) fail(`${cmd} ${args.slice(0, 3).join(" ")} … exited ${r.status}\n${r.stderr || r.stdout}`);
  return r.stdout;
};

if (!existsSync(JAVA)) fail(`no java at ${JAVA} (set JAVA_HOME to a JDK 17)`);
mkdirSync(CACHE, { recursive: true });

// --- Maven (only to resolve the pinned DSS dependency set) ------------------
const mvnHome = path.join(CACHE, `apache-maven-${MAVEN_VERSION}`);
if (!existsSync(path.join(mvnHome, "bin", "mvn"))) {
  const tgz = path.join(CACHE, `apache-maven-${MAVEN_VERSION}-bin.tar.gz`);
  must("curl", ["-sSfL", "-o", tgz, MAVEN_URL]);
  const want = must("curl", ["-sSfL", `${MAVEN_URL}.sha512`]).trim().split(/\s+/)[0];
  const got = createHash("sha512").update(readFileSync(tgz)).digest("hex");
  if (got !== want) fail(`Maven download sha512 mismatch (${got.slice(0, 16)}… ≠ ${want.slice(0, 16)}…)`);
  must("tar", ["xzf", tgz, "-C", CACHE]);
}

// --- DSS jars + our runner ----------------------------------------------------
const dssDir = path.join(CACHE, `dss-${DSS_VERSION}`);
const lib = path.join(dssDir, "lib");
mkdirSync(dssDir, { recursive: true });
const pom = readFileSync(path.join(ROOT, "scripts/xades/pom.xml"), "utf8");
if (!pom.includes(`<dss.version>${DSS_VERSION}</dss.version>`)) fail(`scripts/xades/pom.xml does not pin DSS ${DSS_VERSION}`);
const cachedPom = path.join(dssDir, "pom.xml");
if (!existsSync(lib) || !existsSync(cachedPom) || readFileSync(cachedPom, "utf8") !== pom) {
  writeFileSync(cachedPom, pom);
  rmSync(lib, { recursive: true, force: true });
  must(path.join(mvnHome, "bin", "mvn"), ["-q", "-B", `-Dmaven.repo.local=${path.join(CACHE, "m2")}`, "dependency:copy-dependencies", "-DoutputDirectory=lib"],
    { cwd: dssDir, env: { ...process.env, JAVA_HOME } });
}
if (!readdirSync(lib).includes(`dss-xades-${DSS_VERSION}.jar`)) fail(`dss-xades-${DSS_VERSION}.jar missing from ${lib}`);
const classes = path.join(dssDir, "classes");
mkdirSync(classes, { recursive: true });
must(JAVAC, ["-cp", `${lib}/*`, "-d", classes, path.join(ROOT, "scripts/xades/ValidateFacturae.java")]);

// --- The policy document as published today --------------------------------
const policyPdf = path.join(CACHE, "politica_de_firma_formato_facturae_v3_1.pdf");
if (!existsSync(policyPdf)) {
  // facturae.es serves an expired TLS certificate; facturae.gob.es is the same file.
  must("curl", ["-sSfL", "-A", "Mozilla/5.0", "-o", policyPdf, POLICY_URL]);
}
const hostedSha1 = createHash("sha1").update(readFileSync(policyPdf)).digest("base64");

// --- Facturae XSD (shared cache with check:einvoice-schemas) -----------------
mkdirSync(XSD_CACHE, { recursive: true });
for (const [file, url] of Object.entries({
  "facturae-3.2.2.xsd": "https://www.facturae.gob.es/content/dam/facturae/formato/versiones/Facturaev3_2_2.xml",
  "xmldsig-core-schema.xsd": "https://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd",
})) {
  const p = path.join(XSD_CACHE, file);
  if (existsSync(p)) continue;
  must("curl", ["-sSfL", "-A", "Mozilla/5.0", "-o", p, url]);
  writeFileSync(p, readFileSync(p, "utf8").replace(/schemaLocation="http[^"]*xmldsig-core-schema\.xsd"/g, 'schemaLocation="xmldsig-core-schema.xsd"'));
}

// --- Throwaway test PKI -------------------------------------------------------
const work = path.join(tmpdir(), `vasco-xades-${Date.now()}`);
const pki = path.join(work, "pki");
const samples = path.join(work, "samples");
mkdirSync(pki, { recursive: true });
mkdirSync(samples, { recursive: true });
const cleanup = () => rmSync(work, { recursive: true, force: true });
process.on("exit", cleanup);

const ossl = (...args) => must("openssl", args, { cwd: pki });
ossl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "30",
  "-subj", "/C=ES/O=VASCO TEST ONLY/CN=VASCO TEST CA - NOT TRUSTED",
  "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
writeFileSync(path.join(pki, "leaf.cnf"), "keyUsage=critical,digitalSignature,nonRepudiation\nbasicConstraints=CA:FALSE\n");
const leaf = (name, subj) => {
  ossl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", `${name}.key`, "-out", `${name}.csr`, "-subj", subj);
  ossl("x509", "-req", "-in", `${name}.csr`, "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", `${name}.pem`, "-days", "20", "-extfile", "leaf.cnf");
  ossl("pkcs12", "-export", "-inkey", `${name}.key`, "-in", `${name}.pem`, "-certfile", "ca.pem", "-out", `${name}.p12`, "-passout", `pass:${PASSWORD}`);
};
// FNMT "Certificado de Representante de Persona Jurídica" shape.
leaf("representative", "/C=ES/organizationIdentifier=VATES-B12345674/O=FONTANERIA RUIZ SL/serialNumber=IDCES-12345678Z/GN=PEDRO/SN=RUIZ/CN=12345678Z PEDRO RUIZ (R: B12345674)");
// FNMT "Certificado de Persona Física" shape.
leaf("autonomo", "/C=ES/serialNumber=IDCES-12345678Z/GN=LUCIA/SN=NAVARRO GOMEZ/CN=NAVARRO GOMEZ LUCIA - 12345678Z");

// --- Samples through the app's path ----------------------------------------
must("npx", ["tsx", "scripts/facturae-signature-samples.ts", samples, pki, PASSWORD], { cwd: ROOT });
// The CRL AFTER signing: DSS wants revocation data issued after the signing time.
writeFileSync(path.join(pki, "index.txt"), "");
writeFileSync(path.join(pki, "crlnumber"), "01\n");
writeFileSync(path.join(pki, "ca.cnf"), "[ca]\ndefault_ca=t\n[t]\ndatabase=index.txt\ncrlnumber=crlnumber\ndefault_md=sha256\ndefault_crl_days=7\n");
ossl("ca", "-config", "ca.cnf", "-gencrl", "-keyfile", "ca.key", "-cert", "ca.pem", "-out", "crl.pem");
ossl("crl", "-in", "crl.pem", "-outform", "DER", "-out", "crl.der");

const dssExpected = JSON.parse(readFileSync(path.join(samples, "dss-expected.json"), "utf8"));
const files = Object.keys(dssExpected).sort();
if (files.length === 0) fail("no samples were written");
let failed = 0;

// Gate 1: the official XSD.
console.log(`\nFacturae 3.2.2 XSD (xmllint)`);
for (const f of files) {
  const r = run("xmllint", ["--noout", "--schema", path.join(XSD_CACHE, "facturae-3.2.2.xsd"), path.join(samples, f)]);
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${f}`);
  if (!ok) for (const l of String(r.stderr).split("\n").filter((x) => /error/i.test(x)).slice(0, 4)) console.log(`     ${l}`);
}

// Gate 2: the FACe value rules (incl. the structural XAdES-EPES check).
console.log(`\nFACe value rules`);
const rules = run("npx", ["tsx", "scripts/check-einvoice-rules.ts", samples], { cwd: ROOT, stdio: "inherit" });
if (rules.status !== 0) failed++;

// Gate 3: DSS.
console.log(`\nEU DSS ${DSS_VERSION} (trust anchor: the throwaway test CA only)`);
const dss = run(JAVA, ["-cp", `${lib}/*${path.delimiter}${classes}`, "ValidateFacturae",
  path.join(pki, "ca.pem"), path.join(pki, "crl.der"), policyPdf, ...files.map((f) => path.join(samples, f))]);
const reports = new Map();
for (const line of String(dss.stdout).split("\n").filter((l) => l.startsWith("{"))) {
  try { const j = JSON.parse(line); reports.set(j.file, j); } catch { /* not a report line */ }
}
if (dss.status !== 0) console.log(`   (validator exited ${dss.status})\n${String(dss.stderr).split("\n").slice(-8).join("\n")}`);
for (const f of files) {
  const r = reports.get(f);
  const want = dssExpected[f];
  const problems = [];
  if (!r) problems.push("no report from the validator");
  else if (want === "valid") {
    if (r.indication !== "TOTAL_PASSED") problems.push(`indication ${r.indication}/${r.subIndication}`);
    if (!/^XAdES-(BASELINE-B|EPES)/.test(r.format ?? "")) problems.push(`format ${r.format}`);
    if (!r.signatureIntact || !r.signatureValid) problems.push("signature not intact/valid");
    const types = (r.references ?? []).map((x) => x.type).sort().join(",");
    if (types !== "KEY_INFO,REFERENCE,SIGNED_PROPERTIES") problems.push(`references ${types}`);
    if ((r.references ?? []).some((x) => !x.found || !x.intact)) problems.push("a reference is not found/intact");
    if (r.policyId !== POLICY_ID) problems.push(`policy id ${r.policyId}`);
    if (r.policyDigest !== POLICY_DIGEST) problems.push(`policy digest ${r.policyDigest}`);
    if (JSON.stringify(r.claimedRoles) !== '["emisor"]') problems.push(`claimed roles ${JSON.stringify(r.claimedRoles)}`);
  } else {
    // tampered: the validator MUST see it.
    if (r.indication === "TOTAL_PASSED") problems.push("validator ACCEPTED a tampered file");
    if (!(r.references ?? []).some((x) => x.type === "REFERENCE" && x.intact === false)) problems.push("invoice reference not reported as altered");
  }
  if (problems.length) failed++;
  console.log(`${problems.length ? "❌" : "✅"} ${f}  ${want === "valid" ? "" : "(must be rejected) "}→ ${r ? `${r.indication}${r.subIndication ? `/${r.subIndication}` : ""}, ${r.format}` : "?"}`);
  for (const p of problems) console.log(`     ✗ ${p}`);
  if (r) {
    for (const x of r.references ?? []) console.log(`     · ${x.type} ${x.uri || '""'} found=${x.found} intact=${x.intact}`);
    if (want === "valid") console.log(`     · policy ${r.policyIdentified ? "identified" : "not identified"}; digest vs hosted PDF: ${r.policyDigestValid ? "match" : "MISMATCH (expected, see header)"}`);
    for (const w of r.warnings ?? []) console.log(`     ! ${w}`);
    for (const e of r.errors ?? []) console.log(`     ! ${e}`);
  }
}
console.log(`\nPolicy PDF served today: SHA-1 ${hostedSha1} (registered: ${POLICY_DIGEST.slice(5)})`);
if (failed) { console.error(`\n${failed} check(s) not as expected`); process.exit(1); }
console.log(`\n✅ every signed Facturae is XSD-valid, passes the FACe value rules, and is TOTAL_PASSED by EU DSS ${DSS_VERSION}; the tampered one is rejected\n`);
