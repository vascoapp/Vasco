/**
 * @jest-environment node
 */
// A country-dependent value must SKIP when the country is unknown, never
// default to the home market (CLAUDE.md; learnings #148/#151/#155/#157), and
// the business PROFILE outranks the account (#218).
//
// The sweep of 2026-09-17 found these still defaulting, each with a real
// consequence: a French contractor was shown a Dutch BTW-aangifte with a DigiD
// button, a German contractor's invoice EMAIL went out in Dutch, the legal and
// certificate screens handed him the Dutch compliance pack, an imported
// supplier sheet was booked at 21%, and every expense line said "21% btw".
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('the VAT return refuses a market it cannot prepare', () => {
  const screen = read('app/contractor/vat-prep.tsx');
  const queue = read('src/services/aiActionQueueService.ts');

  it('the screen refuses instead of coercing every country to NL', () => {
    expect(screen).toMatch(/vatReturnSupported/);
    expect(screen).toMatch(/if \(!vatReturnSupported\)/);
    expect(screen).toMatch(/vatPrep\.unsupportedTitle/);
  });

  it('the quarter-end card is only queued for a supported market', () => {
    const at = queue.indexOf("type: 'tax_prep'");
    expect(at).toBeGreaterThan(-1);
    // Look back from the card to the condition that guards it.
    const before = queue.slice(Math.max(0, at - 1200), at);
    expect(before).toMatch(/vatReturnSupported/);
  });

  it('the card states the obligation, never an invoice count (2026-09-22)', () => {
    // It printed ALL-TIME paid invoices as "N facturen om te exporteren", and
    // "0" read as "nothing to file" — a VAT return is due with no turnover too.
    const at = queue.indexOf("type: 'tax_prep'");
    const card = queue.slice(at, queue.indexOf('});', at));
    expect(card).toMatch(/automation\.taxPrepAlwaysRequired/);
    expect(card).not.toMatch(/invoicesToExport|invoiceCount|paidInvoiceCount/);
  });

  it('never tells a KOR / Kleinunternehmer contractor a return is due', () => {
    // They file no VAT return; "also required with no invoices" is false for them.
    const at = queue.indexOf("type: 'tax_prep'");
    const before = queue.slice(Math.max(0, at - 1500), at);
    expect(before).toMatch(/isSmallBusinessExempt/);
    expect(before).toMatch(/&& !vatExempt\)/);
    // ...nor a DE business on yearly filing (no UStVA), and only NL/DE at all.
    expect(before).toMatch(/filingPeriod === 'yearly'/);
    // Profile not loaded yet → skip this run, never assume a return is due.
    expect(before).toMatch(/vatExempt = !bp \|\|/);
    expect(before).toMatch(/context\.country === 'NL' \|\| context\.country === 'DE'/);
  });
});

describe('customer-facing language and compliance follow the profile', () => {
  it('the invoice email takes the ACTIVE language, not the account default', () => {
    const src = read('app/invoices/[id].tsx');
    expect(src).toMatch(/const language = messageLocale\(\)/);
    expect(src).not.toMatch(/user\?\.language \?\? 'nl'/);
  });

  it.each([
    ['app/contractor/legal.tsx', 'userCountry'],
    ['app/(contractor)/certificaten.tsx', 'country'],
  ])('%s picks its compliance pack profile-first', (rel, varName) => {
    const src = read(rel);
    const at = src.indexOf(`const ${varName} =`);
    expect(at).toBeGreaterThan(-1);
    const decl = src.slice(at, src.indexOf(';', at));
    expect(decl).toMatch(/businessProfile\??\.country/);
  });
});

describe('an unknown country does not become the Dutch VAT rate', () => {
  // ⚠️ `[^)]*` cannot cross the inner `)` of `getCurrentCountry()`, so the first
  // version of this matched nothing and a decoy sailed through it.
  it.each([
    ['src/ingestion/spreadsheetExtractor.ts', /getStandardVatRate\([\s\S]{0,160}?\?\?\s*'NL'/],
    ['app/contractor/expenses.tsx', /getVATRate\([\s\S]{0,160}?\?\?\s*'NL'/],
  ])('%s does not re-add the default', (rel, pattern) => {
    expect(read(rel)).not.toMatch(pattern);
  });
});

describe('every contractor screen resolves its country profile-first', () => {
  // ~30 screens declared `const country = (user?.country ?? 'NL')` and passed it
  // to formatCurrency, so a UK contractor whose profile said UK — but whose
  // account metadata still said NL — was billed out in EUROS on quotes,
  // invoices, purchase orders and insurance (#218; swept 2026-09-18).
  const DIRS = ['app/contractor', 'app/(contractor)', 'app/quotes', 'app/invoices', 'app/(modals)'];

  function walk(dir: string): string[] {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(rel);
      return e.name.endsWith('.tsx') ? [rel] : [];
    });
  }

  it('no screen takes the contractor country from the account alone', () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const rel of DIRS.flatMap(walk)) {
      const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      for (const m of src.matchAll(/const country\s*=\s*([^;]+);/g)) {
        checked += 1;
        const decl = m[1];
        if (/user\?\.country/.test(decl) && !/businessProfile\??\.country/.test(decl)) {
          offenders.push(`${rel}: ${decl.trim().slice(0, 80)}`);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(20);
    expect(offenders).toEqual([]);
  });

  it('the module-level accessor is fed the profile country, not the account one', () => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, 'src/state/AppState.tsx'), 'utf8'));
    expect(src).toMatch(/country: bp\.country \?\? getCurrentCountry\(\)/);
    expect(src).not.toMatch(/country: getCurrentCountry\(\) \?\? bp\.country/);
  });
});

