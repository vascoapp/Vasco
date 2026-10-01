// SDI (Italy) and FACe (Spain) VALUE rules over the sample invoices — the gate
// after the official schema. Usage: npx tsx scripts/check-einvoice-rules.ts <dir>
// where <dir> holds it-*.xml (FatturaPA), es-*.xml (Facturae) and expected.json,
// as written by scripts/einvoice-schema-samples.ts.
//
// A sample listed in expected.json MUST produce exactly those error codes (it
// is a refusal: the app must not hand that file over); every other sample must
// produce none. Exit 1 otherwise. Rules + official sources:
// src/integrations/einvoiceValueRules.ts.
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { checkFatturaPA, checkFacturae } from '../src/integrations/einvoiceValueRules';

const dir = process.argv[2];
if (!dir) { console.error('usage: check-einvoice-rules.ts <dir>'); process.exit(2); }
const files = readdirSync(dir).filter((f) => f.endsWith('.xml')).sort();
if (files.length === 0) { console.error('❌ no samples to check'); process.exit(1); }
const expectedPath = path.join(dir, 'expected.json');
const expected: Record<string, string[]> = existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, 'utf8')) : {};

let failed = 0;
for (const f of files) {
  const xml = readFileSync(path.join(dir, f), 'utf8');
  const findings = f.startsWith('it-') ? checkFatturaPA(xml) : checkFacturae(xml);
  const codes = [...new Set(findings.filter((x) => x.severity === 'error').map((x) => x.code))].sort();
  const want = [...(expected[f] ?? [])].sort();
  const ok = codes.join(',') === want.join(',');
  if (!ok) failed++;
  const label = want.length ? `must be refused with ${want.join(', ')}` : f.startsWith('it-') ? 'SDI value rules' : 'FACe/B2B value rules';
  console.log(`${ok ? '✅' : '❌'} ${f}  (${label})`);
  for (const x of findings) console.log(`     ${x.severity === 'error' ? '✗' : x.severity === 'warning' ? '!' : 'i'} ${x.code}  ${x.message}`);
  if (!ok) console.log(`     → expected error codes [${want.join(', ')}], got [${codes.join(', ')}]`);
}
if (failed) { console.error(`\n${failed} sample(s) where the SDI / FACe value rules disagree with what we expect`); process.exit(1); }
console.log('\n✅ SDI / FACe value rules: every sample passes, every refusal is refused');
