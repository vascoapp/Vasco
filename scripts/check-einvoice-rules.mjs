#!/usr/bin/env node
// SDI (Italy) + FACe (Spain) VALUE rules over freshly built samples, without
// xmllint or the network — `npm run check:einvoice-schemas` runs the same rules
// after the official schemas. See scripts/check-einvoice-rules.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const work = path.join(tmpdir(), `vasco-einvoice-rules-${Date.now()}`);
mkdirSync(work, { recursive: true });
let code = 0;
try {
  execFileSync("npx", ["tsx", "scripts/einvoice-schema-samples.ts", work], { stdio: "inherit" });
  execFileSync("npx", ["tsx", "scripts/check-einvoice-rules.ts", work], { stdio: "inherit" });
} catch {
  code = 1;
}
rmSync(work, { recursive: true, force: true });
process.exit(code);
