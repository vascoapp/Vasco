/**
 * Screen walk in PRODUCTION posture — DEMO_MODE off, __DEV__ false.
 *
 * Same suites as jest.screens.config.js; the only difference is the extra
 * setup file that flips the demo switches before any app module loads. See
 * jest.screens.prod.setup.ts for why this posture is the one that matters for
 * "is the mock data gone?".
 *
 * Run: npm run walk:prod
 *
 * @type {import('jest').Config}
 */
const base = require('./jest.screens.config.js');

/**
 * Only the posture-AGNOSTIC suites run here, and the exclusions are not
 * laziness — running the others in this posture asks a question they were not
 * written to answer:
 *
 *   - crewBoard / payrollScreen / projectLabour / milestoneEditor / flow* are
 *     FIXTURE-DEPENDENT by design. They assert "the board shows Ahmed", which
 *     requires seeded demo data. With DEMO_MODE off there is no Ahmed, and
 *     "no team members yet" is the CORRECT production rendering — so a failure
 *     here measures the fixture, not the product.
 *   - euFR / euES / euIT are COUNTRY postures driven by per-market demo
 *     accounts. Production posture signs in one generic user, so those suites
 *     would assert a market the walk is no longer standing in. Country coverage
 *     stays in `npm run walk`, where the postures are real.
 *
 *   - flows that SEED LOCAL FIXTURES (AsyncStorage rows with ids like `c1`
 *     that no backend holds). Since 2026-09-24 this posture runs on the
 *     live-schema fake backend, signed in; the refresh correctly replaces
 *     local rows with the (empty) server truth, so the seeded row is gone
 *     before the flow starts. They prove their flow in `walk`. To bring one
 *     here, seed the FAKE (`require('../src/lib/supabase').__fake.seed`).
 *
 * What remains is exactly the question worth asking with demo data off: does
 * every screen still mount, and does any fabricated-fixture shape reach the
 * render? That is walk.test + detectors.test + the empty-state suites.
 */
module.exports = {
  ...base,
  setupFiles: [...base.setupFiles, './jest.screens.prod.setup.ts'],
  // The live-schema net: a suite whose screens sent a call the real schema
  // would reject (unknown column, NOT NULL, RLS, grant) fails.
  setupFilesAfterEnv: [...(base.setupFilesAfterEnv ?? []), './jest.afterEnv.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/__screenwalk__/crewBoard.test.tsx',
    '<rootDir>/__screenwalk__/payrollScreen.test.tsx',
    '<rootDir>/__screenwalk__/projectLabour.test.tsx',
    '<rootDir>/__screenwalk__/milestoneEditor.test.tsx',
    '<rootDir>/__screenwalk__/handoverBlocked.test.tsx',
    '<rootDir>/__screenwalk__/flowPromisedHandover.test.tsx',
    '<rootDir>/__screenwalk__/flowTemplateApply.test.tsx',
    '<rootDir>/__screenwalk__/euFR.test.tsx',
    '<rootDir>/__screenwalk__/euES.test.tsx',
    '<rootDir>/__screenwalk__/euIT.test.tsx',
    '<rootDir>/__screenwalk__/handwerker.test.tsx',
    '<rootDir>/__screenwalk__/aannemer.test.tsx',
    // Local-fixture flows (see above).
    '<rootDir>/__screenwalk__/customerDetailDocuments.test.tsx',
    '<rootDir>/__screenwalk__/flowCustomerEdit.test.tsx',
    '<rootDir>/__screenwalk__/flowCustomerRowOpens.test.tsx',
    '<rootDir>/__screenwalk__/flowInvoiceLinesEdit.test.tsx',
    '<rootDir>/__screenwalk__/flowInvoiceRowOpens.test.tsx',
    '<rootDir>/__screenwalk__/flowLeadCreateQuote.test.tsx',
    '<rootDir>/__screenwalk__/flowQuoteSendKeepsAccepted.test.tsx',
    '<rootDir>/__screenwalk__/flowQuoteSendMarksSent.test.tsx',
  ],
};
