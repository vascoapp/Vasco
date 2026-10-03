/**
 * THE EVERYDAY MATRIX — the jest half. Drives the real screens a new
 * contractor uses, per market × customer kind (__matrix__/cases.ts), and
 * writes what came out to .matrix/out/<cell>/. The validator half is
 * scripts/everyday-matrix-validate.mjs. Run both: `npm run matrix`.
 *
 * PRODUCTION posture (jest.screens.prod.setup.ts): DEMO_MODE off — no demo
 * company, customers, jobs or pricebook — and a SIGNED-IN contractor on the
 * live-schema fake backend, so every write meets the real columns and RLS.
 * The demo posture put a whole sample company (HRB, REA, tax regime) under the
 * first run and passed checks the contractor never filled in (2026-10-03).
 * The country is what onboarding sets, as for a real sign-up.
 *
 * Separate from the walk: these are long, end-to-end cells (onboarding to
 * export), and they must never slow down `npm run walk`.
 *
 * @type {import('jest').Config}
 */
const prod = require('./jest.screens.prod.config.js');
module.exports = {
  ...prod,
  testMatch: ['**/__matrix__/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/\\.claude/'],
  testTimeout: 300000,
};
