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
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|i18next|react-i18next)',
  ],
  setupFiles: ['./jest.screens.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testEnvironment: 'node',
};
