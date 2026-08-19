/**
 * Every drill-down screen must offer a way back.
 *
 * `app/contractor/_layout.tsx` and the root stack both run with
 * `headerShown: false`, so a pushed screen gets NO navigator chrome — the back
 * control is entirely the screen's own job. Four contractor screens had never
 * drawn one (ai-assistant, cashflow, warranty, and both invoice-creation
 * screens): on Android the hardware button still worked, on iOS the edge
 * swipe, but on screen there was nothing, and in the browser nothing at all.
 *
 * This reads the route files rather than rendering them, because the defect is
 * a missing element — and the screen walk, which DOES render all 80, was green
 * throughout. A harness that only asks "did it mount" cannot see an absent
 * control.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const APP = join(__dirname, '..', '..', 'app');

// Tabs own the root of their stack; there is nothing to go back TO.
const TAB_GROUPS = ['(contractor)', '(tabs)'];
// Standalone entry points reached by URL, not pushed onto a stack: the
// customer portal, the deep-link landing pages, auth callbacks.
const STANDALONE = [
  'accept', 'auth', 'customer', 'quote', 'ref', 'worker/error.tsx',
  'reset-password.tsx', 'reset-onboarding.tsx',
];
// Portfolio/director surface — enterprise_portfolio is false, so it ships to
// nobody. See memory/feedback_contractor_aannemer_only.md.
const NOT_SHIPPED = ['hub'];
// Modal routes that no contractor screen pushes: two are reached only from the
// enterprise surface, two are reached from nowhere at all. They are dead-code
// candidates rather than UI defects, and `npm run audit:unmounted` owns that
// question. The three a contractor CAN reach — mollie, moneybird, pdf — are
// deliberately NOT on this list.
const UNREACHED_MODALS = [
  '(modals)/customers.tsx', '(modals)/ingestion.tsx',
  '(modals)/insights.tsx', '(modals)/stripe.tsx',
];
// A <Redirect>, not a screen: it renders no UI to put a control on.
const REDIRECTS = ['contractor/drag-schedule.tsx'];

const BACK_AFFORDANCE = /chevron-back|arrow-back|DKScreenHeader|router\.back|navigation\.goBack|onClose|onBack/;

function routeFiles(dir: string, rel = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    const relPath = rel ? `${rel}/${name}` : name;
    if (statSync(abs).isDirectory()) {
      if (TAB_GROUPS.includes(name) || NOT_SHIPPED.includes(name) || STANDALONE.includes(name)) return [];
      return routeFiles(abs, relPath);
    }
    if (!name.endsWith('.tsx')) return [];
    if (name.startsWith('_')) return [];
    if (STANDALONE.includes(relPath)) return [];
    // index.tsx / login are stack roots.
    if (relPath === 'index.tsx' || relPath === 'login.tsx') return [];
    if (UNREACHED_MODALS.includes(relPath) || REDIRECTS.includes(relPath)) return [];
    return [relPath];
  });
}

describe('drill-down screens offer a way back', () => {
  const files = routeFiles(APP);

  it('found the route files to check', () => {
    // A path typo that silently matched nothing would make every assertion
    // below vacuously pass.
    expect(files.length).toBeGreaterThan(40);
    expect(files).toContain('contractor/warranty.tsx');
    expect(files).toContain('quotes/[id]/invoice.tsx');
    // The three modals a contractor actually reaches must stay in scope — an
    // over-broad exemption list is how this check would quietly stop working.
    expect(files).toContain('(modals)/mollie.tsx');
    expect(files).toContain('(modals)/moneybird.tsx');
    expect(files).toContain('(modals)/pdf.tsx');
  });

  it.each(routeFiles(APP))('%s renders a back control', (relPath) => {
    const src = readFileSync(join(APP, relPath), 'utf8');
    expect(src).toMatch(BACK_AFFORDANCE);
  });
});
