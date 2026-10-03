/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // Agent worktrees (.claude/worktrees/*) are whole copies of the repo: their
  // suites ran as ours, and their modules collided in the haste map.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/\\.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/\\.claude/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|i18next|react-i18next)',
  ],
  setupFiles: ['./jest.setup.ts'],
  setupFilesAfterEnv: ['./jest.afterEnv.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
};
