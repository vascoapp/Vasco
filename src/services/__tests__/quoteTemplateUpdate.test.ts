/**
 * @jest-environment node
 *
 * updateTemplate — the method that made templates editable.
 *
 * Before it, "editing" could only go through saveTemplate, which always mints
 * `qt-${Date.now()}` and unshifts: the edit became a second template and the
 * original stayed in the list. These tests pin the identity that must survive
 * an edit, and the built-in override, which is the one destructive path here.
 */
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

function restart() {
  let svc: any;
  jest.isolateModules(() => { svc = require('../quoteTemplateService').quoteTemplateService; });
  return svc;
}

const line = (description: string, unitPrice: number, quantity = 1) => ({
  description, quantity, unit: 'stuk', unitPrice, vatRate: 21, type: 'labour' as const,
});

beforeEach(() => { mockStorage.clear(); });

describe('updateTemplate — user templates', () => {
  test('edits in place: same id, one template, new lines', async () => {
    const svc = restart();
    await svc.hydrate();
    const created = svc.saveTemplate('Badkamer', 'badkamer', [line('Tegelen', 100)]);
    const before = svc.getTemplates().length;

    const updated = svc.updateTemplate(created.id, { items: [line('Tegelen', 120), line('Voegen', 40)] });

    expect(updated.id).toBe(created.id);
    expect(svc.getTemplates().length).toBe(before);
    expect(updated.items).toHaveLength(2);
  });

  test('recomputes subtotal rather than carrying the old one', async () => {
    const svc = restart();
    await svc.hydrate();
    const created = svc.saveTemplate('X', 'overig', [line('A', 100)]);
    expect(created.subtotal).toBe(100);

    const updated = svc.updateTemplate(created.id, { items: [line('A', 100, 3)] });

    // A stored total beside the lines it derives from is the drift
    // pricebook.md design rule 1 exists to prevent.
    expect(updated.subtotal).toBe(300);
  });

  test('keeps usageCount and createdAt — an edit is not a new template', async () => {
    const svc = restart();
    await svc.hydrate();
    const created = svc.saveTemplate('X', 'overig', [line('A', 10)]);
    svc.useTemplate(created.id);
    svc.useTemplate(created.id);
    const createdAt = svc.getTemplate(created.id).createdAt;

    const updated = svc.updateTemplate(created.id, { name: 'X2' });

    expect(updated.usageCount).toBe(2);
    expect(updated.createdAt).toEqual(createdAt);
    expect(updated.name).toBe('X2');
  });

  test('a partial patch leaves the untouched fields alone', async () => {
    const svc = restart();
    await svc.hydrate();
    const created = svc.saveTemplate('Naam', 'keuken', [line('A', 10)], { description: 'Beschrijving' });

    const updated = svc.updateTemplate(created.id, { items: [line('B', 20)] });

    expect(updated.name).toBe('Naam');
    expect(updated.category).toBe('keuken');
    expect(updated.description).toBe('Beschrijving');
  });

  test('survives a restart', async () => {
    const a = restart();
    await a.hydrate();
    const created = a.saveTemplate('Persist', 'overig', [line('A', 10)]);
    a.updateTemplate(created.id, { items: [line('A', 99)] });
    await flush();

    const b = restart();
    await b.hydrate();
    expect(b.getTemplate(created.id).items[0].unitPrice).toBe(99);
  });

  test('an unknown id changes nothing and returns undefined', async () => {
    const svc = restart();
    await svc.hydrate();
    const before = svc.getTemplates().length;
    expect(svc.updateTemplate('qt-nope', { name: 'X' })).toBeUndefined();
    expect(svc.getTemplates().length).toBe(before);
  });
});

describe('updateTemplate — built-in override', () => {
  const firstBuiltin = (svc: any) => svc.getTemplates().find((t: any) => t.i18nId);

  test('a built-in exists to override', async () => {
    const svc = restart();
    await svc.hydrate();
    // Guards the rest of this block: if built-ins ever stop carrying i18nId,
    // every assertion below would pass against `undefined` and prove nothing.
    expect(firstBuiltin(svc)).toBeDefined();
  });

  test('editing replaces it — new id, built-in gone, count unchanged', async () => {
    const svc = restart();
    await svc.hydrate();
    const builtin = firstBuiltin(svc);
    const before = svc.getTemplates().length;

    const override = svc.updateTemplate(builtin.id, { name: 'Mijn versie', items: [line('Eigen regel', 55)] });

    expect(override.id).not.toBe(builtin.id);
    expect(svc.getTemplate(builtin.id)).toBeUndefined();
    expect(svc.getTemplates().length).toBe(before);
    expect(svc.getTemplates().filter((t: any) => t.name === 'Mijn versie')).toHaveLength(1);
  });

  test('drops i18nId so the edit is what renders', async () => {
    const svc = restart();
    await svc.hydrate();
    const builtin = firstBuiltin(svc);

    const override = svc.updateTemplate(builtin.id, { name: 'Mijn versie', items: [line('Eigen regel', 55)] });

    // Keeping i18nId would send localizeTemplate back to
    // quoteTemplates.builtins.<id>.name and render the shipped translation
    // over the contractor's own text — the edit would appear to do nothing.
    expect(override.i18nId).toBeUndefined();
    expect(override.paymentTermsKey).toBeUndefined();
  });

  test('the built-in stays gone after a restart', async () => {
    const a = restart();
    await a.hydrate();
    const builtin = firstBuiltin(a);
    a.updateTemplate(builtin.id, { name: 'Mijn versie', items: [line('Eigen regel', 55)] });
    await flush();

    const b = restart();
    await b.hydrate();
    // Without deletedBuiltinIds persisting, hydrate re-adds the shipped
    // template and the contractor sees both.
    expect(b.getTemplate(builtin.id)).toBeUndefined();
    expect(b.getTemplates().some((t: any) => t.name === 'Mijn versie')).toBe(true);
  });

  test('the override is a copy — mutating it cannot reach the shipped constant', async () => {
    const svc = restart();
    await svc.hydrate();
    const builtin = firstBuiltin(svc);
    // Hold the SHIPPED object from this same module instance. An earlier
    // version of this test compared across two restart() calls, and
    // jest.isolateModules re-evaluates the module — so BUILTIN_TEMPLATES was
    // freshly minted each time and the assertion held whether or not
    // updateTemplate copied anything. Verified by deleting the copy: the test
    // stayed green.
    const shippedLine = builtin.items[0];
    const originalDescription = shippedLine.description;

    const override = svc.updateTemplate(builtin.id, { name: 'V' });
    override.items[0].description = 'MUTATED';

    expect(override.items[0].description).toBe('MUTATED');
    expect(shippedLine.description).toBe(originalDescription);
  });
});
