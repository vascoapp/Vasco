/**
 * @jest-environment node
 */
// Three things the app claimed and then forgot (#339, sweep 2026-09-16):
//
//  - "Connected" for Mollie / Stripe / Moneybird was only ever set by the
//    connect action, so after a restart the invoice screen asked the
//    contractor to connect again and hid the payment link — while the API key
//    sat in SecureStore the whole time. Each integration can answer
//    `isConnected()`; nothing asked it.
//  - Tapping "Done" on an edited AI reminder cleared the editor, and the send
//    fell back to the ORIGINAL draft: the edit never went out.
//  - The job screen's "Order" button added the material to a local Set and
//    alerted that it "has been ordered from {{supplier}}". Nothing was ordered
//    (there is no supplier channel) and nothing was stored, so a reload showed
//    it as un-ordered again.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('integration connections are read from stored credentials', () => {
  const appState = read('src/state/AppState.tsx');

  it('AppState asks each integration on mount, not just on connect', () => {
    const at = appState.indexOf('const refreshConnections');
    expect(at).toBeGreaterThan(-1);
    const definition = appState.slice(at, appState.indexOf('};', at));
    for (const mod of ['mollie', 'stripe', 'moneybird']) {
      expect(definition).toContain(`integrations/${mod}`);
    }
    expect(definition).toMatch(/isConnected\(\)/);
    // It must actually be CALLED on mount as well as on user change —
    // commenting out the mount call left the definition intact and this test
    // green until it counted the invocations.
    const invocations = (appState.match(/void refreshConnections\(\);/g) ?? []).length;
    expect(invocations).toBeGreaterThanOrEqual(2);
  });

  it('re-reads them when the signed-in contractor changes', () => {
    const at = appState.indexOf('const refreshConnections');
    expect(appState.slice(at, at + 1600)).toMatch(/subscribeUserChange\(\(\) => \{ void refreshConnections\(\); \}\)/);
  });
});

describe('an edited reminder is the one that gets sent', () => {
  const ai = read('app/(contractor)/ai.tsx');

  it('keeps the edit per action instead of a single cleared field', () => {
    expect(ai).toMatch(/const \[edits, setEdits\] = useState<Record<string, string>>/);
    expect(ai).toMatch(/editedTextFor/);
  });

  it('falls back to the draft when the box was CLEARED', () => {
    // `edits[id] ?? shareText` keeps '' — a value — so clearing the editor and
    // approving opened the share sheet with an empty message.
    const at = ai.indexOf('const editedTextFor');
    expect(at).toBeGreaterThan(-1);
    const body = ai.slice(at, ai.indexOf('const setEditFor', at));
    expect(body).toMatch(/\.trim\(\)/);
    expect(body).not.toMatch(/edits\[a\.id\] \?\? a\.shareText/);
  });

  it('shares the edited text, not the original draft', () => {
    const at = ai.indexOf('const handleAction');
    const body = ai.slice(at, at + 900);
    expect(body).toMatch(/editedTextFor\(action\)/);
    expect(body).not.toMatch(/editingId === action\.id && editText \? editText : action\.shareText/);
  });
});

describe('"ordered" is recorded, not announced', () => {
  const job = read('app/contractor/job/[id].tsx');

  it('writes the material status through the mutator', () => {
    expect(job).toMatch(/updateJobMaterialStatus\(mat\.id, String\(id\), 'ordered'\)/);
  });

  it('no longer keeps it in a local Set, and claims no order was placed', () => {
    expect(job).not.toMatch(/orderedMaterials/);
    expect(job).not.toMatch(/has been ordered from/);
    expect(job).toMatch(/jobs\.markOrdered/);
  });
});
