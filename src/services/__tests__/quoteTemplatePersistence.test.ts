/**
 * @jest-environment node
 */
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

const KEY = '@vasco_quote_templates';
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A fresh module instance == an app restart, since the service is a singleton. */
function restart() {
  let svc: any;
  jest.isolateModules(() => { svc = require('../quoteTemplateService').quoteTemplateService; });
  return svc;
}

beforeEach(() => { mockStorage.clear(); });

describe('quote template persistence', () => {
  test('a saved template survives a restart', async () => {
    const a = restart();
    await a.hydrate();
    a.saveTemplate('Dakgoot reinigen', 'maintenance', [
      { description: 'Reinigen', quantity: 1, unitPrice: 150 },
    ]);
    await flush();

    const b = restart();
    await b.hydrate();
    expect(b.getTemplates().some((t: any) => t.name === 'Dakgoot reinigen')).toBe(true);
  });

  test('built-ins remain alongside user templates', async () => {
    const a = restart();
    await a.hydrate();
    const builtinCount = a.getTemplates().length;
    a.saveTemplate('Eigen sjabloon', 'maintenance', []);
    await flush();

    const b = restart();
    await b.hydrate();
    expect(b.getTemplates().length).toBe(builtinCount + 1);
  });

  test('a deleted built-in does not come back after restart', async () => {
    const a = restart();
    await a.hydrate();
    const first = a.getTemplates()[0];
    a.deleteTemplate(first.id);
    await flush();

    const b = restart();
    await b.hydrate();
    expect(b.getTemplates().some((t: any) => t.id === first.id)).toBe(false);
  });

  test('usage count survives a restart', async () => {
    const a = restart();
    await a.hydrate();
    const first = a.getTemplates()[0];
    const before = first.usageCount ?? 0;
    a.useTemplate(first.id);
    a.useTemplate(first.id);
    await flush();

    const b = restart();
    await b.hydrate();
    expect(b.getTemplates().find((t: any) => t.id === first.id)?.usageCount).toBe(before + 2);
  });

  test('a corrupt cache falls back to the built-ins rather than an empty list', async () => {
    mockStorage.set(KEY, '{ not json');
    const a = restart();
    await a.hydrate();
    expect(a.getTemplates().length).toBeGreaterThan(0);
  });

  test('dates are revived as Date objects, not strings', async () => {
    const a = restart();
    await a.hydrate();
    a.saveTemplate('Datumtest', 'maintenance', []);
    await flush();

    const b = restart();
    await b.hydrate();
    const t = b.getTemplates().find((x: any) => x.name === 'Datumtest');
    expect(t?.createdAt).toBeInstanceOf(Date);
  });
});
