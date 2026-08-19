/**
 * Workflow rule #7, enforced instead of remembered.
 *
 * Every entity-creation mutator has one shape:
 *
 *   let finalId = tempId;
 *   try { const row = await dbCreateX(); finalId = row.id; }
 *   catch { queueWrite({...}); }
 *   <housekeeping using finalId>
 *   return finalId;
 *
 * The failure this prevents was found in FIVE mutators at once: `return row.id`
 * INSIDE the try, which skips every post-create signal that lives after the
 * block — activation milestones, ontology upserts, embeddings, calendar sync,
 * the moat emits. Online users silently lost all of it while offline users kept
 * it, and side effects that had already fired under the tempId were orphaned
 * when the queue later swapped in the real uuid.
 *
 * It is clean today. Nothing stopped it coming back, and it comes back by
 * copying the mutator next to it — which is how it reached five in the first
 * place.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'AppState.tsx'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('AppState mutator shape (rule #7)', () => {
  it('never returns a BE row id from inside the try block', () => {
    // The literal shape of the bug. Comments are stripped first so the
    // explanatory notes describing it do not trip the check.
    const offenders = [...CODE.matchAll(/return\s+(?:\(\s*)?row(?:\s+as\s+any)?\s*\)?\s*\.id/g)]
      .map((m) => `…${CODE.slice(Math.max(0, m.index! - 60), m.index! + 20).replace(/\s+/g, ' ')}`);
    expect(offenders).toEqual([]);
  });

  it('never returns a BE id under any of its usual names', () => {
    // `data.id`, `inserted.id` — same bug, different local variable.
    const offenders = [...CODE.matchAll(/return\s+(?:data|inserted|created|newRow)(?:\s+as\s+any)?\s*\.id\b/g)]
      .map((m) => CODE.slice(Math.max(0, m.index! - 50), m.index! + 20).replace(/\s+/g, ' '));
    expect(offenders).toEqual([]);
  });

  it('still has the mutators this is guarding', () => {
    // A regex that matches nothing reports a clean sweep. If these disappear,
    // the guard has quietly stopped guarding anything.
    for (const fn of ['addCustomer:', 'addJob:', 'addQuote:', 'addProject:', 'addSupplier:']) {
      expect(CODE).toContain(fn);
    }
    // And the shape it is protecting is actually in use.
    // finalId / finalJobId — the same shape, one named for its entity.
    const shaped = (CODE.match(/let final[A-Za-z]* = tempId/g) ?? []).length;
    expect(shaped).toBeGreaterThanOrEqual(4);
  });

  it('every mutator that queues an insert names the row id and the owner', () => {
    // The other half of rule #7 / #370: a queued insert without `id` cannot be
    // re-keyed on flush, and one without `user_id` fails RLS and is dropped
    // after five retries. `documents` is the deliberate exception — the flush
    // mints a real document_number and the uuid is the database's to make.
    const blocks = [...CODE.matchAll(/queueWrite\(\{[\s\S]*?\n\s*\}\)/g)].map((m) => m[0]);
    const inserts = blocks.filter((b) => b.includes("op: 'insert'"));
    expect(inserts.length).toBeGreaterThanOrEqual(10);
    const bad = inserts.filter((b) => {
      if (/table: 'documents'/.test(b)) return false;
      return !/\bid:\s/.test(b) || !/user_id/.test(b);
    });
    expect(bad.map((b) => b.slice(0, 80))).toEqual([]);
  });
});
