/**
 * @jest-environment node
 */
// A payment method's `name` is an identifier; people read `paymentMethodLabel`.
//
// `name` in src/config/paymentMethods.ts is also the brand-colour key and the
// React key, so it stays English ("Credit Card", "Bank Transfer"). Rendering it
// raw put "Credit Card" under "Carte Bancaire" on a French invoice, on the
// customer portal, and — missed in the first sweep, found on an Italian device —
// on the business settings screen. This fails on the shape that leaked:
// `{x.name}` or `{methodName}` as JSX TEXT in a file using the payment tables.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const REPO = path.join(__dirname, '..', '..');

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('__')) continue;
      tsxFiles(p, out);
    } else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

// Files that read the payment tables.
const USES_TABLES = /getPaymentDisplayForCountry|getMollieMethodsForCountry|PAYMENT_METHOD_INFO|STRIPE_DISPLAY_/;
// JSX text that is a bare method name: `>{pm.name}<`, `>{methodName}<`, or a
// `{…name}` child on its own line between tags.
// `provider.name` is an accounting provider's brand ("Fatture in Cloud") and
// `plan.name` is resolved through t() where the plan is built — neither is a
// payment method, so they are not this guard's business.
const RAW_NAME_TEXT = />\s*\{\s*(?:(?!provider\.|plan\.)\w+\.name|methodName)\s*\}\s*</;

describe('payment method names reach the screen through paymentMethodLabel', () => {
  const files = [...tsxFiles(path.join(REPO, 'app')), ...tsxFiles(path.join(REPO, 'src'))]
    .filter((f) => USES_TABLES.test(fs.readFileSync(f, 'utf8')));

  it('finds the payment surfaces at all (guards the walker)', () => {
    expect(files.length).toBeGreaterThan(4);
  });

  it('no raw method name rendered as text', () => {
    const hits: string[] = [];
    for (const f of files) {
      const code = stripComments(fs.readFileSync(f, 'utf8'));
      // Join tag/child/tag split over lines so the shape is on one line.
      const flat = code.replace(/>\s*\n\s*\{/g, '>{').replace(/\}\s*\n\s*</g, '}<');
      flat.split('\n').forEach((line, i) => {
        if (RAW_NAME_TEXT.test(line) && !/paymentMethodLabel/.test(line)) {
          hits.push(`${path.relative(REPO, f)}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});
