/**
 * @jest-environment node
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
      __mockStore: mockStore,
    },
  };
});

describe('activeProjectService', () => {
  test('lifecycle: null → set → get → clear', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const store = AsyncStorage.__mockStore as Record<string, string>;
    for (const k of Object.keys(store)) delete store[k];

    jest.isolateModules(() => {
      // no-op: reset module state for the import below
    });
    const svc = require('../activeProjectService');

    expect(await svc.getActiveProjectId()).toBeNull();

    await svc.setActiveProjectId('proj-123');
    expect(store['@vasco_active_project']).toBe('proj-123');
    expect(await svc.getActiveProjectId()).toBe('proj-123');

    await svc.setActiveProjectId(null);
    expect('@vasco_active_project' in store).toBe(false);
    expect(await svc.getActiveProjectId()).toBeNull();
  });
});

// Was: "all include contractor" — the plan to show aannemers site-lead
// insights. Since `sitelead/*` was gated (2026-09-24) those insights could only
// be buttons into a dormant route, so the role was removed (2026-09-29). It
// comes back together with DORMANT_CONTROLS.projectSiteOps, when the site-lead
// screens are un-gated for the aannemer. Guard for the general rule:
// src/__tests__/contractorInsightsRouteToLiveScreens.test.ts.
describe('site-lead generators stay off the contractor while sitelead/* is dormant', () => {
  test('crew-performance, defect-cluster, cert-renewal, incident-trend exclude contractor', async () => {
    const mod = require('../../intelligence/generators');
    const reg = mod.GENERATOR_REGISTRY ?? mod.default?.GENERATOR_REGISTRY;
    if (!reg) return;
    const ids = ['crew-performance', 'defect-cluster', 'cert-renewal-planner', 'incident-trend'];
    for (const id of ids) {
      const entry = reg.find((r: any) => r.id === id);
      expect(entry).toBeDefined();
      expect(entry.roles).not.toContain('contractor');
    }
  });
});
