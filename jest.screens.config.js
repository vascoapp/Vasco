/**
 * Screen-walk config — renders real screens headlessly with REAL i18n.
 *
 * Separate from jest.config.js on purpose: the main setup mocks `t()` to
 * return the key, which would walk every screen in key-space. See
 * jest.screens.setup.ts.
 *
 * Run: npm run walk
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__screenwalk__/**/*.test.tsx'],
  // `pressableIsWired` mounts 129 screens AND fires every control on each one.
  // It belongs with the walk suites, but running it inside `npm run walk` turned
  // the gate everyone runs constantly from ~5 minutes into far longer. It has
  // its own script — `npm run walk:wiring` — so the fast gate stays fast.
  testPathIgnorePatterns: ['/node_modules/', 'pressableIsWired'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|i18next|react-i18next)',
  ],
  setupFiles: ['./jest.screens.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testEnvironment: 'node',
  // Every suite here mounts a real screen over the real AppState + locale
  // JSON, and that first mount runs well past jest's 5s default once the
  // suites run in parallel. It bit three separate files as screens grew —
  // and the failure is misleading: a timeout mid-render leaves the FOLLOWING
  // tests rendering an empty tree, so one slow mount reports as several
  // unrelated assertion failures ("Project niet gevonden"). Set once here
  // rather than per file, so a new screen suite inherits it.
  testTimeout: 30000,
};
