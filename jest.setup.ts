// =============================================================================
// JEST SETUP — Mocks for React Native + Expo dependencies
// =============================================================================

// ---------------------------------------------------------------------------
// AsyncStorage mock — in-memory store for tests
// ---------------------------------------------------------------------------
const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(mockStore).forEach((k) => delete mockStore[k]);
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockStore))),
    multiGet: jest.fn((keys: string[]) =>
      Promise.resolve(keys.map((k) => [k, mockStore[k] ?? null])),
    ),
    multiSet: jest.fn((pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => {
        mockStore[k] = v;
      });
      return Promise.resolve();
    }),
  },
}));

// Helper to reset AsyncStorage between tests
(globalThis as any).__asyncStorageMock = mockStore;

// ---------------------------------------------------------------------------
// expo-router mock
// ---------------------------------------------------------------------------
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Link: 'Link',
  Stack: { Screen: 'Screen' },
  Tabs: { Screen: 'Screen' },
}));

// ---------------------------------------------------------------------------
// react-i18next mock — returns key as translation
// ---------------------------------------------------------------------------
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
    i18n: { language: 'en', changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

// ---------------------------------------------------------------------------
// i18next direct mock — for services that import i18n directly
// ---------------------------------------------------------------------------
// Mirrors i18next's {{placeholder}} interpolation. Without this the mock
// returned defaultValue verbatim, so a test could never tell a correctly
// interpolated string from one whose params never bound — real i18next DOES
// interpolate defaultValue. Unknown placeholders are left intact on purpose so
// a param-name mismatch stays visible as a literal {{foo}} in assertions.
// Name must start with `mock` — babel-plugin-jest-hoist hoists jest.mock()
// factories above this declaration and only allows out-of-scope references
// through for `mock`-prefixed bindings.
const mockInterpolate = (template: string, params?: Record<string, any>): string => {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name) =>
    params[name] !== undefined && params[name] !== null ? String(params[name]) : whole,
  );
};

jest.mock('./src/i18n/i18n', () => ({
  __esModule: true,
  default: {
    t: (key: string, defaultValueOrOpts?: any, maybeOpts?: any) => {
      if (typeof defaultValueOrOpts === 'string') {
        return mockInterpolate(defaultValueOrOpts, maybeOpts);
      }
      if (defaultValueOrOpts?.defaultValue) {
        return mockInterpolate(defaultValueOrOpts.defaultValue, defaultValueOrOpts);
      }
      return key;
    },
    language: 'en',
    changeLanguage: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// expo-haptics mock
// ---------------------------------------------------------------------------
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

// ---------------------------------------------------------------------------
// react-native Share mock
// ---------------------------------------------------------------------------
jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
}));

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
jest.mock('./src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
  isSupabaseConfigured: false,
}));

// ---------------------------------------------------------------------------
// Misc service mocks used transitively
// ---------------------------------------------------------------------------
jest.mock('./src/services/invoiceScanService', () => ({
  getScanHistory: jest.fn(() => Promise.resolve([])),
  getFirstScanInsights: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('./src/services/cohortBenchmarkService', () => ({
  getTradeBaselines: jest.fn(() => Promise.resolve(null)),
  // Stubbed alongside getTradeBaselines so suites that transitively import
  // this module (quoteOptimizerService) do not hit `is not a function` on a
  // partially-mocked module. Tests that need the real matching behaviour
  // unmock this module explicitly.
  getCohortBenchmarks: jest.fn(() =>
    Promise.resolve({
      materialBenchmarks: [],
      tradeBenchmarks: [],
      lastSync: new Date().toISOString(),
      contractorsInCohort: 0,
    }),
  ),
  findBenchmark: jest.fn(() => null),
}));

jest.mock('./src/intelligence/tradeContext', () => ({
  getCustomerIntelligence: jest.fn(() => null),
}));
